from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime

db = SQLAlchemy()

class Department(db.Model):
    __tablename__ = 'department'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    budget = db.Column(db.Float, default=0.0)
    currency = db.Column(db.String(3), nullable=False, default='ILS')
    employees = db.relationship('User', foreign_keys='User.department_id', back_populates='home_department')
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

# Manager-Department association table
manager_departments = db.Table('manager_departments',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('department_id', db.Integer, db.ForeignKey('department.id'), primary_key=True)
)

class User(UserMixin, db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=False, nullable=False)
    password = db.Column(db.String(120), nullable=True)
    first_name = db.Column(db.String(100), nullable=True)
    last_name = db.Column(db.String(100), nullable=True)
    is_manager = db.Column(db.Boolean, default=False)
    is_admin = db.Column(db.Boolean, default=False)
    is_accounting = db.Column(db.Boolean, default=False)
    status = db.Column(db.String(20), default='active')  # active, inactive, pending
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'))
    home_department = db.relationship('Department', 
                                    foreign_keys=[department_id],
                                    back_populates='employees')
    # Add managed departments relationship
    managed_departments = db.relationship('Department', 
                                       secondary=manager_departments,
                                       backref=db.backref('department_managers', lazy='dynamic'))
    
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
                   Expense.type != 'future_approval',  # Exclude future approvals even if approved
                   Expense.date >= start_date,
                   Expense.date < end_date).scalar()
        return total or 0.0

    def get_budget_usage(self):
        """Get current month's budget usage"""
        current_date = datetime.now()
        monthly_expenses = self.get_monthly_expenses(current_date.year, current_date.month)
        if self.home_department.budget <= 0:
            return 0, monthly_expenses
        usage_percent = (monthly_expenses / self.home_department.budget) * 100
        return usage_percent, monthly_expenses

class Supplier(db.Model):
    __tablename__ = 'supplier'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255))
    phone = db.Column(db.String(50))
    address = db.Column(db.String(500))
    tax_id = db.Column(db.String(100))
    bank_name = db.Column(db.String(255))
    bank_account_number = db.Column(db.String(50))
    bank_branch = db.Column(db.String(100))
    bank_swift = db.Column(db.String(50))
    notes = db.Column(db.Text)
    status = db.Column(db.String(20), default='active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    expenses = db.relationship('Expense', backref='supplier', lazy=True)

class CreditCard(db.Model):
    __tablename__ = 'credit_card'
    id = db.Column(db.Integer, primary_key=True)
    last_four_digits = db.Column(db.String(4), nullable=False)
    description = db.Column(db.String(100))
    status = db.Column(db.String(20), default='active')  # active, inactive
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    expenses = db.relationship('Expense', backref='credit_card', lazy=True)

class Expense(db.Model):
    __tablename__ = 'expense'
    id = db.Column(db.Integer, primary_key=True)
    amount = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(3), nullable=False, default='ILS')
    description = db.Column(db.String(200))
    reason = db.Column(db.String(500))
    type = db.Column(db.String(50), nullable=False, default='needs_approval')
    date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    status = db.Column(db.String(20), default='pending')
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    subcategory_id = db.Column(db.Integer, db.ForeignKey('subcategory.id'), nullable=False)
    quote_filename = db.Column(db.String(255))
    invoice_filename = db.Column(db.String(255))
    receipt_filename = db.Column(db.String(255))
    manager_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    handled_at = db.Column(db.DateTime, nullable=True)
    rejection_reason = db.Column(db.String(500))
    is_paid = db.Column(db.Boolean, default=False)
    paid_by_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    paid_at = db.Column(db.DateTime, nullable=True)
    supplier_id = db.Column(db.Integer, db.ForeignKey('supplier.id'), nullable=True)
    invoice_date = db.Column(db.DateTime, nullable=True)
    payment_method = db.Column(db.String(50), default='credit')
    credit_card_id = db.Column(db.Integer, db.ForeignKey('credit_card.id'), nullable=True)
    payment_due_date = db.Column(db.String(20), default='end_of_month')  # 'start_of_month' or 'end_of_month'
    # Payment workflow status: waiting accounting review, then pending payment, then paid
    payment_status = db.Column(db.String(20), default='pending_attention')  # pending_attention, pending_payment, paid
    # Track if this expense was entered in external accounting system
    external_accounting_entry = db.Column(db.Boolean, default=False)
    external_accounting_entry_by_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    external_accounting_entry_at = db.Column(db.DateTime, nullable=True)
    paid_by = db.relationship('User', 
                            foreign_keys=[paid_by_id],
                            backref=db.backref('paid_expenses', lazy='dynamic'))
    external_accounting_entry_by = db.relationship('User',
                            foreign_keys=[external_accounting_entry_by_id],
                            backref=db.backref('external_accounting_entries', lazy='dynamic'))