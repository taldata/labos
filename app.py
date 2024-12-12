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
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    budget = db.Column(db.Float, default=0.0)
    users = db.relationship('User', backref='department', lazy=True)
    categories = db.relationship('Category', backref='department', lazy=True)

class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    budget = db.Column(db.Float, default=0.0)
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'), nullable=False)
    subcategories = db.relationship('Subcategory', backref='category', lazy=True)

class Subcategory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    budget = db.Column(db.Float, default=0.0)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=False)
    expenses = db.relationship('Expense', backref='subcategory', lazy=True)

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    is_manager = db.Column(db.Boolean, default=False)
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
    id = db.Column(db.Integer, primary_key=True)
    amount = db.Column(db.Float, nullable=False)
    description = db.Column(db.String(200))
    date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    status = db.Column(db.String(20), default='pending')  # pending, approved, rejected
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    subcategory_id = db.Column(db.Integer, db.ForeignKey('subcategory.id'), nullable=False)
    attachment_filename = db.Column(db.String(255))

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

@app.route('/manager/departments')
@login_required
def manage_departments():
    if not current_user.is_manager:
        return redirect(url_for('employee_dashboard'))
    # Only show the manager's department
    department = Department.query.get(current_user.department_id)
    if not department:
        flash('Department not found', 'error')
        return redirect(url_for('employee_dashboard'))
    return render_template('manage_departments.html', departments=[department])

@app.route('/manager/categories/<int:dept_id>')
@login_required
def manage_categories(dept_id):
    if not current_user.is_manager:
        return redirect(url_for('employee_dashboard'))
    department = Department.query.get_or_404(dept_id)
    return render_template('manage_categories.html', department=department)

@app.route('/manager/subcategories/<int:cat_id>')
@login_required
def manage_subcategories(cat_id):
    if not current_user.is_manager:
        return redirect(url_for('employee_dashboard'))
    category = Category.query.get_or_404(cat_id)
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
    return current_user.is_manager and current_user.department_id == dept_id

def can_view_department(dept_id):
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

@app.route('/manager/budgets', methods=['GET', 'POST'])
@login_required
def manage_budgets():
    if not current_user.is_manager:
        return redirect(url_for('employee_dashboard'))
    
    if request.method == 'POST':
        user_id = request.form.get('user_id')
        budget = request.form.get('budget')
        user = User.query.get(user_id)
        if user and not user.is_manager:
            try:
                user.department.budget = float(budget)
                db.session.commit()
                flash(f'Budget updated for {user.username}')
            except ValueError:
                flash('Invalid budget amount')
    
    employees = User.query.filter_by(is_manager=False).all()
    current_date = datetime.now()
    
    employee_budgets = []
    for emp in employees:
        usage_percent, monthly_expenses = emp.get_budget_usage()
        employee_budgets.append({
            'user': emp,
            'usage_percent': usage_percent,
            'monthly_expenses': monthly_expenses
        })
    
    return render_template('manage_budgets.html', 
                         employee_budgets=employee_budgets,
                         current_month=current_date.strftime('%B %Y'))

@app.route('/employee/budget')
@login_required
def view_budget():
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

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        
        # Create departments only if they don't exist
        departments = {
            'R&D': 100000,
            'Marketing': 50000,
            'Sales': 75000
        }
        
        created_departments = {}
        for dept_name, budget in departments.items():
            if not Department.query.filter_by(name=dept_name).first():
                dept = Department(name=dept_name, budget=budget)
                db.session.add(dept)
                created_departments[dept_name] = dept
        
        db.session.commit()
        
        # Get all departments (both existing and newly created)
        rd_dept = Department.query.filter_by(name='R&D').first()
        marketing_dept = Department.query.filter_by(name='Marketing').first()
        sales_dept = Department.query.filter_by(name='Sales').first()
        
        # Create categories only if they don't exist
        categories_data = {
            'R&D': [
                ('Software', 60000, [
                    ('Development Tools', 20000),
                    ('Cloud Services', 25000),
                    ('Software Licenses', 15000)
                ]),
                ('Hardware', 40000, [
                    ('Equipment', 25000),
                    ('Maintenance', 15000)
                ])
            ],
            'Marketing': [
                ('Digital', 30000, [
                    ('Online Advertising', 20000),
                    ('Social Media', 10000)
                ]),
                ('Events', 20000, [
                    ('Conferences', 12000),
                    ('Trade Shows', 8000)
                ])
            ],
            'Sales': [
                ('Domestic', 45000, [
                    ('Travel', 25000),
                    ('Entertainment', 20000)
                ]),
                ('International', 30000, [
                    ('Travel', 20000),
                    ('Entertainment', 10000)
                ])
            ]
        }
        
        for dept_name, categories in categories_data.items():
            dept = Department.query.filter_by(name=dept_name).first()
            if dept:
                for cat_name, cat_budget, subcategories in categories:
                    # Check if category exists
                    category = Category.query.filter_by(name=cat_name, department_id=dept.id).first()
                    if not category:
                        category = Category(name=cat_name, budget=cat_budget, department=dept)
                        db.session.add(category)
                        db.session.commit()
                        
                        # Create subcategories
                        for subcat_name, subcat_budget in subcategories:
                            if not Subcategory.query.filter_by(name=subcat_name, category_id=category.id).first():
                                subcategory = Subcategory(name=subcat_name, budget=subcat_budget, category=category)
                                db.session.add(subcategory)
        
        db.session.commit()
        
        # Create test users if they don't exist
        if not User.query.filter_by(username='admin').first():
            admin = User(username='admin', password='admin123', is_manager=True)
            db.session.add(admin)
            
        if not User.query.filter_by(username='manager').first():
            manager = User(username='manager', password='manager123', is_manager=True, department=rd_dept)
            db.session.add(manager)
        
        if not User.query.filter_by(username='employee1').first():
            employee1 = User(username='employee1', password='employee123', department=rd_dept)
            db.session.add(employee1)
            
        if not User.query.filter_by(username='employee2').first():
            employee2 = User(username='employee2', password='employee123', department=marketing_dept)
            db.session.add(employee2)
            
        if not User.query.filter_by(username='employee3').first():
            employee3 = User(username='employee3', password='employee123', department=sales_dept)
            db.session.add(employee3)
            
        db.session.commit()
            
    app.run(debug=True)
