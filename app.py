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
    expenses = db.relationship('Expense', backref='user', lazy=True)

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
    date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    status = db.Column(db.String(20), default='pending')
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    subcategory_id = db.Column(db.Integer, db.ForeignKey('subcategory.id'), nullable=False)
    attachment_filename = db.Column(db.String(255))

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
            user_id=current_user.id,
            subcategory_id=request.form.get('subcategory_id')
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
    subcategories = Subcategory.query.all()
    return render_template('submit_expense.html', subcategories=subcategories)

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
    
    # Get all pending expenses if admin, otherwise only from their department
    if current_user.username == 'admin':
        pending_expenses = Expense.query.filter_by(status='pending').all()
    else:
        pending_expenses = Expense.query.join(User).filter(
            Expense.status == 'pending',
            User.department_id == current_user.department_id
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
def add_category():
    if not can_manage_department(dept_id):
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    name = data.get('name')
    budget = data.get('budget')
    
    if not name or budget is None:
        return jsonify({'error': 'Missing required fields'}), 400
    
    department = Department.query.get_or_404(dept_id)
    category = Category(name=name, budget=float(budget), department=department)
    db.session.add(category)
    db.session.commit()
    
    return jsonify({'success': True}), 201

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
    users = User.query.all()
    departments = Department.query.all()
    return render_template('manage_users.html', users=users, departments=departments)

@app.route('/admin/users/add', methods=['POST'])
@login_required
def add_user():
    if not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    username = request.form.get('username')
    password = request.form.get('password')
    department_id = request.form.get('department_id')
    is_manager = 'is_manager' in request.form
    
    if User.query.filter_by(username=username).first():
        flash('Username already exists', 'danger')
        return redirect(url_for('manage_users'))
    
    new_user = User(
        username=username,
        password=password,
        department_id=department_id if department_id else None,
        is_manager=is_manager
    )
    db.session.add(new_user)
    try:
        db.session.commit()
        flash('User added successfully', 'success')
    except Exception as e:
        db.session.rollback()
        flash('Error adding user: ' + str(e), 'danger')
    return redirect(url_for('manage_users'))

@app.route('/admin/users/<int:user_id>/edit', methods=['POST'])
@login_required
def edit_user(user_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    user = User.query.get_or_404(user_id)
    user.username = request.form.get('username', user.username)
    if request.form.get('password'):
        user.password = request.form.get('password')
    if request.form.get('department_id'):
        user.department_id = request.form.get('department_id')
    user.is_manager = 'is_manager' in request.form
    
    try:
        db.session.commit()
        flash('User updated successfully', 'success')
    except Exception as e:
        db.session.rollback()
        flash('Error updating user: ' + str(e), 'danger')
    return redirect(url_for('manage_users'))

@app.route('/admin/users/<int:user_id>/delete', methods=['POST'])
@login_required
def delete_user(user_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    if user_id == current_user.id:
        flash('Cannot delete your own account', 'danger')
        return redirect(url_for('manage_users'))
    
    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    flash('User deleted successfully', 'success')
    return redirect(url_for('manage_users'))

if __name__ == '__main__':
    app.run(debug=True)
