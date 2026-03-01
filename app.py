from flask import Flask, request, redirect, url_for, flash, send_file, jsonify, session, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, login_user, login_required, logout_user, current_user
from datetime import datetime, timedelta
import os
from services.document_processor import DocumentProcessor
from werkzeug.utils import secure_filename
from utils.email_sender import send_email, EXPENSE_PAYMENT_NOTIFICATION_TEMPLATE, PASSWORD_CHANGE_CONFIRMATION_TEMPLATE
import logging
from routes.api_v1 import api_v1
from flask_migrate import Migrate
from flask_cors import CORS
from config import Config
from io import BytesIO
import pandas as pd
from models import db, Department, Category, Subcategory, User, Supplier, Expense, CreditCard, BudgetYear
from services.exchange_rate import get_exchange_rate
import msal
import requests
import time

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

# Initialize CORS for frontend
cors_origins = ["http://localhost:3000", "https://localhost:3000"]
if os.getenv('RENDER') == 'true' or os.getenv('FLASK_ENV') != 'development':
    cors_origins = ["*"]

CORS(app, resources={
    r"/api/*": {
        "origins": cors_origins,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

# Initialize login manager
login_manager = LoginManager(app)
login_manager.login_view = None  # React handles login UI

# Register blueprints
app.register_blueprint(api_v1)

ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def format_currency(value, currency='ILS'):
    """Format a numeric value as currency string."""
    if isinstance(value, (int, float)):
        if currency == 'USD':
            return f"${value:,.2f}"
        else:
            return f"₪{value:,.2f}"
    return value

# Initialize database
with app.app_context():
    db_uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
    if '@' in db_uri:
        safe_uri = db_uri.split('@')[-1]
        logging.info(f"Connecting to database: {safe_uri}")
    else:
        logging.info(f"Connecting to database: {db_uri}")

    from sqlalchemy import text
    max_retries = 5
    for attempt in range(1, max_retries + 1):
        try:
            engine_name = db.engine.name
            logging.info(f"Database engine: {engine_name}")
            db.session.execute(text('SELECT 1'))
            logging.info("Database connection verified successfully.")
            db.create_all()
            break
        except Exception as e:
            logging.warning(f"Database connection attempt {attempt}/{max_retries} failed: {e}")
            db.session.rollback()
            if attempt == max_retries:
                logging.error(f"CRITICAL: Failed to connect to database after {max_retries} attempts")
                if os.getenv('FLASK_ENV') != 'development':
                    raise
            else:
                time.sleep(2 ** attempt)

    try:
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

# Handle unauthorized API requests
@login_manager.unauthorized_handler
def unauthorized():
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Not authenticated'}), 401
    return redirect('/login')

@app.route('/health')
def health_check():
    """Health check endpoint for Render and monitoring services."""
    try:
        from sqlalchemy import text
        db.session.execute(text('SELECT 1'))
        return jsonify({'status': 'healthy', 'database': 'connected'}), 200
    except Exception as e:
        logging.error(f"Health check failed: {e}")
        return jsonify({'status': 'unhealthy', 'database': 'disconnected'}), 503

# --- Azure AD Authentication ---

def _build_msal_app(cache=None):
    return msal.ConfidentialClientApplication(
        app.config['AZURE_AD_CLIENT_ID'],
        authority=app.config['AZURE_AD_AUTHORITY'],
        client_credential=app.config['AZURE_AD_CLIENT_SECRET'],
        token_cache=cache
    )

@app.route('/auth/callback')
def auth_callback():
    if not session.get("flow"):
        logging.error("No flow found in session")
        return redirect('/login')

    try:
        logging.info(f"Auth callback received. Args: {request.args}")

        result = _build_msal_app().acquire_token_by_auth_code_flow(
            session.get("flow"),
            request.args,
            scopes=['https://graph.microsoft.com/User.Read']
        )
        logging.info("Token acquired successfully")

        if "error" in result:
            error_msg = f"Error during login: {result.get('error_description', 'Unknown error')}"
            logging.error(error_msg)
            flash(error_msg)
            return redirect('/login')

        graph_response = requests.get(
            'https://graph.microsoft.com/v1.0/me',
            headers={'Authorization': f"Bearer {result['access_token']}"}
        )
        logging.info(f"Graph API response status: {graph_response.status_code}")

        if not graph_response.ok:
            logging.error(f"Graph API error: {graph_response.text}")
            flash('Could not retrieve user information')
            return redirect('/login')

        graph_data = graph_response.json()
        logging.info("User info retrieved from Graph API")

        email = graph_data.get('mail')
        if not email:
            email = graph_data.get('userPrincipalName')
            logging.info(f"Using userPrincipalName as email: {email}")

        if not email:
            logging.error(f"No email found in graph data: {graph_data}")
            flash('Could not retrieve email from Microsoft account')
            return redirect('/login')

        user = User.query.filter_by(email=email).first()

        if not user:
            logging.info(f"Creating new user for email: {email}")
            default_dept = Department.query.first()

            user = User(
                username=email.split('@')[0],
                email=email,
                first_name=graph_data.get('givenName', ''),
                last_name=graph_data.get('surname', ''),
                department_id=default_dept.id if default_dept else None,
                status='active'
            )
            db.session.add(user)
            db.session.commit()
            logging.info(f"New user created with ID: {user.id}")
        else:
            user.first_name = graph_data.get('givenName', user.first_name)
            user.last_name = graph_data.get('surname', user.last_name)
            db.session.commit()

        if user.status == 'inactive':
            logging.warning(f"Inactive user attempted login: {email}")
            flash('Your account is inactive. Please contact your administrator.')
            return redirect('/login')

        login_user(user)
        session['token_cache'] = result.get('token_cache')
        logging.info(f"User {email} logged in successfully")

        return redirect('/dashboard')

    except Exception as e:
        logging.error(f"Error in auth callback: {str(e)}", exc_info=True)
        flash('An error occurred during login. Please try again.')
        return redirect('/login')

# --- File Download ---

@app.route('/download/<filename>')
@login_required
def download_file(filename):
    is_preview_request = request.headers.get('Sec-Fetch-Dest') == 'iframe'

    def return_error(message, status_code=404):
        if is_preview_request:
            error_html = f'''
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: #f8fafc;
                        color: #475569;
                    }}
                    .error-icon {{
                        font-size: 4rem;
                        color: #94a3b8;
                        margin-bottom: 1rem;
                    }}
                    .error-message {{
                        font-size: 1.125rem;
                        text-align: center;
                        max-width: 400px;
                        padding: 0 1rem;
                    }}
                </style>
            </head>
            <body>
                <div class="error-icon">📄</div>
                <p class="error-message">{message}</p>
            </body>
            </html>
            '''
            return error_html, status_code, {'Content-Type': 'text/html'}
        else:
            return jsonify({'error': message}), status_code

    try:
        if not filename or filename == 'None' or filename == '':
            logging.warning("Download attempt with empty or 'None' filename")
            return return_error('No file associated with this record or filename is invalid.')

        if '..' in filename or filename.startswith('/'):
            logging.warning(f"Malicious filename attempt: {filename}")
            return return_error('Invalid filename.')

        upload_folder = app.config.get('UPLOAD_FOLDER')
        if not upload_folder:
            logging.error("UPLOAD_FOLDER is not configured in app.config")
            return return_error('Server configuration error: Upload directory not set.', 500)

        logging.info(f"[File Download] Request for '{filename}' by user {current_user.id} ({current_user.username})")

        abs_upload_folder = os.path.abspath(upload_folder)
        filepath = os.path.abspath(os.path.join(abs_upload_folder, filename))

        if not filepath.startswith(abs_upload_folder):
            logging.warning(f"Path traversal attempt: {filename} resolved to {filepath}")
            return return_error('Invalid filename or path.')

        if not os.path.exists(abs_upload_folder):
            logging.error(f"[File Download] CRITICAL: Upload folder does not exist: {abs_upload_folder}")
            return return_error('Server configuration error: Upload directory does not exist.', 500)

        if not os.access(abs_upload_folder, os.R_OK):
            logging.error(f"[File Download] CRITICAL: Upload folder is not readable: {abs_upload_folder}")
            return return_error('Server configuration error: Upload directory is not accessible.', 500)

        if not os.path.exists(filepath):
            try:
                dir_list = os.listdir(abs_upload_folder)
                file_count = len(dir_list)
                logging.error(f"[File Download] File not found: {filepath}")
                logging.error(f"[File Download] Upload folder '{abs_upload_folder}' contains {file_count} files")
                logging.error(f"[File Download] First 10 files in directory: {dir_list[:10]}")
                similar_files = [f for f in dir_list if filename[:20] in f or f[:20] in filename]
                if similar_files:
                    logging.error(f"[File Download] Similar filenames found: {similar_files}")
            except Exception as e:
                logging.error(f"File not found: {filepath}. Could not list directory {abs_upload_folder}: {str(e)}")

            error_msg = f'File not found: {filename}. The file may have been deleted or moved.'
            if is_preview_request:
                error_msg = f'Unable to preview file: {filename}\n\nThe file may have been deleted, moved, or there may be a server configuration issue.\n\nPlease contact your administrator if this problem persists.'
            return return_error(error_msg)

        expense = Expense.query.filter(
            db.or_(
                Expense.quote_filename == filename,
                Expense.invoice_filename == filename,
                Expense.receipt_filename == filename
            )
        ).first()

        if not expense:
            logging.warning(f"[File Download] File {filename} exists on disk but no database record was found.")
            return return_error('File record not found in database.', 404)

        has_permission = (
            current_user.is_admin or
            current_user.is_manager or
            current_user.is_accounting or
            expense.user_id == current_user.id
        )

        if has_permission:
            try:
                logging.info(f"[File Download] Sending file: {filename}")
                return send_from_directory(abs_upload_folder, filename, as_attachment=False)
            except Exception as e:
                logging.error(f"Error sending file {filename}: {str(e)}")
                return return_error('Error loading file. Please try again.', 500)

        logging.warning(f"[File Download] Unauthorized access attempt to file {filename} by user {current_user.id}")
        return return_error('Unauthorized access', 403)

    except Exception as e:
        logging.error(f"Unexpected error in download_file: {str(e)}", exc_info=True)
        return return_error('Error loading file. Please try again.', 500)

# --- Excel Export ---

@app.route('/export_accounting_excel')
@login_required
def export_accounting_excel():
    month_filter = request.args.get('month', 'all')

    query = Expense.query.filter_by(status='approved')

    if month_filter != 'all':
        year, month = month_filter.split('-')
        start_date = datetime(int(year), int(month), 1)
        if int(month) == 12:
            end_date = datetime(int(year) + 1, 1, 1)
        else:
            end_date = datetime(int(year), int(month) + 1, 1)
        query = query.filter(Expense.date >= start_date, Expense.date < end_date)

    expenses = query.all()

    data = []
    for expense in expenses:
        data.append({
            'Date Submitted': expense.date.strftime('%d/%m/%Y'),
            'Employee': expense.submitter.username,
            'Department': expense.subcategory.category.department.name if expense.subcategory and expense.subcategory.category and expense.subcategory.category.department else '',
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
            'IBAN': expense.supplier.iban if expense.supplier else '-',
            'Supplier Notes': expense.supplier.notes if expense.supplier else '-',
            'Supplier Status': expense.supplier.status if expense.supplier else '-',
            'Date of Invoice': expense.invoice_date.strftime('%d/%m/%Y') if expense.invoice_date else '-',
            'Payment Due Date': 'Start of month' if expense.payment_due_date == 'start_of_month' else 'End of month',
            'Payment Status': 'Paid' if expense.is_paid else 'Pending Payment',
            'External Accounting Entry': 'Yes' if expense.external_accounting_entry else 'No',
            'External Accounting Entry By': expense.external_accounting_entry_by.username if expense.external_accounting_entry_by else '-',
            'External Accounting Entry Date': expense.external_accounting_entry_at.strftime('%d/%m/%Y %H:%M') if expense.external_accounting_entry_at else '-'
        })

    df = pd.DataFrame(data)

    output = BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, sheet_name='Expenses', index=False)
        worksheet = writer.sheets['Expenses']
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

# --- Expense Payment Status ---

@app.route('/mark_expense_paid/<int:expense_id>', methods=['POST'])
@login_required
def mark_expense_paid(expense_id):
    if not current_user.is_accounting and not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403

    expense = Expense.query.get_or_404(expense_id)
    if expense.status != 'approved':
        return jsonify({'error': 'Only approved expenses can be marked as paid'}), 400

    expense.is_paid = True
    expense.paid_by_id = current_user.id
    expense.paid_at = datetime.utcnow()
    expense.payment_status = 'paid'
    db.session.commit()

    try:
        submitter = User.query.get(expense.user_id)
        if submitter and submitter.email:
            payment_method_map = {
                'credit': 'Credit Card',
                'transfer': 'Bank Transfer',
                'bank_transfer': 'Bank Transfer',
                'standing_order': 'Standing Order',
                'check': 'Check'
            }
            payment_method_display = payment_method_map.get(expense.payment_method, expense.payment_method or 'Unknown')

            send_email(
                subject="Your Expense Has Been Paid",
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
        logging.error(f"Failed to send payment notification: {str(e)}")

    return jsonify({'success': True})

@app.route('/mark_expense_unpaid/<int:expense_id>', methods=['POST'])
@login_required
def mark_expense_unpaid(expense_id):
    if not current_user.is_accounting and not current_user.is_admin:
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
    if not current_user.is_accounting and not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403

    expense = Expense.query.get_or_404(expense_id)
    if expense.is_paid:
        return jsonify({'error': 'Already paid'}), 400

    expense.payment_status = 'pending_payment'
    db.session.commit()
    return jsonify({'success': True})

@app.route('/mark_expense_external_accounting/<int:expense_id>', methods=['POST'])
@login_required
def mark_expense_external_accounting(expense_id):
    if not current_user.is_accounting and not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403

    expense = Expense.query.get_or_404(expense_id)
    if expense.status != 'approved':
        return jsonify({'error': 'Only approved expenses can be marked as entered in external accounting'}), 400

    expense.external_accounting_entry = True
    expense.external_accounting_entry_by_id = current_user.id
    expense.external_accounting_entry_at = datetime.utcnow()
    db.session.commit()

    return jsonify({'success': True})

@app.route('/unmark_expense_external_accounting/<int:expense_id>', methods=['POST'])
@login_required
def unmark_expense_external_accounting(expense_id):
    if not current_user.is_accounting and not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403

    expense = Expense.query.get_or_404(expense_id)
    if not expense.external_accounting_entry:
        return jsonify({'error': 'Expense is not marked as entered in external accounting'}), 400

    expense.external_accounting_entry = False
    expense.external_accounting_entry_by_id = None
    expense.external_accounting_entry_at = None
    db.session.commit()

    return jsonify({'success': True})

# --- Admin Password Reset ---

@app.route('/admin/users/<int:user_id>/reset_password', methods=['POST'])
@login_required
def reset_user_password(user_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403

    try:
        user = User.query.get_or_404(user_id)

        if user.id == current_user.id:
            return jsonify({'error': 'Cannot reset your own password through this route. Please use the change password page.'}), 400

        user.password = '123456'
        db.session.commit()

        logging.info(f"Admin {current_user.username} reset password for user {user.username}")

        try:
            send_email(
                subject="Password Change Confirmation",
                recipient=user.email,
                template=PASSWORD_CHANGE_CONFIRMATION_TEMPLATE,
                user=user
            )
        except Exception as e:
            logging.error(f"Failed to send password change notification email: {str(e)}")

        return jsonify({
            'success': True,
            'message': f'Password for user {user.username} has been reset to 123456'
        })

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error resetting password: {str(e)}")
        return jsonify({'error': f'Error resetting password: {str(e)}'}), 500

# --- Document OCR Processing ---

processor = DocumentProcessor()

@app.route('/api/expense/process-expense', methods=['POST'])
@login_required
def process_expense_document():
    """Process invoice/expense document and extract data using OCR"""
    logging.info("=== INVOICE OCR PROCESSING START ===")
    if 'document' not in request.files:
        return jsonify({'error': 'No document provided'}), 400

    file = request.files['document']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file and allowed_file(file.filename):
        try:
            filename = secure_filename(file.filename)
            temp_path = os.path.join(app.config['UPLOAD_FOLDER'], 'temp', filename)
            os.makedirs(os.path.dirname(temp_path), exist_ok=True)
            file.save(temp_path)

            doc_processor = DocumentProcessor()
            extracted_data = doc_processor.process_document(temp_path)

            os.remove(temp_path)

            if extracted_data.get('processing_status') == 'skipped_no_service':
                return jsonify({
                    'success': False,
                    'warning': 'OCR service not configured',
                    'message': 'Document uploaded but OCR is not available. Please enter data manually.',
                    'extracted_data': {'amount': None, 'purchase_date': None},
                    'filename': filename
                })

            return jsonify({
                'success': True,
                'extracted_data': extracted_data,
                'filename': filename
            })

        except Exception as e:
            logging.error(f"Invoice OCR: Exception occurred: {str(e)}")
            import traceback
            logging.error(f"Invoice OCR: Traceback: {traceback.format_exc()}")
            return jsonify({'error': str(e)}), 500

    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/api/expense/process-receipt', methods=['POST'])
@login_required
def process_receipt_document():
    """Process receipt document and extract data using OCR"""
    logging.info("=== RECEIPT OCR PROCESSING START ===")
    if 'document' not in request.files:
        return jsonify({'error': 'No document provided'}), 400

    file = request.files['document']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file and allowed_file(file.filename):
        try:
            filename = secure_filename(file.filename)
            temp_path = os.path.join(app.config['UPLOAD_FOLDER'], 'temp', filename)
            os.makedirs(os.path.dirname(temp_path), exist_ok=True)
            file.save(temp_path)

            doc_processor = DocumentProcessor()
            receipt_data = doc_processor.process_document(temp_path)

            os.remove(temp_path)

            if receipt_data.get('processing_status') == 'skipped_no_service':
                return jsonify({
                    'success': False,
                    'warning': 'OCR service not configured',
                    'message': 'Document uploaded but OCR is not available. Please enter data manually.',
                    'extracted_data': {'amount': None, 'purchase_date': None},
                    'filename': filename
                })

            return jsonify({
                'success': True,
                'extracted_data': receipt_data,
                'filename': filename
            })
        except Exception as e:
            logging.error(f"Receipt OCR: Exception occurred: {str(e)}")
            import traceback
            logging.error(f"Receipt OCR: Traceback: {traceback.format_exc()}")
            return jsonify({'error': str(e)}), 500

    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/api/expense/process-quote', methods=['POST'])
@login_required
def process_quote_document():
    """Process quote document and extract data using OCR"""
    logging.info("=== QUOTE OCR PROCESSING START ===")
    if 'document' not in request.files:
        return jsonify({'error': 'No document provided'}), 400

    file = request.files['document']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file and allowed_file(file.filename):
        try:
            filename = secure_filename(file.filename)
            temp_path = os.path.join(app.config['UPLOAD_FOLDER'], 'temp', filename)
            os.makedirs(os.path.dirname(temp_path), exist_ok=True)
            file.save(temp_path)

            doc_processor = DocumentProcessor()
            quote_data = doc_processor.process_document(temp_path)

            os.remove(temp_path)

            if quote_data.get('processing_status') == 'skipped_no_service':
                return jsonify({
                    'success': False,
                    'warning': 'OCR service not configured',
                    'message': 'Document uploaded but OCR is not available. Please enter data manually.',
                    'extracted_data': {'amount': None, 'purchase_date': None},
                    'filename': filename
                })

            return jsonify({
                'success': True,
                'extracted_data': quote_data,
                'filename': filename
            })
        except Exception as e:
            logging.error(f"Quote OCR: Exception occurred: {str(e)}")
            import traceback
            logging.error(f"Quote OCR: Traceback: {traceback.format_exc()}")
            return jsonify({'error': str(e)}), 500

    return jsonify({'error': 'Invalid file type'}), 400

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
            filename = secure_filename(file.filename)
            temp_path = os.path.join(app.config['UPLOAD_FOLDER'], 'temp', filename)
            os.makedirs(os.path.dirname(temp_path), exist_ok=True)
            file.save(temp_path)

            extracted_data = processor.process_document(temp_path)

            os.remove(temp_path)

            return jsonify({
                'success': True,
                'extracted_data': extracted_data,
                'filename': filename
            })

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    return jsonify({'error': 'Invalid file type'}), 400

# --- Serve React Frontend ---

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path=''):
    """Serve the React app for all non-API routes"""
    # Skip paths handled by other routes (API, static, download, etc.)
    if path.startswith('api/') or path.startswith('static/') or \
       path.startswith('auth/') or path.startswith('download/') or \
       path.startswith('uploads/') or path == 'health' or \
       path.startswith('mark_expense_') or path.startswith('unmark_expense_') or \
       path.startswith('export_') or path.startswith('admin/users/'):
        # Let Flask handle these with their specific route handlers
        return app.send_static_file('404.html') if os.path.exists(os.path.join(app.static_folder, '404.html')) else ('Not Found', 404)

    frontend_dist = os.path.join(app.config.get('BASE_DIR', os.path.dirname(os.path.abspath(__file__))), 'frontend', 'dist')

    if not os.path.exists(frontend_dist):
        logging.warning("Frontend dist folder not found. Please run 'npm run build' in the frontend directory.")
        return jsonify({
            'error': 'Frontend not built',
            'message': 'Please run npm run build in the frontend directory'
        }), 503

    # Serve static assets (JS, CSS, images with extensions)
    if path and '.' in path.split('/')[-1]:
        file_path = os.path.join(frontend_dist, path)
        if os.path.isfile(file_path):
            return send_from_directory(frontend_dist, path)

    # For all other paths, serve index.html (React Router handles routing)
    try:
        return send_from_directory(frontend_dist, 'index.html')
    except Exception as e:
        logging.error(f"Error serving index.html: {str(e)}")
        return f"Error loading application: {str(e)}", 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
