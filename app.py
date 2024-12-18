from flask import Flask, render_template, request, redirect, url_for, flash, send_file, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from datetime import datetime
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///expenses.db'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# Create uploads directory if it doesn't exist
if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])

ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

class Department(db.Model):
    __tablename__ = 'department'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    budget = db.Column(db.Float, default=0.0)
    users = db.relationship('User', backref='department', lazy=True)
    categories = db.relationship('Category', backref='department', lazy=True)

class Category(db.Model):
    __tablename__ = 'category'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    budget = db.Column(db.Float, default=0.0)
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'), nullable=False)
    subcategories = db.relationship('Subcategory', backref='category', lazy=True)

class Subcategory(db.Model):
    __tablename__ = 'subcategory'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    budget = db.Column(db.Float, default=0.0)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=False)
    expenses = db.relationship('Expense', backref='subcategory', lazy=True)

class User(UserMixin, db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    is_manager = db.Column(db.Boolean, default=False)
    is_admin = db.Column(db.Boolean, default=False)
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'))
    status = db.Column(db.String(20), default='active')  # active, inactive, pending
    
    # Relationship for expenses where user is the submitter
    submitted_expenses = db.relationship('Expense',
                                       primaryjoin='User.id==Expense.user_id',
                                       backref='submitter',
                                       lazy=True)
    
    # Relationship for expenses where user is the manager
    handled_expenses = db.relationship('Expense',
                                     primaryjoin='User.id==Expense.manager_id',
                                     backref='handler',
                                     lazy=True)

    def get_monthly_expenses(self, year, month):
        """Get total approved expenses for a specific month"""
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        
        total = db.session.query(db.func.sum(Expense.amount))\
            .filter(Expense.user_id == self.id,
                   Expense.status == 'approved',
                   Expense.date >= start_date,
                   Expense.date < end_date).scalar()
        return total or 0.0

    def get_budget_usage(self):
        """Get current month's budget usage"""
        current_date = datetime.now()
        monthly_expenses = self.get_monthly_expenses(current_date.year, current_date.month)
        if self.department.budget <= 0:
            return 0, monthly_expenses
        usage_percent = (monthly_expenses / self.department.budget) * 100
        return usage_percent, monthly_expenses

class Expense(db.Model):
    __tablename__ = 'expense'
    id = db.Column(db.Integer, primary_key=True)
    amount = db.Column(db.Float, nullable=False)
    description = db.Column(db.String(200))
    reason = db.Column(db.String(500))
    type = db.Column(db.String(50), nullable=False, default='needs_approval')  # New field
    date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    status = db.Column(db.String(20), default='pending')
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    subcategory_id = db.Column(db.Integer, db.ForeignKey('subcategory.id'), nullable=False)
    quote_filename = db.Column(db.String(255))
    invoice_filename = db.Column(db.String(255))
    receipt_filename = db.Column(db.String(255))
    manager_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    handled_at = db.Column(db.DateTime, nullable=True)

# Initialize database
with app.app_context():
    db.create_all()
    
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
                password='admin123',
                is_manager=True,
                is_admin=True,
                department=rd_dept
            )
            db.session.add(admin_user)
            db.session.commit()
            print("Admin user created successfully")
    except Exception as e:
        print(f"Error initializing database: {str(e)}")
        db.session.rollback()

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

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
            login_user(user)
            return redirect(url_for('index'))
        flash('Invalid username or password')
    return render_template('login.html')

@app.route('/employee/dashboard')
@login_required
def employee_dashboard():
    if current_user.is_manager:
        return redirect(url_for('manager_dashboard'))
    expenses = current_user.submitted_expenses
    return render_template('employee_dashboard.html', expenses=expenses)

@app.route('/expense/submit', methods=['GET', 'POST'])
@login_required
def submit_expense():
    if request.method == 'POST':
        amount = float(request.form.get('amount'))
        description = request.form.get('description')
        reason = request.form.get('reason')
        expense_type = request.form.get('type')
        subcategory_id = request.form.get('subcategory_id')
        
        # Verify that the subcategory belongs to the user's department
        subcategory = Subcategory.query.join(Category).filter(
            Subcategory.id == subcategory_id,
            Category.department_id == current_user.department_id
        ).first()
        
        if not subcategory:
            flash('Invalid category selected', 'error')
            return redirect(url_for('submit_expense'))
        
        # Create new expense
        expense = Expense(
            amount=amount,
            description=description,
            reason=reason,
            type=expense_type,
            user_id=current_user.id,
            subcategory_id=subcategory_id
        )

        # Handle file uploads
        if 'quote' in request.files:
            file = request.files['quote']
            if file and allowed_file(file.filename):
                filename = secure_filename(f"{current_user.username}_quote_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}")
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                expense.quote_filename = filename

        if 'invoice' in request.files:
            file = request.files['invoice']
            if file and allowed_file(file.filename):
                filename = secure_filename(f"{current_user.username}_invoice_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}")
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                expense.invoice_filename = filename

        if 'receipt' in request.files:
            file = request.files['receipt']
            if file and allowed_file(file.filename):
                filename = secure_filename(f"{current_user.username}_receipt_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}")
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                expense.receipt_filename = filename

        # Set status based on type
        if expense_type == 'auto_approved':
            expense.status = 'approved'
            expense.handled_at = datetime.utcnow()
            expense.manager_id = None  # Auto-approved doesn't need manager
        elif expense_type == 'pre_approved':
            expense.status = 'approved'
            expense.handled_at = datetime.utcnow()
            # Find a manager from the user's department
            manager = User.query.filter_by(department_id=current_user.department_id, is_manager=True).first()
            if manager:
                expense.manager_id = manager.id
        else:
            expense.status = 'pending'

        db.session.add(expense)
        db.session.commit()
        
        flash('Expense submitted successfully')
        return redirect(url_for('employee_dashboard'))
    
    subcategories = Subcategory.query.join(Category).filter(
        Category.department_id == current_user.department_id
    ).all()
    
    return render_template('submit_expense.html', subcategories=subcategories)

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
    
    if current_user.is_manager or expense.user_id == current_user.id:
        return send_file(os.path.join(app.config['UPLOAD_FOLDER'], filename),
                        as_attachment=True)
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
        Expense.status == 'approved'
    ).group_by(Department.id).subquery()

    cat_expenses = db.session.query(
        Category.id,
        db.func.sum(Expense.amount).label('total_expenses')
    ).join(
        Subcategory, Category.id == Subcategory.category_id
    ).join(
        Expense, Subcategory.id == Expense.subcategory_id
    ).filter(
        Expense.status == 'approved'
    ).group_by(Category.id).subquery()

    subcat_expenses = db.session.query(
        Subcategory.id,
        db.func.sum(Expense.amount).label('total_expenses')
    ).join(
        Expense, Subcategory.id == Expense.subcategory_id
    ).filter(
        Expense.status == 'approved'
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
            ).all()
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
            ).all()
    
    return render_template('manager_dashboard.html', expenses=pending_expenses)

@app.route('/manager/history')
@login_required
def expense_history():
    if not current_user.is_manager:
        return redirect(url_for('employee_dashboard'))
    
    # Get filter parameters
    status = request.args.get('status', 'all')
    employee = request.args.get('employee', 'all')
    department = request.args.get('department', 'all')
    
    # Base query with joins
    query = Expense.query.join(User, Expense.user_id == User.id)
    
    # If not admin, only show expenses from manager's department
    if current_user.username != 'admin':
        query = query.filter(User.department_id == current_user.department_id)
    
    # Apply filters
    if status != 'all':
        query = query.filter(Expense.status == status)
    if employee != 'all':
        query = query.filter(Expense.user_id == employee)
    if department != 'all' and current_user.username == 'admin':
        # Only admin can filter by different departments
        query = query.filter(User.department_id == department)
    
    # Get all employees for the filter dropdown
    if current_user.username == 'admin':
        employees = User.query.filter_by(is_manager=False).all()
        departments = Department.query.all()
    else:
        # Only show employees from manager's department
        employees = User.query.filter_by(
            is_manager=False,
            department_id=current_user.department_id
        ).all()
        # Only show manager's department
        departments = [current_user.department] if current_user.department else []
    
    # Get expenses with sorting
    expenses = query.order_by(Expense.date.desc()).all()
    
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
        message = 'Expense rejected successfully'
    else:
        flash('Invalid action', 'danger')
        return redirect(url_for('manager_dashboard'))
    
    # Record manager information
    expense.manager_id = current_user.id
    expense.handled_at = datetime.utcnow()
    
    try:
        db.session.commit()
        flash(message, 'success')
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
        departments = Department.query.filter_by(id=current_user.department_id).all()
    
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
    if not current_user.is_manager:
        return jsonify({'error': 'Unauthorized'}), 403
    department = Department.query.get_or_404(dept_id)
    data = request.get_json()
    department.budget = float(data['budget'])
    db.session.commit()
    return jsonify({'success': True})

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
    if current_user.username == 'admin':
        return True
    return current_user.is_manager and current_user.department_id == dept_id

def can_view_department(dept_id):
    if current_user.username == 'admin':
        return True
    return current_user.department_id == dept_id or current_user.is_manager

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
                         budget=current_user.department.budget,
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
        amount = float(request.form.get('amount'))
        description = request.form.get('description')
        reason = request.form.get('reason')
        subcategory_id = request.form.get('subcategory_id')
        
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
        expense.subcategory_id = subcategory_id
        
        # Handle file uploads
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

        db.session.commit()
        flash('Expense updated successfully')
        return redirect(url_for('employee_dashboard'))
    
    # Get subcategories from user's department for the form
    subcategories = Subcategory.query.join(Category).filter(
        Category.department_id == current_user.department_id
    ).all()
    
    return render_template('edit_expense.html', expense=expense, subcategories=subcategories)

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

@app.route('/admin/users/add', methods=['POST'])
@login_required
def add_user():
    if not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    try:
        # Get form data
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        department_id = request.form.get('department_id')
        role = request.form.get('role', 'user')
        status = request.form.get('status', 'active')
        
        print(f"Received add user request: username={username}, dept={department_id}, role={role}, status={status}")
        
        # Validate input
        if not username or not password:
            error_msg = 'Username and password are required'
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
            password=password,  # In production, use proper password hashing
            department_id=department_id if department_id else None,
            is_manager=role == 'manager',
            is_admin=role == 'admin',
            status=status
        )
        
        print(f"Adding new user to database: {new_user.username}")
        db.session.add(new_user)
        db.session.commit()
        
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

@app.route('/admin/users/<int:user_id>/edit', methods=['POST'])
@login_required
def edit_user(user_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    try:
        user = User.query.get_or_404(user_id)
        
        # Get form data
        new_username = request.form.get('username', '').strip()
        new_password = request.form.get('password', '').strip()
        new_department_id = request.form.get('department_id')
        new_role = request.form.get('role', 'user')
        new_status = request.form.get('status', 'active')
        
        # Validate username
        if not new_username:
            flash('Username cannot be empty', 'danger')
            return redirect(url_for('manage_users'))
            
        if len(new_username) < 3:
            flash('Username must be at least 3 characters long', 'danger')
            return redirect(url_for('manage_users'))
        
        # Check if new username exists (if changed)
        if new_username != user.username and User.query.filter_by(username=new_username).first():
            flash('Username already exists', 'danger')
            return redirect(url_for('manage_users'))
        
        # Update user
        user.username = new_username
        if new_password:
            if len(new_password) < 6:
                flash('Password must be at least 6 characters long', 'danger')
                return redirect(url_for('manage_users'))
            user.password = new_password  # In production, use proper password hashing
        
        user.department_id = new_department_id if new_department_id else None
        user.is_manager = new_role == 'manager'
        user.is_admin = new_role == 'admin'
        user.status = new_status
        
        db.session.commit()
        flash(f'User {user.username} updated successfully', 'success')
        
    except Exception as e:
        db.session.rollback()
        flash(f'Error updating user: {str(e)}', 'danger')
    
    return redirect(url_for('manage_users'))

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
        expenses = Expense.query.filter_by(user_id=user_id).all()
        if expenses:
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
            expense.handled_at = datetime.now()
        
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
    subcategories = Subcategory.query.join(Category).join(Department)\
        .add_columns(
            Department.name.label('dept_name'),
            Category.name.label('cat_name'),
            Subcategory.name.label('subcat_name'),
            Subcategory.id.label('subcat_id')
        ).all()
    
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

if __name__ == '__main__':
    app.run(debug=True)
