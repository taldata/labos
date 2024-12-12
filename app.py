from flask import Flask, render_template, request, redirect, url_for, flash, send_file
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

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    is_manager = db.Column(db.Boolean, default=False)
    expenses = db.relationship('Expense', backref='user', lazy=True)

class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    amount = db.Column(db.Float, nullable=False)
    description = db.Column(db.String(200), nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    attachment_filename = db.Column(db.String(255))  # New field for attachment

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

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
    expenses = Expense.query.filter_by(user_id=current_user.id).all()
    return render_template('employee_dashboard.html', expenses=expenses)

@app.route('/expense/submit', methods=['GET', 'POST'])
@login_required
def submit_expense():
    if request.method == 'POST':
        amount = float(request.form.get('amount'))
        description = request.form.get('description')
        
        expense = Expense(
            amount=amount,
            description=description,
            user_id=current_user.id
        )
        
        # Handle file upload
        if 'attachment' in request.files:
            file = request.files['attachment']
            if file and file.filename != '' and allowed_file(file.filename):
                filename = secure_filename(f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{file.filename}")
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                expense.attachment_filename = filename

        db.session.add(expense)
        db.session.commit()
        flash('Expense submitted successfully')
        return redirect(url_for('employee_dashboard'))
    return render_template('submit_expense.html')

@app.route('/download/<filename>')
@login_required
def download_file(filename):
    expense = Expense.query.filter_by(attachment_filename=filename).first_or_404()
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
    pending_expenses = Expense.query.filter_by(status='pending').all()
    return render_template('manager_dashboard.html', expenses=pending_expenses)

@app.route('/manager/history')
@login_required
def expense_history():
    if not current_user.is_manager:
        return redirect(url_for('employee_dashboard'))
    
    # Get filter parameters
    status = request.args.get('status', 'all')
    employee = request.args.get('employee', 'all')
    
    # Base query
    query = Expense.query
    
    # Apply filters
    if status != 'all':
        query = query.filter_by(status=status)
    if employee != 'all':
        query = query.filter_by(user_id=employee)
    
    # Get all employees for the filter dropdown
    employees = User.query.filter_by(is_manager=False).all()
    
    # Get expenses with sorting
    expenses = query.order_by(Expense.date.desc()).all()
    
    return render_template('expense_history.html', 
                         expenses=expenses,
                         employees=employees,
                         selected_status=status,
                         selected_employee=employee)

@app.route('/expense/<int:expense_id>/<action>')
@login_required
def handle_expense(expense_id, action):
    if not current_user.is_manager:
        return redirect(url_for('employee_dashboard'))
    
    expense = Expense.query.get_or_404(expense_id)
    if action == 'approve':
        expense.status = 'approved'
    elif action == 'reject':
        expense.status = 'rejected'
    
    db.session.commit()
    return redirect(url_for('manager_dashboard'))

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        # Create test users if they don't exist
        if not User.query.filter_by(username='manager').first():
            manager = User(username='manager', password='manager123', is_manager=True)
            employee1 = User(username='employee1', password='employee123', is_manager=False)
            employee2 = User(username='employee2', password='employee123', is_manager=False)
            employee3 = User(username='employee3', password='employee123', is_manager=False)
            db.session.add(manager)
            db.session.add(employee1)
            db.session.add(employee2)
            db.session.add(employee3)
            db.session.commit()
    
    app.run(debug=True)
