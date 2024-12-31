from flask import Flask, render_template, request, redirect, url_for, flash, send_file, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from datetime import datetime
import os
from services.document_processor import DocumentProcessor
from werkzeug.utils import secure_filename
from utils.email_sender import send_email, EXPENSE_SUBMITTED_TEMPLATE, EXPENSE_STATUS_UPDATE_TEMPLATE, NEW_USER_TEMPLATE
import logging
import pytz
from routes.expense import expense_bp
from flask_migrate import Migrate
from config import Config
from io import BytesIO
import pandas as pd
from models import db, Department, Category, Subcategory, User, Supplier, Expense

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Initialize Flask app
app = Flask(__name__)
app.config.from_object(Config)
Config.init_app(app)

# Initialize extensions
db.init_app(app)
migrate = Migrate(app, db)

# Initialize login manager
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# Register blueprints
app.register_blueprint(expense_bp, url_prefix='/api/expense')

# Initialize Dash admin dashboard
from dashboards.admin_dash import create_admin_dashboard
admin_dash = create_admin_dashboard(app)

ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Initialize database
with app.app_context():
    db.create_all()  # Only create tables if they don't exist

    try:
        # Create departments if they don't exist
        rd_dept = Department.query.filter_by(name='R&D').first()
        if not rd_dept:
            rd_dept = Department(name='R&D', budget=100000.0)
            db.session.add(rd_dept)
            db.session.commit()

        # Create admin user if it doesn't exist
        admin_user = User.query.filter_by(username='admin').first()
        if not admin_user:
            admin_user = User(
                username='admin',
                email='admin@example.com',
                password='admin123',
                is_manager=True,
                is_admin=True
            )
            db.session.add(admin_user)
            db.session.commit()
            print("Admin user created successfully")
    except Exception as e:
        print(f"Error initializing database: {str(e)}")
        db.session.rollback()

@login_manager.user_loader
def load_user(user_id):
    user = User.query.get(int(user_id))
    if user and user.status == 'inactive':
        return None
    return user

# Custom template filters
@app.template_filter('min_value')
def min_value(value, limit):
    return min(value, limit)

# Custom template filters
@app.template_filter('format_currency')
def format_currency(value):
    return f"₪{value:,.2f}"

@app.template_filter('format_expense_type')
def format_expense_type(value):
    types = {
        'future_approval': 'Approval for future purchase',
        'auto_approved': 'Automatically approved expense',
        'needs_approval': 'Needs manager approval',
        'pre_approved': 'Pre-approved by manager'
    }
    return types.get(value, value)

@app.route('/')
def index():
    if current_user.is_authenticated:
        if current_user.is_manager:
            return redirect(url_for('manager_dashboard'))
        return redirect(url_for('employee_dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter_by(username=username).first()
        if user and user.password == password:  # In production, use proper password hashing
            if user.status == 'inactive':
                flash('Your account is inactive. Please contact your administrator.')
                return render_template('login.html')
            login_user(user)
            if user.is_accounting:
                return redirect(url_for('accounting_dashboard'))
            return redirect(url_for('index'))
        flash('Invalid username or password')
    return render_template('login.html')

@app.route('/employee/dashboard')
@login_required
def employee_dashboard():
    if current_user.is_manager:
        return redirect(url_for('manager_dashboard'))
    
    expenses = Expense.query.filter_by(user_id=current_user.id).order_by(Expense.date.desc()).all()
    
    total_requests = len(expenses)
    pending_requests = sum(1 for e in expenses if e.status == 'pending')
    approved_requests = sum(1 for e in expenses if e.status == 'approved')
    rejected_requests = sum(1 for e in expenses if e.status == 'rejected')
    total_approved_amount = sum(e.amount for e in expenses if e.status == 'approved')
    
    return render_template('employee_dashboard.html', 
                         expenses=expenses,
                         total_requests=total_requests,
                         pending_requests=pending_requests,
                         approved_requests=approved_requests,
                         rejected_requests=rejected_requests,
                         total_approved_amount=total_approved_amount,
                         pytz=pytz)

@app.route('/submit-expense', methods=['GET', 'POST'])
@login_required
def submit_expense():
    if request.method == 'GET':
        categories = Category.query.join(Department).filter(
            Department.id == current_user.department_id
        ).all()
        
        subcategories = []
        if categories:
            subcategories = Subcategory.query.filter_by(category_id=categories[0].id).all()
        
        suppliers = Supplier.query.filter_by(status='active').order_by(Supplier.name).all()
        
        return render_template('submit_expense.html', 
                            categories=categories, 
                            subcategories=subcategories,
                            suppliers=suppliers)
    
    # Handle POST request
    try:
        # Get form data
        amount = float(request.form['amount'])
        description = request.form['description']
        reason = request.form['reason']
        expense_type = request.form['type']
        subcategory_id = int(request.form['subcategory_id'])
        payment_method = request.form['payment_method']
        supplier_id = request.form.get('supplier_id')
        supplier_name = request.form.get('supplier_name')
        bank_name = request.form.get('bank_name')
        bank_account_number = request.form.get('bank_account_number')
        bank_branch = request.form.get('bank_branch')
        bank_swift = request.form.get('bank_swift')
        purchase_date_str = request.form.get('purchase_date')
        
        if supplier_id:
            supplier_id = int(supplier_id)
            
        # Convert purchase_date string to datetime if provided
        purchase_date = None
        if purchase_date_str:
            try:
                purchase_date = datetime.strptime(purchase_date_str, '%Y-%m-%d')
            except ValueError:
                logging.error(f"Invalid purchase date format: {purchase_date_str}")
        
        # Handle supplier
        if supplier_name and not supplier_id:
            # Create new supplier
            supplier = Supplier(
                name=supplier_name,
                bank_name=bank_name,
                bank_account_number=bank_account_number,
                bank_branch=bank_branch,
                bank_swift=bank_swift
            )
            db.session.add(supplier)
            db.session.commit()
            supplier_id = supplier.id
        
        # Create new expense
        expense = Expense(
            amount=amount,
            description=description,
            reason=reason,
            type=expense_type,
            subcategory_id=subcategory_id,
            user_id=current_user.id,
            payment_method=payment_method,
            supplier_id=supplier_id,
            purchase_date=purchase_date
        )
        
        # Process document if uploaded
        if 'invoice' in request.files:
            invoice_file = request.files['invoice']
            if invoice_file and allowed_file(invoice_file.filename):
                # Save the file with a proper name
                filename = secure_filename(f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{invoice_file.filename}")
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                
                # Save the file first
                invoice_file.save(filepath)
                expense.invoice_filename = filename
                
                try:
                    # Process the document
                    doc_processor = DocumentProcessor()
                    doc_data = doc_processor.process_invoice(filepath)
                    logging.info(f"Extracted document data: {doc_data}")
                    
                    # Update expense with document data if available
                    if doc_data.get('invoice_total'):
                        invoice_total = doc_data['invoice_total']
                        if hasattr(invoice_total, 'amount'):
                            expense.amount = float(invoice_total.amount)
                        else:
                            expense.amount = float(invoice_total)
                        logging.info(f"Updated amount to {expense.amount}")
                    
                    if doc_data.get('items') and doc_data['items'] and doc_data['items'][0].get('description'):
                        expense.description = doc_data['items'][0]['description']
                        logging.info(f"Updated description to {expense.description}")
                    
                    if doc_data.get('vendor_name'):
                        expense.supplier_name = doc_data['vendor_name']
                        logging.info(f"Updated supplier_name to {expense.supplier_name}")
                    
                    if doc_data.get('invoice_date'):
                        expense.purchase_date = doc_data['invoice_date']
                        logging.info(f"Updated purchase_date to {expense.purchase_date}")
                        
                except Exception as e:
                    logging.error(f"Error processing document: {str(e)}")
        
        # Process quote if provided
        if 'quote' in request.files:
            quote = request.files['quote']
            if quote and allowed_file(quote.filename):
                filename = secure_filename(f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{quote.filename}")
                quote.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                expense.quote_filename = filename

        # Process receipt if provided
        if 'receipt' in request.files:
            receipt = request.files['receipt']
            if receipt and allowed_file(receipt.filename):
                filename = secure_filename(f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{receipt.filename}")
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                
                # Save the file first
                receipt.save(filepath)
                expense.receipt_filename = filename
                
                try:
                    # Process the receipt
                    doc_processor = DocumentProcessor()
                    receipt_data = doc_processor.process_receipt(filepath)
                    logging.info(f"Extracted receipt data: {receipt_data}")
                    
                    # Update expense with receipt data if available and if not already set by invoice
                    if not expense.amount and receipt_data.get('total'):
                        total = receipt_data['total']
                        if hasattr(total, 'amount'):
                            expense.amount = float(total.amount)
                        else:
                            expense.amount = float(total)
                        logging.info(f"Updated amount from receipt to {expense.amount}")
                    
                    if not expense.description and receipt_data.get('items') and receipt_data['items'] and receipt_data['items'][0].get('description'):
                        expense.description = receipt_data['items'][0]['description']
                        logging.info(f"Updated description from receipt to {expense.description}")
                    
                    if not expense.supplier_name and receipt_data.get('merchant_name'):
                        expense.supplier_name = receipt_data['merchant_name']
                        logging.info(f"Updated supplier_name from receipt to {expense.supplier_name}")
                    
                    if not expense.purchase_date and receipt_data.get('transaction_date'):
                        expense.purchase_date = receipt_data['transaction_date']
                        logging.info(f"Updated purchase_date from receipt to {expense.purchase_date}")
                        
                except Exception as e:
                    logging.error(f"Error processing receipt: {str(e)}")
        
        # Save the expense to database
        db.session.add(expense)
        db.session.commit()
        
        # Explicitly load the subcategory relationship
        db.session.refresh(expense)

        # Send email notification to managers
        try:
            managers = User.query.filter_by(is_manager=True).all()
            for manager in managers:
                send_email(
                    subject="New Expense Submission",
                    recipient=manager.email,
                    template=EXPENSE_SUBMITTED_TEMPLATE,
                    expense=expense,
                    submitter=current_user
                )
        except Exception as e:
            logging.error(f"Failed to send email notification: {str(e)}")
            # Continue even if email fails
            pass

        flash('Expense submitted successfully!', 'success')
        return redirect(url_for('employee_dashboard'))
        
    except Exception as e:
        logging.error(f"Error submitting expense: {str(e)}")
        flash('Error submitting expense. Please try again.', 'error')
        return redirect(url_for('submit_expense'))

@app.route('/download/<filename>')
@login_required
def download_file(filename):
    # Check all document type fields for the file
    expense = Expense.query.filter(
        db.or_(
            Expense.quote_filename == filename,
            Expense.invoice_filename == filename,
            Expense.receipt_filename == filename
        )
    ).first_or_404()
    
    if current_user.is_manager or current_user.is_accounting or expense.user_id == current_user.id:
        try:
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            if not os.path.exists(filepath):
                flash('File not found', 'error')
                return redirect(url_for('employee_dashboard'))
            return send_file(filepath, as_attachment=True)
        except Exception as e:
            logging.error(f"Error downloading file {filename}: {str(e)}")
            flash('Error downloading file', 'error')
            return redirect(url_for('employee_dashboard'))
            
    flash('Unauthorized access')
    return redirect(url_for('employee_dashboard'))

@app.route('/manager/dashboard')
@login_required
def manager_dashboard():
    if not current_user.is_manager:
        return redirect(url_for('employee_dashboard'))
    
    # Subquery to get total approved expenses for each level
    dept_expenses = db.session.query(
        Department.id,
        db.func.sum(Expense.amount).label('total_expenses')
    ).join(
        Category, Department.id == Category.department_id
    ).join(
        Subcategory, Category.id == Subcategory.category_id
    ).join(
        Expense, Subcategory.id == Expense.subcategory_id
    ).filter(
        Expense.status == 'approved',
        Expense.type != 'future_approval'  # Exclude future approvals
    ).group_by(Department.id).subquery()

    cat_expenses = db.session.query(
        Category.id,
        db.func.sum(Expense.amount).label('total_expenses')
    ).join(
        Subcategory, Category.id == Subcategory.category_id
    ).join(
        Expense, Subcategory.id == Expense.subcategory_id
    ).filter(
        Expense.status == 'approved',
        Expense.type != 'future_approval'  # Exclude future approvals
    ).group_by(Category.id).subquery()

    subcat_expenses = db.session.query(
        Subcategory.id,
        db.func.sum(Expense.amount).label('total_expenses')
    ).join(
        Expense, Subcategory.id == Expense.subcategory_id
    ).filter(
        Expense.status == 'approved',
        Expense.type != 'future_approval'  # Exclude future approvals
    ).group_by(Subcategory.id).subquery()

    # Get all pending expenses if admin, otherwise only from their department
    if current_user.username == 'admin':
        pending_expenses = Expense.query.join(User, Expense.user_id == User.id)\
            .join(Subcategory, Expense.subcategory_id == Subcategory.id)\
            .join(Category, Subcategory.category_id == Category.id)\
            .join(Department, Category.department_id == Department.id)\
            .outerjoin(dept_expenses, Department.id == dept_expenses.c.id)\
            .outerjoin(cat_expenses, Category.id == cat_expenses.c.id)\
            .outerjoin(subcat_expenses, Subcategory.id == subcat_expenses.c.id)\
            .filter(Expense.status == 'pending')\
            .add_columns(
                Department.name.label('department_name'),
                Department.budget.label('department_budget'),
                (Department.budget - db.func.coalesce(dept_expenses.c.total_expenses, 0)).label('department_remaining'),
                Category.name.label('category_name'),
                Category.budget.label('category_budget'),
                (Category.budget - db.func.coalesce(cat_expenses.c.total_expenses, 0)).label('category_remaining'),
                Subcategory.name.label('subcategory_name'),
                Subcategory.budget.label('subcategory_budget'),
                (Subcategory.budget - db.func.coalesce(subcat_expenses.c.total_expenses, 0)).label('subcategory_remaining')
            ).order_by(Expense.date.desc()).all()
    else:
        pending_expenses = Expense.query.join(User, Expense.user_id == User.id)\
            .join(Subcategory, Expense.subcategory_id == Subcategory.id)\
            .join(Category, Subcategory.category_id == Category.id)\
            .join(Department, Category.department_id == Department.id)\
            .outerjoin(dept_expenses, Department.id == dept_expenses.c.id)\
            .outerjoin(cat_expenses, Category.id == cat_expenses.c.id)\
            .outerjoin(subcat_expenses, Subcategory.id == subcat_expenses.c.id)\
            .filter(
                Expense.status == 'pending',
                User.department_id == current_user.department_id
            )\
            .add_columns(
                Department.name.label('department_name'),
                Department.budget.label('department_budget'),
                (Department.budget - db.func.coalesce(dept_expenses.c.total_expenses, 0)).label('department_remaining'),
                Category.name.label('category_name'),
                Category.budget.label('category_budget'),
                (Category.budget - db.func.coalesce(cat_expenses.c.total_expenses, 0)).label('category_remaining'),
                Subcategory.name.label('subcategory_name'),
                Subcategory.budget.label('subcategory_budget'),
                (Subcategory.budget - db.func.coalesce(subcat_expenses.c.total_expenses, 0)).label('subcategory_remaining')
            ).order_by(Expense.date.desc()).all()
    
    return render_template('manager_dashboard.html', expenses=pending_expenses)

@app.route('/manager/history')
@login_required
def expense_history():
    if current_user.is_admin:
        # For admin, show all expenses
        expenses = Expense.query.order_by(Expense.date.desc()).all()
    elif current_user.is_manager:
        # For managers, show all expenses from their departments
        managed_dept_ids = [dept.id for dept in current_user.managed_departments]
        managed_dept_ids.append(current_user.department_id)
        
        expenses = db.session.query(Expense).join(
            User, Expense.user_id == User.id
        ).filter(
            User.department_id.in_(managed_dept_ids)
        ).order_by(Expense.date.desc()).all()
    else:
        # For regular employees, show only their expenses
        expenses = Expense.query.filter_by(
            user_id=current_user.id
        ).order_by(Expense.date.desc()).all()
    
    # Get all employees for the filter dropdown
    if current_user.is_admin:
        employees = User.query.all()  # Show all employees for admin
        departments = Department.query.all()
    elif current_user.is_manager:
        # Only show employees from manager's departments
        managed_dept_ids = [dept.id for dept in current_user.managed_departments]
        managed_dept_ids.append(current_user.department_id)
        employees = User.query.filter(User.department_id.in_(managed_dept_ids)).all()
        departments = [dept for dept in Department.query.filter(Department.id.in_(managed_dept_ids)).all()]
    else:
        employees = []
        departments = []
    
    # Get filter parameters
    status = request.args.get('status', 'all')
    employee = request.args.get('employee', 'all')
    department = request.args.get('department', 'all')
    
    # Apply filters
    if status != 'all':
        expenses = [expense for expense in expenses if expense.status == status]
    if employee != 'all':
        expenses = [expense for expense in expenses if expense.user_id == int(employee)]
    if department != 'all':
        expenses = [expense for expense in expenses if expense.submitter.department_id == int(department)]
    
    return render_template('expense_history.html', 
                         expenses=expenses,
                         employees=employees,
                         departments=departments,
                         selected_status=status,
                         selected_employee=employee,
                         selected_department=department)

@app.route('/expense/<int:expense_id>/<action>', methods=['GET', 'POST'])
@login_required
def handle_expense(expense_id, action):
    if not current_user.is_manager:
        return redirect(url_for('employee_dashboard'))
    
    expense = Expense.query.get_or_404(expense_id)
    
    if action == 'approve':
        expense.status = 'approved'
        message = 'Expense approved successfully'
    elif action == 'reject':
        expense.status = 'rejected'
        expense.rejection_reason = request.form.get('rejection_reason')
        message = 'Expense rejected successfully'
    else:
        flash('Invalid action', 'danger')
        return redirect(url_for('manager_dashboard'))
    
    # Record manager information
    expense.manager_id = current_user.id
    expense.handled_at = datetime.now(pytz.utc).replace(microsecond=0)
    
    try:
        db.session.commit()
        flash(message, 'success')
        
        # Send email notification to the expense submitter
        send_email(
            subject='Expense Status Update',
            recipient=expense.submitter.email,
            template=EXPENSE_STATUS_UPDATE_TEMPLATE,
            employee_name=expense.submitter.username,
            expense=expense,
            subcategory=expense.subcategory,
            status=expense.status
        )
    except Exception as e:
        db.session.rollback()
        flash(f'Error: {str(e)}', 'danger')
    
    return redirect(url_for('manager_dashboard'))

@app.route('/manager/departments')
@login_required
def manage_departments():
    if not current_user.is_manager:
        flash('Access denied. Manager privileges required.', 'danger')
        return redirect(url_for('index'))
    
    if current_user.username == 'admin':
        departments = Department.query.all()
    else:
        departments = current_user.managed_departments
    
    return render_template('manage_departments.html', departments=departments)

@app.route('/manager/categories/<int:dept_id>')
@login_required
def manage_categories(dept_id):
    if not current_user.is_manager:
        flash('Access denied. Manager privileges required.', 'danger')
        return redirect(url_for('index'))
    
    if not current_user.username == 'admin' and current_user.department_id != dept_id:
        flash('Access denied. You can only manage your own department.', 'danger')
        return redirect(url_for('manage_departments'))
    
    department = Department.query.get_or_404(dept_id)
    return render_template('manage_categories.html', department=department)

@app.route('/manager/subcategories/<int:cat_id>')
@login_required
def manage_subcategories(cat_id):
    if not current_user.is_manager:
        flash('Access denied. Manager privileges required.', 'danger')
        return redirect(url_for('index'))
    
    category = Category.query.get_or_404(cat_id)
    if not current_user.username == 'admin' and current_user.department_id != category.department_id:
        flash('Access denied. You can only manage your own department.', 'danger')
        return redirect(url_for('manage_departments'))
    
    return render_template('manage_subcategories.html', category=category)

@app.route('/api/department/<int:dept_id>/budget', methods=['POST'])
@login_required
def update_department_budget(dept_id):
    # Check if user has permission to manage this department
    if not (current_user.username == 'admin' or 
            (current_user.is_manager and current_user.department_id == dept_id)):
        return jsonify({'error': 'Unauthorized'}), 403
    
    department = Department.query.get_or_404(dept_id)
    
    try:
        data = request.get_json()
        if not data or 'budget' not in data:
            return jsonify({'error': 'Budget value is required'}), 400
            
        new_budget = float(data['budget'])
        if new_budget < 0:
            return jsonify({'error': 'Budget cannot be negative'}), 400
            
        department.budget = new_budget
        db.session.commit()
        return jsonify({'success': True})
    except ValueError:
        return jsonify({'error': 'Invalid budget value'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update budget'}), 500

@app.route('/api/category/<int:cat_id>/budget', methods=['POST'])
@login_required
def update_category_budget(cat_id):
    if not current_user.is_manager:
        return jsonify({'error': 'Unauthorized'}), 403
    category = Category.query.get_or_404(cat_id)
    data = request.get_json()
    category.budget = float(data['budget'])
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/subcategory/<int:subcat_id>/budget', methods=['POST'])
@login_required
def update_subcategory_budget(subcat_id):
    if not current_user.is_manager:
        return jsonify({'error': 'Unauthorized'}), 403
    subcategory = Subcategory.query.get_or_404(subcat_id)
    data = request.get_json()
    subcategory.budget = float(data['budget'])
    db.session.commit()
    return jsonify({'success': True})

def is_admin():
    return current_user.is_authenticated and current_user.username == 'admin'

def is_department_manager(dept_id):
    return current_user.is_manager and current_user.department_id == dept_id

def can_manage_department(dept_id):
    """Check if current user can manage the specified department"""
    if current_user.username == 'admin':
        return True
    if not current_user.is_manager:
        return False
    return dept_id in [dept.id for dept in current_user.managed_departments]

def can_view_department(dept_id):
    if current_user.username == 'admin':
        return True
    return current_user.department_id == dept_id or current_user.is_manager

@app.route('/admin/users/add', methods=['POST'])
@login_required
def add_user():
    if not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    try:
        # Get form data
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '').strip()
        department_id = request.form.get('department_id')
        managed_department_ids = request.form.getlist('managed_departments[]')
        role = request.form.get('role', 'user')
        status = request.form.get('status', 'active')
        
        print(f"Received add user request: username={username}, dept={department_id}, role={role}, status={status}, managed_depts={managed_department_ids}")
        
        # Validate input
        if not username or not email or not password:
            error_msg = 'Username, email and password are required'
            print(f"Validation error: {error_msg}")
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'error': error_msg}), 400
            flash(error_msg, 'danger')
            return redirect(url_for('manage_users'))
        
        if len(username) < 3:
            error_msg = 'Username must be at least 3 characters long'
            print(f"Validation error: {error_msg}")
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'error': error_msg}), 400
            flash(error_msg, 'danger')
            return redirect(url_for('manage_users'))
            
        if len(password) < 6:
            error_msg = 'Password must be at least 6 characters long'
            print(f"Validation error: {error_msg}")
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'error': error_msg}), 400
            flash(error_msg, 'danger')
            return redirect(url_for('manage_users'))
        
        # Check if username exists
        if User.query.filter_by(username=username).first():
            error_msg = 'Username already exists'
            print(f"Validation error: {error_msg}")
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'error': error_msg}), 400
            flash(error_msg, 'danger')
            return redirect(url_for('manage_users'))
        
        
        # Create new user
        new_user = User(
            username=username,
            email=email,
            password=password,
            department_id=department_id if department_id else None,
            is_manager=role == 'manager',
            is_admin=role == 'admin',
            is_accounting=role == 'accounting',
            status=status
        )
        
        # If user is a manager, assign managed departments
        if role == 'manager' and managed_department_ids:
            managed_departments = Department.query.filter(Department.id.in_(managed_department_ids)).all()
            new_user.managed_departments = managed_departments
        
        print(f"Adding new user to database: {new_user.username}")
        db.session.add(new_user)
        db.session.commit()
        
        # Send welcome email to new user
        send_email(
            subject='Welcome to Expense Management System',
            recipient=new_user.email,
            template=NEW_USER_TEMPLATE,
            user=new_user
        )
        
        success_msg = f'User {username} added successfully'
        print(success_msg)
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'message': success_msg}), 200
        flash(success_msg, 'success')
        
    except Exception as e:
        db.session.rollback()
        error_msg = f'Error adding user: {str(e)}'
        print(f"Exception: {error_msg}")
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'error': error_msg}), 500
        flash(error_msg, 'danger')
    
    return redirect(url_for('manage_users'))

@app.route('/manager/departments', methods=['POST'])
@login_required
def add_department():
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    name = data.get('name')
    budget = data.get('budget')
    
    if not name or budget is None:
        return jsonify({'error': 'Missing required fields'}), 400
    
    department = Department(name=name, budget=float(budget))
    db.session.add(department)
    db.session.commit()
    
    return jsonify({'success': True}), 201

@app.route('/manager/departments/<int:dept_id>', methods=['PUT'])
@login_required
def update_department(dept_id):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 403
    
    department = Department.query.get_or_404(dept_id)
    data = request.get_json()
    
    if 'name' in data:
        department.name = data['name']
    if 'budget' in data:
        department.budget = float(data['budget'])
    
    db.session.commit()
    return jsonify({'success': True})

@app.route('/manager/departments/<int:dept_id>', methods=['DELETE'])
@login_required
def delete_department(dept_id):
    if not is_admin():
        return jsonify({'error': 'Unauthorized'}), 403
    
    department = Department.query.get_or_404(dept_id)
    
    # Delete all related data
    for category in department.categories:
        for subcategory in category.subcategories:
            db.session.delete(subcategory)
        db.session.delete(category)
    
    # Update users to remove department reference
    for user in department.users:
        user.department_id = None
    
    db.session.delete(department)
    db.session.commit()
    
    return jsonify({'success': True})

@app.route('/manager/departments/<int:dept_id>/categories', methods=['POST'])
@login_required
def add_category(dept_id):
    if not can_manage_department(dept_id):
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        # Support both JSON and form data
        if request.is_json:
            data = request.get_json()
            name = data.get('name')
            budget = data.get('budget')
        else:
            name = request.form.get('name')
            budget = request.form.get('budget')
        
        print(f"Adding category: name={name}, budget={budget}, dept_id={dept_id}")
        
        if not name or budget is None:
            error_msg = 'Missing required fields'
            print(f"Error: {error_msg}")
            return jsonify({'error': error_msg}), 400
        
        try:
            budget = float(budget)
        except ValueError:
            error_msg = 'Budget must be a valid number'
            print(f"Error: {error_msg}")
            return jsonify({'error': error_msg}), 400
        
        department = Department.query.get_or_404(dept_id)
        category = Category(name=name, budget=budget, department=department)
        db.session.add(category)
        db.session.commit()
        
        success_msg = f'Category {name} added successfully'
        print(success_msg)
        return jsonify({
            'message': success_msg,
            'category': {
                'id': category.id,
                'name': category.name,
                'budget': category.budget
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        error_msg = f'Failed to add category: {str(e)}'
        print(f"Error: {error_msg}")
        return jsonify({'error': error_msg}), 500

@app.route('/manager/categories/<int:cat_id>', methods=['PUT'])
@login_required
def update_category(cat_id):
    category = Category.query.get_or_404(cat_id)
    if not can_manage_department(category.department_id):
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    if 'name' in data:
        category.name = data['name']
    if 'budget' in data:
        category.budget = float(data['budget'])
    
    db.session.commit()
    return jsonify({'success': True})

@app.route('/manager/categories/<int:cat_id>', methods=['DELETE'])
@login_required
def delete_category(cat_id):
    category = Category.query.get_or_404(cat_id)
    if not can_manage_department(category.department_id):
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Delete all subcategories first
    for subcategory in category.subcategories:
        db.session.delete(subcategory)
    
    db.session.delete(category)
    db.session.commit()
    
    return jsonify({'success': True})

@app.route('/manager/categories/<int:cat_id>/subcategories', methods=['POST'])
@login_required
def add_subcategory(cat_id):
    category = Category.query.get_or_404(cat_id)
    if not can_manage_department(category.department_id):
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    name = data.get('name')
    budget = data.get('budget')
    
    if not name or budget is None:
        return jsonify({'error': 'Missing required fields'}), 400
    
    subcategory = Subcategory(name=name, budget=float(budget), category=category)
    db.session.add(subcategory)
    db.session.commit()
    
    return jsonify({'success': True}), 201

@app.route('/manager/subcategories/<int:subcat_id>', methods=['PUT'])
@login_required
def update_subcategory(subcat_id):
    subcategory = Subcategory.query.get_or_404(subcat_id)
    if not can_manage_department(subcategory.category.department_id):
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    if 'name' in data:
        subcategory.name = data['name']
    if 'budget' in data:
        subcategory.budget = float(data['budget'])
    
    db.session.commit()
    return jsonify({'success': True})

@app.route('/manager/subcategories/<int:subcat_id>', methods=['DELETE'])
@login_required
def delete_subcategory(subcat_id):
    subcategory = Subcategory.query.get_or_404(subcat_id)
    if not can_manage_department(subcategory.category.department_id):
        return jsonify({'error': 'Unauthorized'}), 403
    
    db.session.delete(subcategory)
    db.session.commit()
    
    return jsonify({'success': True})

@app.route('/view_budget')
@login_required
def view_budget():
    if not current_user.is_manager and not current_user.username == 'admin':
        flash('Access denied. Only managers can view budgets.', 'error')
        return redirect(url_for('employee_dashboard'))
    
    departments = Department.query.all()
    return render_template('view_budget.html', departments=departments)

@app.route('/employee/budget')
@login_required
def employee_view_budget():
    if current_user.is_manager:
        return redirect(url_for('manager_dashboard'))
    
    usage_percent, monthly_expenses = current_user.get_budget_usage()
    return render_template('view_budget.html',
                         budget=current_user.home_department.budget,
                         usage_percent=usage_percent,
                         monthly_expenses=monthly_expenses,
                         current_month=datetime.now().strftime('%B %Y'))

@app.route('/expense/edit/<int:expense_id>', methods=['GET', 'POST'])
@login_required
def edit_expense(expense_id):
    # Get the expense and verify ownership and status
    expense = Expense.query.get_or_404(expense_id)
    if expense.user_id != current_user.id:
        flash('You can only edit your own expenses')
        return redirect(url_for('employee_dashboard'))
    if expense.status != 'pending':
        flash('You can only edit pending expenses')
        return redirect(url_for('employee_dashboard'))
    
    if request.method == 'POST':
        try:
            amount = float(request.form.get('amount'))
            description = request.form.get('description')
            reason = request.form.get('reason')
            expense_type = request.form.get('type')
            subcategory_id = request.form.get('subcategory_id')
            payment_method = request.form.get('payment_method')
            supplier_id = request.form.get('supplier_id')
            purchase_date_str = request.form.get('purchase_date')
            
            # Convert purchase_date string to datetime if provided
            purchase_date = None
            if purchase_date_str:
                try:
                    purchase_date = datetime.strptime(purchase_date_str, '%Y-%m-%d')
                except ValueError:
                    logging.error(f"Invalid purchase date format: {purchase_date_str}")
            
            # Verify that the subcategory belongs to the user's department
            subcategory = Subcategory.query.join(Category).filter(
                Subcategory.id == subcategory_id,
                Category.department_id == current_user.department_id
            ).first()
            
            if not subcategory:
                flash('Invalid category selected', 'error')
                return redirect(url_for('edit_expense', expense_id=expense_id))
            
            # Update expense details
            expense.amount = amount
            expense.description = description
            expense.reason = reason
            expense.type = expense_type
            expense.subcategory_id = subcategory_id
            expense.payment_method = payment_method
            expense.supplier_id = supplier_id if supplier_id else None
            expense.purchase_date = purchase_date
            
            # Handle file uploads with document processing
            for doc_type in ['quote', 'invoice', 'receipt']:
                if doc_type in request.files:
                    file = request.files[doc_type]
                    if file and file.filename != '' and allowed_file(file.filename):
                        # Delete old file if it exists
                        old_filename = getattr(expense, f"{doc_type}_filename")
                        if old_filename:
                            old_file_path = os.path.join(app.config['UPLOAD_FOLDER'], old_filename)
                            if os.path.exists(old_file_path):
                                os.remove(old_file_path)
                        
                        # Save new file
                        filename = secure_filename(f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{doc_type}_{file.filename}")
                        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                        file.save(file_path)
                        setattr(expense, f"{doc_type}_filename", filename)
                        
                        # Process document if it's an invoice or receipt
                        if doc_type in ['invoice', 'receipt']:
                            try:
                                doc_processor = DocumentProcessor()
                                process_method = getattr(doc_processor, f"process_{doc_type}")
                                doc_data = process_method(file_path)
                                logging.info(f"Extracted {doc_type} data: {doc_data}")
                                
                                # Update expense with document data if not already set by user
                                if doc_type == 'invoice' and doc_data.get('invoice_total') and not request.form.get('amount'):
                                    total = doc_data['invoice_total']
                                    expense.amount = float(total.amount if hasattr(total, 'amount') else total)
                                    
                                if doc_data.get('items') and doc_data['items'] and not request.form.get('description'):
                                    expense.description = doc_data['items'][0].get('description', '')
                                    
                                if doc_type == 'invoice' and doc_data.get('vendor_name'):
                                    expense.supplier_name = doc_data['vendor_name']
                                    
                                if doc_data.get(f"{doc_type}_date") and not request.form.get('purchase_date'):
                                    expense.purchase_date = doc_data[f"{doc_type}_date"]
                                    
                            except Exception as e:
                                logging.error(f"Error processing {doc_type}: {str(e)}")

            db.session.commit()
            flash('Expense updated successfully')
            return redirect(url_for('employee_dashboard'))
            
        except Exception as e:
            logging.error(f"Error updating expense: {str(e)}")
            flash('Error updating expense. Please try again.', 'error')
            return redirect(url_for('edit_expense', expense_id=expense_id))
    
    # Get subcategories from user's department for the form
    subcategories = Subcategory.query.join(Category).filter(
        Category.department_id == current_user.department_id
    ).all()
    
    # Get active suppliers for the form
    suppliers = Supplier.query.filter_by(status='active').order_by(Supplier.name).all()
    
    return render_template('edit_expense.html', 
                         expense=expense, 
                         subcategories=subcategories,
                         suppliers=suppliers)

@app.route('/expense/<int:expense_id>/delete', methods=['POST'])
@login_required
def delete_expense(expense_id):
    # Get the expense and verify ownership and status
    expense = Expense.query.get_or_404(expense_id)
    if expense.user_id != current_user.id:
        flash('You can only delete your own expenses')
        return redirect(url_for('employee_dashboard'))
    if expense.status != 'pending':
        flash('You can only delete pending expenses')
        return redirect(url_for('employee_dashboard'))
    
    # Delete associated files
    if expense.quote_filename:
        try:
            os.remove(os.path.join(app.config['UPLOAD_FOLDER'], expense.quote_filename))
        except OSError:
            pass
    
    if expense.invoice_filename:
        try:
            os.remove(os.path.join(app.config['UPLOAD_FOLDER'], expense.invoice_filename))
        except OSError:
            pass
    
    if expense.receipt_filename:
        try:
            os.remove(os.path.join(app.config['UPLOAD_FOLDER'], expense.receipt_filename))
        except OSError:
            pass
    
    db.session.delete(expense)
    db.session.commit()
    
    flash('Expense deleted successfully')
    return redirect(url_for('employee_dashboard'))

@app.route('/change_password', methods=['GET', 'POST'])
@login_required
def change_password():
    if request.method == 'POST':
        current_password = request.form.get('current_password')
        new_password = request.form.get('new_password')
        confirm_password = request.form.get('confirm_password')
        
        # Verify current password
        if current_user.password != current_password:  # In production, use proper password hashing
            flash('Current password is incorrect')
            return redirect(url_for('change_password'))
        
        # Verify new password matches confirmation
        if new_password != confirm_password:
            flash('New passwords do not match')
            return redirect(url_for('change_password'))
        
        # Update password
        current_user.password = new_password  # In production, use proper password hashing
        db.session.commit()
        
        flash('Password changed successfully', 'success')
        return redirect(url_for('change_password'))
    
    return render_template('change_password.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/admin/users')
@login_required
def manage_users():
    if not current_user.is_admin:
        flash('Access denied. Admin privileges required.', 'danger')
        return redirect(url_for('index'))
    
    # Get query parameters for filtering
    search = request.args.get('search', '').strip()
    department_filter = request.args.get('department', 'all')
    role_filter = request.args.get('role', 'all')
    
    # Base query
    query = User.query
    
    # Apply filters
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(User.username.like(search_pattern))
    
    if department_filter != 'all':
        query = query.filter(User.department_id == department_filter)
    
    if role_filter == 'admin':
        query = query.filter(User.is_admin == True)
    elif role_filter == 'manager':
        query = query.filter(User.is_manager == True)
    elif role_filter == 'employee':
        query = query.filter(User.is_admin == False, User.is_manager == False)
    
    # Get users and departments
    users = query.order_by(User.username).all()
    departments = Department.query.order_by(Department.name).all()
    
    return render_template('manage_users.html', 
                         users=users, 
                         departments=departments,
                         search=search,
                         department_filter=department_filter,
                         role_filter=role_filter)

@app.route('/admin/users/<int:user_id>/info')
@login_required
def get_user_info(user_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    user = User.query.get_or_404(user_id)
    return jsonify({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'is_manager': user.is_manager,
        'is_admin': user.is_admin,
        'department_id': user.department_id,
        'status': user.status,
        'managed_departments': [dept.id for dept in user.managed_departments]
    })

@app.route('/admin/users/<int:user_id>/edit', methods=['POST'])
@login_required
def edit_user(user_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    try:
        user = User.query.get_or_404(user_id)
        
        # Check if user is editing their own admin account
        is_self_admin = user.id == current_user.id and user.is_admin
        
        # Update basic info
        user.username = request.form.get('username', user.username)
        user.email = request.form.get('email', user.email)
        
        # Prevent admin from changing their home department
        if is_self_admin and request.form.get('department_id') != str(user.department_id):
            return jsonify({'error': 'Admin users cannot change their home department'}), 400
        
        user.department_id = request.form.get('department_id') or None
        user.status = request.form.get('status', 'active')
        
        # Update role
        role = request.form.get('role', 'user')
        
        # Prevent admin from changing their role to non-admin
        if is_self_admin and role != 'admin':
            return jsonify({'error': 'Admin users cannot change their role to non-admin'}), 400
            
        user.is_admin = role == 'admin'
        user.is_manager = role == 'manager'
        user.is_accounting = role == 'accounting'
        
        # Update managed departments if user is a manager
        if role == 'manager':
            managed_dept_ids = request.form.getlist('managed_departments[]')
            managed_departments = Department.query.filter(Department.id.in_(managed_dept_ids)).all()
            user.managed_departments = managed_departments
        else:
            user.managed_departments = []  # Clear managed departments if not a manager
        
        db.session.commit()
        return jsonify({'message': 'User updated successfully'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error updating user: {str(e)}'}), 500

@app.route('/admin/users/<int:user_id>/delete', methods=['POST'])
@login_required
def delete_user(user_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    try:
        if user_id == current_user.id:
            return jsonify({'error': 'Cannot delete your own account'}), 400
        
        user = User.query.get_or_404(user_id)
        username = user.username
        
        # Check if user has any expenses
        if user.submitted_expenses:
            return jsonify({'error': 'Cannot delete user with existing expenses. Please delete or reassign their expenses first.'}), 400
        
        db.session.delete(user)
        db.session.commit()
        
        return jsonify({'message': f'User {username} deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error deleting user: {str(e)}'}), 500

@app.route('/admin/expense/<int:expense_id>/edit', methods=['GET', 'POST'])
@login_required
def admin_edit_expense(expense_id):
    if current_user.username != 'admin':
        flash('Only admin can edit expenses', 'error')
        return redirect(url_for('manager_dashboard'))
    
    expense = Expense.query.get_or_404(expense_id)
    
    if request.method == 'POST':
        expense.amount = float(request.form['amount'])
        expense.description = request.form['description']
        expense.reason = request.form['reason']
        expense.type = request.form['type']
        expense.subcategory_id = int(request.form['subcategory_id'])
        expense.status = request.form['status']  # Add status field
        
        # Reset handler info if status changed to pending
        if expense.status == 'pending':
            expense.handler = None
            expense.handled_at = None
        elif expense.status in ['approved', 'rejected'] and not expense.handler:
            # If changing to approved/rejected and no handler set, set current admin as handler
            expense.handler = current_user
            expense.handled_at = datetime.now(pytz.utc).replace(microsecond=0)
        
        # Handle file uploads if provided
        if 'quote' in request.files:
            file = request.files['quote']
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                expense.quote_filename = filename

        if 'invoice' in request.files:
            file = request.files['invoice']
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                expense.invoice_filename = filename

        if 'receipt' in request.files:
            file = request.files['receipt']
            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                expense.receipt_filename = filename
        
        db.session.commit()
        flash('Expense updated successfully', 'success')
        return redirect(url_for('expense_history'))

    # Get all subcategories for the dropdown
    subcategories = db.session.query(
        Subcategory, 
        Department.name.label('dept_name'),
        Category.name.label('cat_name'),
        Subcategory.name.label('subcat_name'),
        Subcategory.id.label('subcat_id')
    ).select_from(Subcategory)\
    .join(Category)\
    .join(Department)\
    .all()
    
    return render_template('admin_edit_expense.html', 
                         expense=expense, 
                         subcategories=subcategories)

@app.route('/admin/expense/<int:expense_id>/delete', methods=['POST'])
@login_required
def admin_delete_expense(expense_id):
    if current_user.username != 'admin':
        flash('Only admin can delete expenses', 'error')
        return redirect(url_for('manager_dashboard'))
    
    expense = Expense.query.get_or_404(expense_id)
    
    # Delete associated files
    if expense.quote_filename:
        try:
            os.remove(os.path.join(app.config['UPLOAD_FOLDER'], expense.quote_filename))
        except OSError:
            pass
    
    if expense.invoice_filename:
        try:
            os.remove(os.path.join(app.config['UPLOAD_FOLDER'], expense.invoice_filename))
        except OSError:
            pass
    
    if expense.receipt_filename:
        try:
            os.remove(os.path.join(app.config['UPLOAD_FOLDER'], expense.receipt_filename))
        except OSError:
            pass
    
    db.session.delete(expense)
    db.session.commit()
    
    flash('Expense deleted successfully', 'success')
    return redirect(url_for('manager_dashboard'))

@app.route('/export_accounting_excel')
@login_required
def export_accounting_excel():
    expenses = Expense.query.all()
    
    data = []
    for expense in expenses:
        data.append({
            'Date': expense.date.strftime('%d/%m/%Y'),
            'Employee': expense.submitter.username,
            'Department': expense.submitter.home_department.name,
            'Description': expense.description,
            'Reason': expense.reason,
            'Type': expense.type,
            'Amount': expense.amount,
            'Handled By': expense.handler.username if expense.handler else '-',
            'Date Handled': expense.handled_at.strftime('%d/%m/%Y') if expense.handled_at else '-',
            'Supplier Name': expense.supplier.name if expense.supplier else '-',
            'Tax ID': expense.supplier.tax_id if expense.supplier else '-',
            'Date of Purchase': expense.purchase_date.strftime('%d/%m/%Y') if expense.purchase_date else '-',
            'Payment Status': 'Paid' if expense.is_paid else 'Pending Payment'
        })
    
    df = pd.DataFrame(data)
    
    # Create Excel file in memory
    output = BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, sheet_name='Expenses', index=False)
        worksheet = writer.sheets['Expenses']
        
        # Auto-adjust columns width
        for idx, col in enumerate(df.columns):
            series = df[col]
            max_len = max(
                series.astype(str).map(len).max(),
                len(str(series.name))
            ) + 1
            worksheet.set_column(idx, idx, max_len)
    
    output.seek(0)
    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=f'accounting_export_{datetime.now().strftime("%Y%m%d")}.xlsx'
    )

@app.route('/test_email')
def test_email():
    try:
        print("Attempting to send test email...")
        send_email(
            subject='Test Email from SendGrid',
            recipient='sabag.tal@gmail.com',  # Replace with the email where you want to receive the test
            template="""
            <h2>Test Email from SendGrid</h2>
            <p>This is a test email from your Expense Management System using SendGrid.</p>
            <p>If you received this email, the email notification system is working correctly!</p>
            <p>Time sent: {{ time }}</p>
            """,
            time=datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        )
        return 'Test email sent! Please check your inbox.'
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        import traceback
        traceback.print_exc()
        return f'Error sending email: {str(e)}'

@app.route('/accounting_dashboard')
@login_required
def accounting_dashboard():
    if not current_user.is_accounting:
        flash('Access denied. You must be an accounting user to view this page.', 'danger')
        return redirect(url_for('index'))
    
    # Get all approved expenses
    expenses = Expense.query.filter_by(status='approved').order_by(Expense.date.desc()).all()
    
    return render_template('accounting_dashboard.html', expenses=expenses)

@app.route('/mark_expense_paid/<int:expense_id>', methods=['POST'])
@login_required
def mark_expense_paid(expense_id):
    if not current_user.is_accounting:
        return jsonify({'error': 'Access denied'}), 403
    
    expense = Expense.query.get_or_404(expense_id)
    if expense.status != 'approved':
        return jsonify({'error': 'Only approved expenses can be marked as paid'}), 400
    
    expense.is_paid = True
    expense.paid_by_id = current_user.id
    expense.paid_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({'success': True})

@app.route('/mark_expense_unpaid/<int:expense_id>', methods=['POST'])
@login_required
def mark_expense_unpaid(expense_id):
    if not current_user.is_accounting:
        return jsonify({'error': 'Access denied'}), 403
    
    expense = Expense.query.get_or_404(expense_id)
    if not expense.is_paid:
        return jsonify({'error': 'Expense is already marked as unpaid'}), 400
    
    expense.is_paid = False
    expense.paid_by_id = None
    expense.paid_at = None
    db.session.commit()
    
    return jsonify({'success': True})

@app.route('/manage_suppliers')
@login_required
def manage_suppliers():
    if not current_user.is_admin and not current_user.is_accounting:
        flash('Access denied.', 'error')
        return redirect(url_for('employee_dashboard'))
    suppliers = Supplier.query.order_by(Supplier.name).all()
    return render_template('manage_suppliers.html', suppliers=suppliers)

@app.route('/add_supplier', methods=['GET', 'POST'])
@login_required
def add_supplier():
    if request.method == 'GET':
        return render_template('add_supplier.html')
    
    try:
        name = request.form['name']
        email = request.form.get('email')
        phone = request.form.get('phone')
        address = request.form.get('address')
        tax_id = request.form.get('tax_id')
        bank_name = request.form.get('bank_name')
        bank_account_number = request.form.get('bank_account_number')
        bank_branch = request.form.get('bank_branch')
        bank_swift = request.form.get('bank_swift')
        notes = request.form.get('notes')
        status = request.form.get('status', 'active')

        supplier = Supplier(
            name=name,
            email=email,
            phone=phone,
            address=address,
            tax_id=tax_id,
            bank_name=bank_name,
            bank_account_number=bank_account_number,
            bank_branch=bank_branch,
            bank_swift=bank_swift,
            notes=notes,
            status=status
        )

        db.session.add(supplier)
        db.session.commit()

        flash('Supplier added successfully!', 'success')
        if current_user.is_admin or current_user.is_accounting:
            return redirect(url_for('manage_suppliers'))
        return redirect(url_for('submit_expense'))
    except Exception as e:
        db.session.rollback()
        flash(f'Error adding supplier: {str(e)}', 'error')
        return redirect(url_for('add_supplier'))

@app.route('/get_supplier/<int:supplier_id>')
@login_required
def get_supplier(supplier_id):
    supplier = Supplier.query.get_or_404(supplier_id)
    return jsonify({
        'name': supplier.name,
        'email': supplier.email,
        'phone': supplier.phone,
        'address': supplier.address,
        'tax_id': supplier.tax_id,
        'bank_name': supplier.bank_name,
        'bank_account_number': supplier.bank_account_number,
        'bank_branch': supplier.bank_branch,
        'bank_swift': supplier.bank_swift,
        'notes': supplier.notes,
        'status': supplier.status
    })

@app.route('/edit_supplier/<int:supplier_id>', methods=['POST'])
@login_required
def edit_supplier(supplier_id):
    try:
        supplier = Supplier.query.get_or_404(supplier_id)
        
        supplier.name = request.form['name']
        supplier.email = request.form.get('email')
        supplier.phone = request.form.get('phone')
        supplier.address = request.form.get('address')
        supplier.tax_id = request.form.get('tax_id')
        supplier.bank_name = request.form.get('bank_name')
        supplier.bank_account_number = request.form.get('bank_account_number')
        supplier.bank_branch = request.form.get('bank_branch')
        supplier.bank_swift = request.form.get('bank_swift')
        supplier.notes = request.form.get('notes')
        supplier.status = request.form.get('status', 'active')
        supplier.updated_at = datetime.utcnow()

        db.session.commit()
        flash('Supplier updated successfully!', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Error updating supplier: {str(e)}', 'error')

    return redirect(url_for('manage_suppliers'))

@app.route('/delete_supplier/<int:supplier_id>')
@login_required
def delete_supplier(supplier_id):
    try:
        supplier = Supplier.query.get_or_404(supplier_id)
        
        # Check if supplier has any associated expenses
        if supplier.expenses:
            # Instead of deleting, mark as inactive
            supplier.status = 'inactive'
            flash('Supplier has associated expenses. Marked as inactive instead of deleting.', 'success')
        else:
            db.session.delete(supplier)
            flash('Supplier deleted successfully!', 'success')
        
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        flash(f'Error deleting supplier: {str(e)}', 'error')

    return redirect(url_for('manage_suppliers'))

from services.document_processor import DocumentProcessor

processor = DocumentProcessor()

def process_quote_endpoint(document_path):
    """
    Endpoint to process a quote document.
    
    Args:
        document_path (str): Path to the quote document.
    """
    try:
        quote_data = processor.process_quote(document_path)
        return quote_data
    except Exception as e:
        return {"error": str(e)}

@app.route('/api/expense/process-expense', methods=['POST'])
@login_required
def process_expense_document():
    if 'document' not in request.files:
        return jsonify({'error': 'No document provided'}), 400
    
    file = request.files['document']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        try:
            # Save file temporarily
            filename = secure_filename(f"temp_{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}")
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            # Process the document
            doc_processor = DocumentProcessor()
            doc_data = doc_processor.process_invoice(filepath)
            
            # Clean up temporary file
            os.remove(filepath)
            
            return jsonify(doc_data)
        except Exception as e:
            logging.error(f"Error processing document: {str(e)}")
            return jsonify({'error': str(e)}), 500
    
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/api/expense/process-receipt', methods=['POST'])
@login_required
def process_receipt_document():
    if 'document' not in request.files:
        return jsonify({'error': 'No document provided'}), 400
    
    file = request.files['document']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        try:
            # Save file temporarily
            filename = secure_filename(f"temp_{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}")
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            # Process the receipt
            doc_processor = DocumentProcessor()
            receipt_data = doc_processor.process_receipt(filepath)
            
            # Clean up temporary file
            os.remove(filepath)
            
            return jsonify(receipt_data)
        except Exception as e:
            logging.error(f"Error processing receipt: {str(e)}")
            return jsonify({'error': str(e)}), 500
    
    return jsonify({'error': 'Invalid file type'}), 400

if __name__ == '__main__':
    app.run(debug=True)
