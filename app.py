from flask import Flask, render_template, request, redirect, url_for, flash, send_file, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.sql import func
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from datetime import datetime, timedelta
import os
from services.document_processor import DocumentProcessor
from werkzeug.utils import secure_filename
from utils.email_sender import send_email, EXPENSE_SUBMITTED_TEMPLATE, EXPENSE_STATUS_UPDATE_TEMPLATE, NEW_USER_TEMPLATE, EXPENSE_REQUEST_CONFIRMATION_TEMPLATE, NEW_REQUEST_MANAGER_NOTIFICATION_TEMPLATE, EXPENSE_REQUEST_REJECTION_TEMPLATE, PASSWORD_CHANGE_CONFIRMATION_TEMPLATE, EXPENSE_PAYMENT_NOTIFICATION_TEMPLATE
import logging
import pytz
from routes.expense import expense_bp
from flask_migrate import Migrate
from config import Config
from io import BytesIO
import pandas as pd
from models import db, Department, Category, Subcategory, User, Supplier, Expense, CreditCard
import msal
import requests
from dateutil.relativedelta import relativedelta

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
def format_currency(value, currency='ILS'):
    if isinstance(value, (int, float)):
        if currency == 'USD':
            return f"${value:,.2f}"
        else:  # Default to ILS
            return f"₪{value:,.2f}"
    return value

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

def _build_msal_app(cache=None):
    return msal.ConfidentialClientApplication(
        app.config['AZURE_AD_CLIENT_ID'],
        authority=app.config['AZURE_AD_AUTHORITY'],
        client_credential=app.config['AZURE_AD_CLIENT_SECRET'],
        token_cache=cache
    )

def _get_token_from_cache(scopes):
    cache = session.get('token_cache')
    if cache:
        cca = _build_msal_app(cache)
        accounts = cca.get_accounts()
        if accounts:
            result = cca.acquire_token_silent(scopes, account=accounts[0])
            return result

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))

    # Check if this is an Azure AD login request
    if request.args.get('sso'):
        try:
            # Get the full URL for the callback
            redirect_uri = url_for('auth_callback', _external=True, _scheme='https')
            logging.info(f"Redirect URI: {redirect_uri}")
            
            # Initialize MSAL flow with only the required Graph API scope
            msal_app = _build_msal_app()
            flow = msal_app.initiate_auth_code_flow(
                scopes=['https://graph.microsoft.com/User.Read'],
                redirect_uri=redirect_uri
            )
            logging.info(f"MSAL Flow initiated")
            
            session["flow"] = flow
            return redirect(flow["auth_uri"])
            
        except Exception as e:
            logging.error(f"Error initiating Azure AD flow: {str(e)}", exc_info=True)
            flash('Error initiating login. Please try again.')
            return redirect(url_for('login'))

    # Handle traditional login
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

@app.route('/auth/callback')
def auth_callback():
    if not session.get("flow"):
        logging.error("No flow found in session")
        return redirect(url_for('login'))
    
    try:
        logging.info(f"Auth callback received. Args: {request.args}")
        
        result = _build_msal_app().acquire_token_by_auth_code_flow(
            session.get("flow"),
            request.args,
            scopes=['https://graph.microsoft.com/User.Read']  # Only request the Graph API scope here
        )
        logging.info("Token acquired successfully")

        if "error" in result:
            error_msg = f"Error during login: {result.get('error_description', 'Unknown error')}"
            logging.error(error_msg)
            flash(error_msg)
            return redirect(url_for('login'))

        # Get user info from Microsoft Graph
        graph_response = requests.get(
            'https://graph.microsoft.com/v1.0/me',
            headers={'Authorization': f"Bearer {result['access_token']}"}
        )
        logging.info(f"Graph API response status: {graph_response.status_code}")
        
        if not graph_response.ok:
            logging.error(f"Graph API error: {graph_response.text}")
            flash('Could not retrieve user information')
            return redirect(url_for('login'))
            
        graph_data = graph_response.json()
        logging.info("User info retrieved from Graph API")

        # Find or create user based on email
        email = graph_data.get('mail')
        if not email:
            email = graph_data.get('userPrincipalName')  # Use userPrincipalName as fallback
            logging.info(f"Using userPrincipalName as email: {email}")
        
        if not email:
            logging.error(f"No email found in graph data: {graph_data}")
            flash('Could not retrieve email from Microsoft account')
            return redirect(url_for('login'))
            
        user = User.query.filter_by(email=email).first()
        
        if not user:
            logging.info(f"Creating new user for email: {email}")
            # Create new user with Azure AD details
            user = User(
                username=email.split('@')[0],
                email=email,
                password=None,  # No password for SSO users
                is_manager=False,
                is_admin=False,
                status='active'
            )
            db.session.add(user)
            db.session.commit()
            logging.info(f"New user created with ID: {user.id}")

        if user.status == 'inactive':
            logging.warning(f"Inactive user attempted login: {email}")
            flash('Your account is inactive. Please contact your administrator.')
            return redirect(url_for('login'))

        login_user(user)
        session['token_cache'] = result.get('token_cache')
        logging.info(f"User {email} logged in successfully")
        
        if user.is_accounting:
            return redirect(url_for('accounting_dashboard'))
        return redirect(url_for('index'))
        
    except Exception as e:
        logging.error(f"Error in auth callback: {str(e)}", exc_info=True)
        flash('An error occurred during login. Please try again.')
        return redirect(url_for('login'))

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
        
        # Replace limited subcategory loading with all subcategories from the user's department
        subcategories = Subcategory.query.join(Category).filter(
            Category.department_id == current_user.department_id
        ).all()
        
        suppliers = Supplier.query.filter_by(status='active').order_by(Supplier.name).all()
        credit_cards = CreditCard.query.filter_by(status='active').order_by(CreditCard.last_four_digits).all()
        
        return render_template('submit_expense.html', 
                            categories=categories, 
                            subcategories=subcategories,
                            suppliers=suppliers,
                            credit_cards=credit_cards)
    
    # Handle POST request
    try:
        # Get form data
        amount = float(request.form['amount'])
        description = request.form['description']
        reason = request.form.get('reason', '')
        expense_type = request.form.get('type', 'needs_approval')
        subcategory_id = int(request.form['subcategory_id'])
        payment_method = request.form.get('payment_method', 'credit')
        supplier_id = request.form.get('supplier_id', None)
        currency = request.form.get('currency', 'ILS')  # Get currency from form
        payment_due_date = request.form.get('payment_due_date', 'end_of_month')  # Get payment due date
        invoice_date_str = request.form.get('invoice_date')
        invoice_date = datetime.strptime(invoice_date_str, '%Y-%m-%d') if invoice_date_str else None

        # Check for duplicate submissions in the last minute
        time_threshold = datetime.now() - timedelta(minutes=1)
        recent_expense = Expense.query.filter(
            Expense.user_id == current_user.id,
            Expense.amount == amount,
            Expense.description == description,
            Expense.subcategory_id == subcategory_id,
            Expense.date >= time_threshold
        ).first()
        
        if recent_expense:
            flash('A similar expense was just submitted. Please wait a moment before submitting again.', 'warning')
            return redirect(url_for('employee_dashboard'))

        if not supplier_id or supplier_id == '':
            supplier_id = None
        else:
            supplier_id = int(supplier_id)
        
        # Convert purchase_date string to datetime if provided
        purchase_date = None
        if request.form.get('purchase_date'):
            try:
                purchase_date = datetime.strptime(request.form['purchase_date'], '%Y-%m-%d')
            except ValueError:
                logging.error(f"Invalid purchase date format: {request.form['purchase_date']}")
                flash('Invalid purchase date format. Please use DD/MM/YYYY format.', 'error')
                return redirect(url_for('submit_expense'))
        
        # Handle supplier
        if request.form.get('supplier_name') and not supplier_id:
            try:
                # Create new supplier
                supplier = Supplier(
                    name=request.form['supplier_name'],
                    bank_name=request.form.get('bank_name'),
                    bank_account_number=request.form.get('bank_account_number'),
                    bank_branch=request.form.get('bank_branch'),
                    bank_swift=request.form.get('bank_swift')
                )
                db.session.add(supplier)
                db.session.commit()
                supplier_id = supplier.id
            except Exception as e:
                logging.error(f"Error creating supplier: {str(e)}")
                flash('Failed to create new supplier. Please check the supplier information.', 'error')
                return redirect(url_for('submit_expense'))
        
        # Validate credit card if payment method is credit
        if payment_method == 'credit':
            if not request.form.get('credit_card_id'):
                flash('Please select a credit card for credit card payments', 'error')
                return redirect(url_for('submit_expense'))
            credit_card_id = request.form['credit_card_id']
            credit_card = CreditCard.query.get(credit_card_id)
            if not credit_card or credit_card.status != 'active':
                flash('Selected credit card is not valid or inactive', 'error')
                return redirect(url_for('submit_expense'))
        else:
            credit_card_id = None

        # Create new expense
        expense = Expense(
            amount=amount,
            currency=currency,  # Add currency to the expense
            description=description,
            reason=reason,
            type=expense_type,
            subcategory_id=subcategory_id,
            user_id=current_user.id,
            payment_method=payment_method,
            supplier_id=supplier_id,
            purchase_date=purchase_date,
            credit_card_id=credit_card_id,
            payment_due_date=payment_due_date,  # Add payment due date
            status='approved' if expense_type == 'auto_approved' else 'pending',
            invoice_date=invoice_date,
        )
        
        # Set payment_status to 'Pending attention' for 'Transfer' payment method
        if payment_method == 'transfer':
            expense.payment_status = 'pending_attention'
        
        # Auto-mark credit card and standing order payments as paid
        if (payment_method == 'credit' or payment_method == 'standing_order') and expense.status == 'approved':
            expense.is_paid = True
            expense.paid_at = datetime.utcnow()
            expense.paid_by_id = current_user.id
            expense.payment_status = 'paid'
        
        # Process document if uploaded
        file_upload_start_time = datetime.now()
        doc_processor = None  # Initialize once for all documents
        processed_files = 0
        processing_time = 0
        
        # Process document if uploaded
        if 'invoice' in request.files:
            invoice_file = request.files['invoice']
            if invoice_file and allowed_file(invoice_file.filename):
                try:
                    # Save the file with a proper name
                    filename = secure_filename(f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{invoice_file.filename}")
                    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    
                    # Save the file first
                    invoice_file.save(filepath)
                    expense.invoice_filename = filename
                    
                    try:
                        # Process the document
                        if doc_processor is None:
                            doc_processor = DocumentProcessor()
                        
                        process_start = datetime.now()
                        doc_data = doc_processor.process_document(filepath)
                        processing_time += (datetime.now() - process_start).total_seconds()
                        processed_files += 1
                        
                        logging.info(f"Extracted document data: {doc_data}")
                        
                        # Update expense with document data if available
                        if doc_data.get('amount'):
                            expense.amount = doc_data['amount']
                        if doc_data.get('purchase_date'):
                            expense.purchase_date = doc_data['purchase_date']
                        
                    except Exception as e:
                        logging.error(f"Error processing invoice: {str(e)}")
                        flash(f'Error processing invoice: {str(e)}', 'error')
                        return redirect(url_for('submit_expense'))
                except Exception as e:
                    logging.error(f"Error saving invoice file: {str(e)}")
                    flash('Failed to save invoice file. Please try again.', 'error')
                    return redirect(url_for('submit_expense'))
            elif invoice_file and not allowed_file(invoice_file.filename):
                flash('Invalid invoice file type. Allowed types are: PDF, PNG, JPG, JPEG', 'error')
                return redirect(url_for('submit_expense'))

        # Process quote if provided
        if 'quote' in request.files:
            quote = request.files['quote']
            if quote and allowed_file(quote.filename):
                try:
                    filename = secure_filename(f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{quote.filename}")
                    quote.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                    expense.quote_filename = filename
                except Exception as e:
                    logging.error(f"Error saving quote file: {str(e)}")
                    flash('Failed to save quote file. Please try again.', 'error')
                    return redirect(url_for('submit_expense'))
            elif quote and not allowed_file(quote.filename):
                flash('Invalid quote file type. Allowed types are: PDF, PNG, JPG, JPEG', 'error')
                return redirect(url_for('submit_expense'))

        # Process receipt if provided
        if 'receipt' in request.files:
            receipt = request.files['receipt']
            if receipt and allowed_file(receipt.filename):
                try:
                    filename = secure_filename(f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{receipt.filename}")
                    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    
                    # Save the file first
                    receipt.save(filepath)
                    expense.receipt_filename = filename
                    
                    try:
                        # Process the receipt
                        if doc_processor is None:
                            doc_processor = DocumentProcessor()
                        
                        process_start = datetime.now()
                        receipt_data = doc_processor.process_document(filepath)
                        processing_time += (datetime.now() - process_start).total_seconds()
                        processed_files += 1
                        
                        logging.info(f"Extracted receipt data: {receipt_data}")
                        
                        # Update expense with receipt data if available and if not already set by invoice
                        if receipt_data.get('amount'):
                            expense.amount = receipt_data['amount']
                        if receipt_data.get('purchase_date'):
                            expense.purchase_date = receipt_data['purchase_date']
                        
                    except Exception as e:
                        logging.error(f"Error processing receipt: {str(e)}")
                        flash(f'Error processing receipt: {str(e)}', 'error')
                        return redirect(url_for('submit_expense'))
                except Exception as e:
                    logging.error(f"Error saving receipt file: {str(e)}")
                    flash('Failed to save receipt file. Please try again.', 'error')
                    return redirect(url_for('submit_expense'))
            elif receipt and not allowed_file(receipt.filename):
                flash('Invalid receipt file type. Allowed types are: PDF, PNG, JPG, JPEG', 'error')
                return redirect(url_for('submit_expense'))
        
        if processed_files > 0:
            logging.info(f"Document processing stats: {processed_files} files processed in {processing_time:.2f} seconds. Average: {processing_time/processed_files:.2f} seconds per file")
            
        file_upload_time = (datetime.now() - file_upload_start_time).total_seconds()
        logging.info(f"Total file upload and processing time: {file_upload_time:.2f} seconds")
        
        # Save the expense to database
        try:
            db.session.add(expense)
            db.session.commit()
            
            # Explicitly load the subcategory relationship
            db.session.refresh(expense)

            # Send confirmation email to employee
            try:
                send_email(
                    subject="Confirmation: Your Request Has Been Successfully Registered",
                    recipient=current_user.email,
                    template=EXPENSE_REQUEST_CONFIRMATION_TEMPLATE,
                    submitter=current_user,
                    expense=expense
                )
            except Exception as e:
                logging.error(f"Failed to send confirmation email: {str(e)}")
                # Continue even if email fails
                pass

            # Send email notification to managers only if expense pending approval
            if expense.status == 'pending':
                try:
                    managers = User.query.filter_by(is_manager=True).all()
                    for manager in managers:
                        send_email(
                            subject="New Request Awaiting Your Attention",
                            recipient=manager.email,
                            template=NEW_REQUEST_MANAGER_NOTIFICATION_TEMPLATE,
                            manager=manager,
                            expense=expense
                        )
                except Exception as e:
                    logging.error(f"Failed to send manager notification: {str(e)}")
                    # Continue even if email fails
                    pass

            flash('Expense submitted successfully!', 'success')
            return redirect(url_for('employee_dashboard'))
        except Exception as e:
            db.session.rollback()
            logging.error(f"Database error while saving expense: {str(e)}")
            flash(f'Failed to save expense: {str(e)}', 'error')
            return redirect(url_for('submit_expense'))
            
    except ValueError as e:
        logging.error(f"Value error in expense submission: {str(e)}")
        flash(f'Invalid value provided: {str(e)}', 'error')
        return redirect(url_for('submit_expense'))
    except Exception as e:
        logging.error(f"Unexpected error in expense submission: {str(e)}")
        flash(f'An unexpected error occurred: {str(e)}', 'error')
        return redirect(url_for('submit_expense'))

@app.route('/download/<filename>')
@login_required
def download_file(filename):
    # Determine the appropriate redirect URL based on user role
    if current_user.is_accounting:
        redirect_url = 'accounting_dashboard'
    elif current_user.is_admin:
        redirect_url = 'admin_dashboard'
    else:
        redirect_url = 'employee_dashboard'

    try:
        # Basic validation for filename
        if not filename or filename == 'None': # Handles if filename is None or string 'None'
            flash('No file associated with this record or filename is invalid.', 'error')
            return redirect(url_for(redirect_url))

        # Ensure the filename is secure and not trying to access directories
        if '..' in filename or filename.startswith('/'):
            flash('Invalid filename.', 'error')
            return redirect(url_for(redirect_url))

        logging.info(f"Attempting to download: Original filename from DB: '{filename}'")
        upload_folder = app.config.get('UPLOAD_FOLDER')
        logging.info(f"UPLOAD_FOLDER is: '{upload_folder}'")
        
        if not upload_folder:
            logging.error("UPLOAD_FOLDER is not configured.")
            flash('Server configuration error: Upload directory not set.', 'error')
            return redirect(url_for(redirect_url))
            
        filepath = os.path.join(upload_folder, filename)
        logging.info(f"Constructed filepath for download: '{filepath}'")

        if not os.path.exists(filepath):
            logging.error(f"File not found at path: {filepath}. UPLOAD_FOLDER: {upload_folder}, Filename: {filename}")
            flash('File not found', 'error')
            return redirect(url_for(redirect_url))
        
        # Check all document type fields for the file
        expense = Expense.query.filter(
            db.or_(
                Expense.quote_filename == filename,
                Expense.invoice_filename == filename,
                Expense.receipt_filename == filename
            )
        ).first_or_404() # If file not found in DB, this will raise a 404
        
        # Check permissions for the specific user role
        if current_user.is_manager or current_user.is_accounting or expense.user_id == current_user.id:
            try:
                return send_file(filepath, as_attachment=True)
            except Exception as e:
                logging.error(f"Error downloading file {filename}: {str(e)}")
                flash('Error downloading file', 'error')
                return redirect(url_for(redirect_url))
                
        flash('Unauthorized access', 'error') # Added 'error' category for consistency
        return redirect(url_for(redirect_url))

    except Exception as e:
        logging.error(f"Error downloading file: {str(e)}")
        flash('Error downloading file', 'error')
        return redirect(url_for(redirect_url))

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
    
    # Budget summaries for manager's departments and categories
    if current_user.username == 'admin':
        managed_depts = Department.query.all()
    else:
        managed_depts = current_user.managed_departments
    dept_budgets = []
    for dept in managed_depts:
        used = db.session.query(db.func.coalesce(dept_expenses.c.total_expenses, 0)).filter(dept_expenses.c.id == dept.id).scalar() or 0
        dept_remaining = dept.budget - dept_spent
        dept_usage = round((dept_spent / dept.budget * 100) if dept.budget > 0 else 0, 2)
        
        department_budgets.append({
            'name': dept.name,
            'budget': dept.budget,
            'spent': dept_spent,
            'remaining': dept_remaining,
            'usage': dept_usage
        })
        
        department_names.append(dept.name)
        department_budgets_data.append(float(dept.budget))
        department_spent_data.append(float(dept_spent))
    
    # Category distribution data for pie chart
    category_names = []
    category_spent_data = []
    
    # Query to get spending by category
    category_spending = db.session.query(
        Category.name,
        func.sum(Expense.amount).label('total')
    ).join(
        Subcategory, Category.id == Subcategory.category_id
    ).join(
        Expense, Subcategory.id == Expense.subcategory_id
    ).filter(
        Expense.status == 'approved',
        Expense.date >= start_date,
        Expense.date <= end_date
    )
    
    if selected_department != 'all':
        category_spending = category_spending.join(
            User, Expense.user_id == User.id
        ).filter(User.department_id == selected_department)
    
    category_spending = category_spending.group_by(Category.name).all()
    
    for cat_name, total in category_spending:
        category_names.append(cat_name)
        category_spent_data.append(float(total))
    
    # Subcategory distribution data for doughnut chart
    subcategory_names = []
    subcategory_spent_data = []
    
    # Query to get spending by subcategory
    subcategory_spending = db.session.query(
        Subcategory.name,
        func.sum(Expense.amount).label('total')
    ).join(
        Expense, Subcategory.id == Expense.subcategory_id
    ).filter(
        Expense.status == 'approved',
        Expense.date >= start_date,
        Expense.date <= end_date
    )
    
    if selected_department != 'all':
        subcategory_spending = subcategory_spending.join(
            User, Expense.user_id == User.id
        ).filter(User.department_id == selected_department)
    
    if selected_category != 'all':
        subcategory_spending = subcategory_spending.filter(Subcategory.category_id == selected_category)
    
    subcategory_spending = subcategory_spending.group_by(Subcategory.name).all()
    
    for subcat_name, total in subcategory_spending:
        subcategory_names.append(subcat_name)
        subcategory_spent_data.append(float(total))
    
    # Expense trend data for line chart
    expense_trend_labels = []
    expense_trend_data = []
    
    # Determine the number of months to include in the trend
    if selected_time_period == 'this_year':
        months_to_include = 12
    else:
        months_to_include = 6  # Default to last 6 months for other time periods
    
    # Generate the trend data for the last N months
    for i in range(months_to_include - 1, -1, -1):
        month_date = today - relativedelta(months=i)
        month_start = datetime(month_date.year, month_date.month, 1)
        if month_date.month == 12:
            month_end = datetime(month_date.year + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = datetime(month_date.year, month_date.month + 1, 1) - timedelta(days=1)
        
        # Format the month label
        month_label = month_date.strftime('%b %Y')
        expense_trend_labels.append(month_label)
        
        # Calculate total expenses for the month
        month_expenses = db.session.query(func.sum(Expense.amount)).filter(
            Expense.status == 'approved',
            Expense.date >= month_start,
            Expense.date <= month_end
        )
        
        if selected_department != 'all':
            month_expenses = month_expenses.join(
                User, Expense.user_id == User.id
            ).filter(User.department_id == selected_department)
        
        if selected_category != 'all':
            month_expenses = month_expenses.join(
                Subcategory, Expense.subcategory_id == Subcategory.id
            ).filter(Subcategory.category_id == selected_category)
        
        if selected_subcategory != 'all':
            month_expenses = month_expenses.filter(Expense.subcategory_id == selected_subcategory)
        
        month_total = month_expenses.scalar() or 0
        expense_trend_data.append(float(month_total))
    
    return render_template(
        'admin_dashboard.html',
        departments=departments,
        categories=categories,
        subcategories=subcategories,
        selected_department=selected_department,
        selected_category=selected_category,
        selected_subcategory=selected_subcategory,
        selected_time_period=selected_time_period,
        total_budget=total_budget,
        total_spent=total_spent,
        total_remaining=total_remaining,
        usage_percentage=usage_percentage,
        department_budgets=department_budgets,
        department_names=department_names,
        department_budgets_data=department_budgets_data,
        department_spent_data=department_spent_data,
        category_names=category_names,
        category_spent_data=category_spent_data,
        subcategory_names=subcategory_names,
        subcategory_spent_data=subcategory_spent_data,
        expense_trend_labels=expense_trend_labels,
        expense_trend_data=expense_trend_data
    )

# API endpoints for dynamic filtering
@app.route('/api/categories')
@login_required
def get_categories():
    department_id = request.args.get('department_id')
    if not department_id:
        return jsonify({'error': 'Missing department_id parameter'}), 400
    
    categories = Category.query.filter_by(department_id=department_id).all()
    result = {'categories': [{'id': cat.id, 'name': cat.name} for cat in categories]}
    return jsonify(result)

@app.route('/api/subcategories')
@login_required
def get_subcategories():
    category_id = request.args.get('category_id')
    if not category_id:
        return jsonify({'error': 'Missing category_id parameter'}), 400
    
    subcategories = Subcategory.query.filter_by(category_id=category_id).all()
    result = {'subcategories': [{'id': subcat.id, 'name': subcat.name} for subcat in subcategories]}
    return jsonify(result)

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
            # Instead of deleting, mark as inactive
            user.status = 'inactive'
            flash('User has associated expenses. Marked as inactive instead of deleting.', 'success')
        else:
            db.session.delete(user)
            flash('User deleted successfully!', 'success')
        
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
    # Get the month filter parameter (same as in accounting_dashboard)
    month_filter = request.args.get('month', 'all')
    
    # Start with query for approved expenses
    query = Expense.query.filter_by(status='approved')
    
    # Apply month filter if selected (based on date submitted)
    if month_filter != 'all':
        year, month = month_filter.split('-')
        start_date = datetime(int(year), int(month), 1)
        if int(month) == 12:
            end_date = datetime(int(year) + 1, 1, 1)
        else:
            end_date = datetime(int(year), int(month) + 1, 1)
        query = query.filter(Expense.date >= start_date, Expense.date < end_date)
    
    # Get the filtered expenses
    expenses = query.all()
    
    data = []
    for expense in expenses:
        data.append({
            'Date Submitted': expense.date.strftime('%d/%m/%Y'),
            'Employee': expense.submitter.username,
            'Department': expense.submitter.home_department.name,
            'Description': expense.description,
            'Reason': expense.reason,
            'Type': expense.type,
            'Amount': expense.amount,
            'Handled By': expense.handler.username if expense.handler else '-',
            'Date Handled': expense.handled_at.strftime('%d/%m/%Y') if expense.handled_at else '-',
            'Credit Card Last 4 Digits': expense.credit_card.last_four_digits if expense.credit_card else '-',
            'Payment Method': expense.payment_method,
            'Supplier Name': expense.supplier.name if expense.supplier else '-',
            'Supplier Email': expense.supplier.email if expense.supplier else '-',
            'Supplier Phone': expense.supplier.phone if expense.supplier else '-',
            'Supplier Address': expense.supplier.address if expense.supplier else '-',
            'Tax ID': expense.supplier.tax_id if expense.supplier else '-',
            'Bank Name': expense.supplier.bank_name if expense.supplier else '-',
            'Bank Account': expense.supplier.bank_account_number if expense.supplier else '-',
            'Bank Branch': expense.supplier.bank_branch if expense.supplier else '-',
            'Bank SWIFT': expense.supplier.bank_swift if expense.supplier else '-',
            'Supplier Notes': expense.supplier.notes if expense.supplier else '-',
            'Supplier Status': expense.supplier.status if expense.supplier else '-',
            'Date of Purchase': expense.purchase_date.strftime('%d/%m/%Y') if expense.purchase_date else '-',
            'Payment Due Date': 'Start of month' if expense.payment_due_date == 'start_of_month' else 'End of month',
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
    
    # Get filter parameters
    month_filter = request.args.get('month', 'all')
    payment_method_filter = request.args.get('payment_method', 'all')
    payment_status_filter = request.args.get('payment_status', 'all')
    payment_due_date_filter = request.args.get('payment_due_date', 'all')
    invoice_date_filter = request.args.get('invoice_date', 'all')
    
    # Start with base query for approved expenses
    query = Expense.query.filter_by(status='approved')
    
    # Apply month filter (based on date submitted instead of purchase_date)
    if month_filter != 'all':
        year, month = month_filter.split('-')
        start_date = datetime(int(year), int(month), 1)
        if int(month) == 12:
            end_date = datetime(int(year) + 1, 1, 1)
        else:
            end_date = datetime(int(year), int(month) + 1, 1)
        query = query.filter(Expense.date >= start_date, Expense.date < end_date)
    
    # Apply invoice date filter
    if invoice_date_filter != 'all':
        today = datetime.now()
        if invoice_date_filter == 'this_month':
            start_date = datetime(today.year, today.month, 1)
            if today.month == 12:
                end_date = datetime(today.year + 1, 1, 1)
            else:
                end_date = datetime(today.year, today.month + 1, 1)
        elif invoice_date_filter == 'last_month':
            if today.month == 1:
                start_date = datetime(today.year - 1, 12, 1)
                end_date = datetime(today.year, 1, 1)
            else:
                start_date = datetime(today.year, today.month - 1, 1)
                end_date = datetime(today.year, today.month, 1)
        elif invoice_date_filter == 'this_quarter':
            current_quarter = (today.month - 1) // 3 + 1
            start_date = datetime(today.year, 3 * current_quarter - 2, 1)
            if current_quarter == 4:
                end_date = datetime(today.year + 1, 1, 1)
            else:
                end_date = datetime(today.year, 3 * current_quarter + 1, 1)
        elif invoice_date_filter == 'this_year':
            start_date = datetime(today.year, 1, 1)
            end_date = datetime(today.year + 1, 1, 1)
        
        query = query.filter(Expense.invoice_date >= start_date, Expense.invoice_date < end_date)
    
    # Apply payment due date filter
    if payment_due_date_filter != 'all':
        query = query.filter(Expense.payment_due_date == payment_due_date_filter)
    
    # Apply payment method filter
    if payment_method_filter != 'all':
        query = query.filter(Expense.payment_method == payment_method_filter)
    
    # Apply payment status filter
    if payment_status_filter == 'paid':
        query = query.filter(Expense.is_paid == True)
    elif payment_status_filter == 'pending':
        query = query.filter(Expense.is_paid == False)
    
    # Get the expenses
    expenses = query.order_by(Expense.date.desc()).all()
    
    # Generate month options for the filter dropdown (last 12 months)
    current_date = datetime.now()
    month_options = []
    for i in range(12):
        date = current_date - relativedelta(months=i)
        month_str = date.strftime('%Y-%m')
        month_display = date.strftime('%B %Y')
        month_options.append((month_str, month_display))
    
    return render_template('accounting_dashboard.html', 
                          expenses=expenses,
                          selected_month=month_filter,
                          selected_payment_method=payment_method_filter,
                          selected_payment_status=payment_status_filter,
                          selected_payment_due_date=payment_due_date_filter,
                          selected_invoice_date=invoice_date_filter,
                          month_options=month_options)

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
    expense.payment_status = 'paid'
    db.session.commit()
    
    # Send email notification to the submitter
    try:
        submitter = User.query.get(expense.user_id)
        if submitter and submitter.email:
            subject = "Your Expense Has Been Paid"
            
            # Prepare payment method display text
            payment_method_display = "Credit Card" if expense.payment_method == "credit" else "Bank Transfer"
            
            # Send the notification email
            send_email(
                subject=subject,
                recipient=submitter.email,
                template=EXPENSE_PAYMENT_NOTIFICATION_TEMPLATE,
                amount=format_currency(expense.amount, expense.currency),
                description=expense.description,
                date=expense.date.strftime('%d/%m/%Y'),
                payment_method=payment_method_display,
                expense=expense,
                paid_by=current_user.username,
                paid_date=datetime.now().strftime('%d/%m/%Y')
            )
            logging.info(f"Payment notification sent to {submitter.email} for expense {expense.id}")
    except Exception as e:
        # Log the error but don't prevent the expense from being marked as paid
        logging.error(f"Failed to send payment notification: {str(e)}")
        # Still save the payment status even if email fails
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
    expense.payment_status = 'pending_payment'
    db.session.commit()
    
    return jsonify({'success': True})

@app.route('/mark_expense_pending_payment/<int:expense_id>', methods=['POST'])
@login_required
def mark_expense_pending_payment(expense_id):
    if not current_user.is_accounting:
        return jsonify({'error': 'Access denied'}), 403
    
    expense = Expense.query.get_or_404(expense_id)
    if expense.is_paid:
        return jsonify({'error': 'Already paid'}), 400
    
    expense.payment_status = 'pending_payment'
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
    if request.method == 'POST':
        try:
            # Get form data
            name = request.form['name']
            email = request.form.get('email')
            phone = request.form.get('phone')
            tax_id = request.form.get('tax_id')
            
            # Create new supplier
            supplier = Supplier(
                name=name,
                email=email,
                phone=phone,
                tax_id=tax_id,
                status='active'
            )
            db.session.add(supplier)
            db.session.commit()
            
            # If it's an AJAX request, return JSON response
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({
                    'success': True,
                    'supplier': {
                        'id': supplier.id,
                        'name': supplier.name
                    }
                })
            
            flash('Supplier added successfully!', 'success')
            # Redirect based on user role
            if current_user.is_admin or current_user.is_accounting:
                return redirect(url_for('manage_suppliers'))
            return redirect(url_for('submit_expense'))
            
        except Exception as e:
            db.session.rollback()
            logging.error(f"Error adding supplier: {str(e)}")
            
            # If it's an AJAX request, return JSON error response
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({
                    'success': False,
                    'message': 'Failed to add supplier'
                }), 400
                
            flash('Failed to add supplier. Please try again.', 'error')
            return redirect(url_for('add_supplier'))
    
    return render_template('add_supplier.html')

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

    # Redirect based on user role
    if current_user.is_accounting:
        return redirect(url_for('accounting_dashboard'))
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

@app.route('/manage_credit_cards')
@login_required
def manage_credit_cards():
    if not current_user.is_admin:
        flash('Access denied.', 'error')
        return redirect(url_for('employee_dashboard'))
    credit_cards = CreditCard.query.order_by(CreditCard.last_four_digits).all()
    return render_template('manage_credit_cards.html', credit_cards=credit_cards)

@app.route('/add_credit_card', methods=['POST'])
@login_required
def add_credit_card():
    if not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    try:
        last_four_digits = request.form['last_four_digits']
        description = request.form.get('description')
        
        # Validate last four digits
        if not last_four_digits.isdigit() or len(last_four_digits) != 4:
            return jsonify({'error': 'Last four digits must be exactly 4 numbers'}), 400
        
        # Check if card already exists
        if CreditCard.query.filter_by(last_four_digits=last_four_digits, status='active').first():
            return jsonify({'error': 'Credit card already exists'}), 400
        
        credit_card = CreditCard(
            last_four_digits=last_four_digits,
            description=description,
            status='active'
        )
        
        db.session.add(credit_card)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'credit_card': {
                'id': credit_card.id,
                'last_four_digits': credit_card.last_four_digits,
                'description': credit_card.description,
                'status': credit_card.status
            }
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/edit_credit_card/<int:card_id>', methods=['POST'])
@login_required
def edit_credit_card(card_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    try:
        credit_card = CreditCard.query.get_or_404(card_id)
        last_four_digits = request.form['last_four_digits']
        description = request.form.get('description')
        status = request.form.get('status', 'active')
        
        # Validate last four digits
        if not last_four_digits.isdigit() or len(last_four_digits) != 4:
            return jsonify({'error': 'Last four digits must be exactly 4 numbers'}), 400
        
        # Check if card already exists (excluding current card)
        existing_card = CreditCard.query.filter(
            CreditCard.last_four_digits == last_four_digits,
            CreditCard.id != card_id,
            CreditCard.status == 'active'
        ).first()
        if existing_card:
            return jsonify({'error': 'Credit card already exists'}), 400
        
        credit_card.last_four_digits = last_four_digits
        credit_card.description = description
        credit_card.status = status
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/delete_credit_card/<int:card_id>', methods=['POST'])
@login_required
def delete_credit_card(card_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    try:
        credit_card = CreditCard.query.get_or_404(card_id)
        
        # Check if card has any associated expenses
        if credit_card.expenses:
            # Instead of deleting, mark as inactive
            credit_card.status = 'inactive'
            flash('Credit card has associated expenses. Marked as inactive instead of deleting.', 'success')
        else:
            db.session.delete(credit_card)
            flash('Credit card deleted successfully!', 'success')
        
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

from services.document_processor import DocumentProcessor

processor = DocumentProcessor()

def process_quote_endpoint(document_path):
    """
    Endpoint to process a quote document.
    
    Args:
        document_path (str): Path to the quote document.
    """
    try:
        quote_data = processor.process_document(document_path)
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
            filename = secure_filename(file.filename)
            temp_path = os.path.join(app.config['UPLOAD_FOLDER'], 'temp', filename)
            os.makedirs(os.path.dirname(temp_path), exist_ok=True)
            file.save(temp_path)
            
            # Process the document
            document_type = request.form.get('document_type', 'receipt')  # receipt, invoice, or quote
            if document_type == 'receipt':
                extracted_data = processor.process_document(temp_path)
            elif document_type == 'invoice':
                extracted_data = processor.process_document(temp_path)
            else:
                extracted_data = processor.process_document(temp_path)
            
            # Clean up temporary file
            os.remove(temp_path)
            
            return jsonify({
                'success': True,
                'extracted_data': extracted_data,
                'filename': filename
            })
            
        except Exception as e:
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
            filename = secure_filename(file.filename)
            temp_path = os.path.join(app.config['UPLOAD_FOLDER'], 'temp', filename)
            os.makedirs(os.path.dirname(temp_path), exist_ok=True)
            file.save(temp_path)
            
            # Process the receipt
            doc_processor = DocumentProcessor()
            receipt_data = doc_processor.process_document(temp_path)
            
            # Clean up temporary file
            os.remove(temp_path)
            
            return jsonify(receipt_data)
        except Exception as e:
            logging.error(f"Error processing receipt: {str(e)}")
            return jsonify({'error': str(e)}), 500
    
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/admin/users/<int:user_id>/reset_password', methods=['POST'])
@login_required
def reset_user_password(user_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    try:
        user = User.query.get_or_404(user_id)
        
        # Don't allow resetting admin's own password through this route
        if user.id == current_user.id:
            return jsonify({'error': 'Cannot reset your own password through this route. Please use the change password page.'}), 400
        
        # Reset password to default
        user.password = '123456'
        db.session.commit()
        
        # Log the action
        logging.info(f"Admin {current_user.username} reset password for user {user.username}")
        
        # Send password change notification email
        try:
            send_email(
                subject="Password Change Confirmation",
                recipient=user.email,
                template=PASSWORD_CHANGE_CONFIRMATION_TEMPLATE,
                user=user
            )
        except Exception as e:
            logging.error(f"Failed to send password change notification email: {str(e)}")
            # Continue even if email fails
            pass
        
        return jsonify({
            'success': True,
            'message': f'Password for user {user.username} has been reset to 123456'
        })
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error resetting password: {str(e)}")
        return jsonify({'error': f'Error resetting password: {str(e)}'}), 500

@app.route('/api/expense/process-document', methods=['POST'])
@login_required
def process_document():
    if 'document' not in request.files:
        return jsonify({'error': 'No document provided'}), 400
    
    file = request.files['document']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        try:
            # Save the file temporarily
            filename = secure_filename(file.filename)
            temp_path = os.path.join(app.config['UPLOAD_FOLDER'], 'temp', filename)
            os.makedirs(os.path.dirname(temp_path), exist_ok=True)
            file.save(temp_path)
            
            # Process the document
            document_type = request.form.get('document_type', 'receipt')  # receipt, invoice, or quote
            if document_type == 'receipt':
                extracted_data = processor.process_document(temp_path)
            elif document_type == 'invoice':
                extracted_data = processor.process_document(temp_path)
            else:
                extracted_data = processor.process_document(temp_path)
            
            # Clean up temporary file
            os.remove(temp_path)
            
            return jsonify({
                'success': True,
                'extracted_data': extracted_data,
                'filename': filename
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
            
    return jsonify({'error': 'Invalid file type'}), 400

if __name__ == '__main__':
    app.run(debug=True)
