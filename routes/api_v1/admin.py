from flask import jsonify, request, current_app
from flask_login import login_required, current_user
from models import Expense, Department, Category, Subcategory, User, Supplier, CreditCard, BudgetYear, db
from sqlalchemy import func, and_, or_
from sqlalchemy.orm import joinedload
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from werkzeug.security import generate_password_hash
from werkzeug.utils import secure_filename
import logging
import os
import pytz
from . import api_v1


def allowed_file(filename):
    """Check if the file extension is allowed"""
    ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'gif'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_date_range(period, custom_start=None, custom_end=None):
    """Get start and end dates based on period or custom range"""
    today = datetime.now()
    end_date = today
    
    # Handle custom date range
    if period == 'custom' and custom_start and custom_end:
        try:
            start_date = datetime.strptime(custom_start, '%Y-%m-%d')
            end_date = datetime.strptime(custom_end, '%Y-%m-%d')
            # Set end_date to end of day
            end_date = end_date.replace(hour=23, minute=59, second=59)
            return start_date, end_date
        except ValueError:
            # Fall back to this_month if invalid dates
            start_date = datetime(today.year, today.month, 1)
            return start_date, end_date
    
    if period == 'this_month':
        start_date = datetime(today.year, today.month, 1)
    elif period == 'last_month':
        if today.month == 1:
            start_date = datetime(today.year - 1, 12, 1)
            end_date = datetime(today.year, 1, 1) - timedelta(days=1)
        else:
            start_date = datetime(today.year, today.month - 1, 1)
            end_date = datetime(today.year, today.month, 1) - timedelta(days=1)
    elif period == 'this_quarter':
        current_quarter = (today.month - 1) // 3 + 1
        start_date = datetime(today.year, (current_quarter - 1) * 3 + 1, 1)
    elif period == 'this_year':
        start_date = datetime(today.year, 1, 1)
    elif period == 'last_year':
        start_date = datetime(today.year - 1, 1, 1)
        end_date = datetime(today.year - 1, 12, 31, 23, 59, 59)
    elif period == 'last_6_months':
        start_date = today - relativedelta(months=6)
    else:
        start_date = datetime(today.year, today.month, 1)
    
    return start_date, end_date

@api_v1.route('/admin/stats', methods=['GET'])
@login_required
def get_admin_stats():
    """Get comprehensive admin statistics"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    try:
        period = request.args.get('period', 'this_month')
        custom_start = request.args.get('start_date')
        custom_end = request.args.get('end_date')
        start_date, end_date = get_date_range(period, custom_start, custom_end)
        
        # Status breakdown - use a single query instead of multiple
        status_query = db.session.query(
            Expense.status,
            func.count(Expense.id).label('count'),
            func.sum(Expense.amount).label('amount')
        ).filter(
            Expense.date >= start_date,
            Expense.date <= end_date
        ).group_by(Expense.status).all()

        # Build status distribution and extract individual status stats
        status_distribution = []
        status_map = {}
        for status, count, amount in status_query:
            status_distribution.append({
                'name': status,
                'count': int(count),
                'amount': float(amount or 0)
            })
            status_map[status] = {
                'count': int(count),
                'amount': float(amount or 0)
            }

        # Extract individual status stats from the single query result
        approved_count = status_map.get('approved', {}).get('count', 0)
        approved_amount = status_map.get('approved', {}).get('amount', 0.0)
        pending_count = status_map.get('pending', {}).get('count', 0)
        pending_amount = status_map.get('pending', {}).get('amount', 0.0)
        rejected_count = status_map.get('rejected', {}).get('count', 0)
        rejected_amount = status_map.get('rejected', {}).get('amount', 0.0)

        # Total is same as approved
        total_count = approved_count
        total_amount = approved_amount
        
        # Expense trend over time
        if period in ['this_year', 'last_6_months']:
            # Monthly breakdown
            trend_query = db.session.query(
                func.date_trunc('month', Expense.date).label('month'),
                func.sum(Expense.amount).label('amount')
            ).filter(
                Expense.date >= start_date,
                Expense.date <= end_date,
                Expense.status == 'approved'
            ).group_by('month').order_by('month').all()
            
            expense_trend = [
                {
                    'period': month.strftime('%b %Y'),
                    'amount': float(amount or 0)
                }
                for month, amount in trend_query
            ]
        else:
            # Weekly breakdown for shorter periods
            trend_query = db.session.query(
                func.date_trunc('week', Expense.date).label('week'),
                func.sum(Expense.amount).label('amount')
            ).filter(
                Expense.date >= start_date,
                Expense.date <= end_date,
                Expense.status == 'approved'
            ).group_by('week').order_by('week').all()
            
            expense_trend = [
                {
                    'period': week.strftime('%b %d'),
                    'amount': float(amount or 0)
                }
                for week, amount in trend_query
            ]
        
        # Department spending
        dept_query = db.session.query(
            Department.name,
            func.sum(Expense.amount).label('amount')
        ).join(User, Department.id == User.department_id)\
         .join(Expense, User.id == Expense.user_id)\
         .filter(
             Expense.date >= start_date,
             Expense.date <= end_date,
             Expense.status == 'approved'
         ).group_by(Department.name).order_by(func.sum(Expense.amount).desc()).limit(10).all()
        
        department_spending = [
            {'name': name, 'amount': float(amount or 0)}
            for name, amount in dept_query
        ]
        
        # Category distribution
        cat_query = db.session.query(
            Category.name,
            func.sum(Expense.amount).label('amount')
        ).select_from(Expense)\
         .join(Subcategory, Expense.subcategory_id == Subcategory.id)\
         .join(Category, Subcategory.category_id == Category.id)\
         .filter(
             Expense.date >= start_date,
             Expense.date <= end_date,
             Expense.status == 'approved'
         ).group_by(Category.name).order_by(func.sum(Expense.amount).desc()).limit(10).all()
        
        category_distribution = [
            {'name': name, 'amount': float(amount or 0)}
            for name, amount in cat_query
        ]
        
        # Top users
        user_query = db.session.query(
            User.username,
            func.sum(Expense.amount).label('amount')
        ).select_from(Expense)\
         .join(User, Expense.user_id == User.id)\
         .filter(
             Expense.date >= start_date,
             Expense.date <= end_date,
             Expense.status == 'approved'
         ).group_by(User.username).order_by(func.sum(Expense.amount).desc()).limit(10).all()
        
        top_users = [
            {'name': username, 'amount': float(amount or 0)}
            for username, amount in user_query
        ]
        
        # Budget usage by department - pre-calculate all department spending in single query
        dept_spending_query = db.session.query(
            User.department_id,
            func.sum(Expense.amount).label('spent')
        ).join(User, Expense.user_id == User.id)\
         .filter(
             Expense.date >= start_date,
             Expense.date <= end_date,
             Expense.status == 'approved'
         ).group_by(User.department_id).all()

        dept_spending_map = {dept_id: float(spent or 0) for dept_id, spent in dept_spending_query}

        departments = Department.query.all()
        budget_usage = []
        for dept in departments:
            dept_expenses = dept_spending_map.get(dept.id, 0.0)
            usage_percent = (dept_expenses / dept.budget * 100) if dept.budget > 0 else 0

            budget_usage.append({
                'name': dept.name,
                'budget': float(dept.budget),
                'spent': float(dept_expenses),
                'usage_percent': float(usage_percent)
            })
        
        # Get currency (assume ILS for now, could be enhanced)
        currency = 'ILS'
        
        return jsonify({
            'total_expenses': float(total_amount),
            'total_count': total_count,
            'approved_amount': float(approved_amount),
            'approved_count': approved_count,
            'pending_amount': float(pending_amount),
            'pending_count': pending_count,
            'rejected_amount': float(rejected_amount),
            'rejected_count': rejected_count,
            'currency': currency,
            'expense_trend': expense_trend,
            'department_spending': department_spending,
            'category_distribution': category_distribution,
            'status_distribution': status_distribution,
            'top_users': top_users,
            'budget_usage': budget_usage
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting admin stats: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to fetch admin statistics'}), 500


# ==================== USER MANAGEMENT ====================

@api_v1.route('/admin/users', methods=['GET'])
@login_required
def get_all_users():
    """Get all users with filtering options"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403

    try:
        # Get query parameters
        status = request.args.get('status', 'all')
        department_id = request.args.get('department_id')
        role = request.args.get('role')
        search = request.args.get('search', '').strip()

        # Base query with eager loading to avoid N+1 queries
        query = User.query.options(joinedload(User.home_department))

        # Apply filters
        if status != 'all':
            query = query.filter(User.status == status)

        if department_id:
            query = query.filter(User.department_id == int(department_id))

        if role == 'admin':
            query = query.filter(User.is_admin == True)
        elif role == 'manager':
            query = query.filter(User.is_manager == True)
        elif role == 'accounting':
            query = query.filter(User.is_accounting == True)
        elif role == 'employee':
            query = query.filter(User.is_admin == False, User.is_manager == False, User.is_accounting == False)

        # Apply search filter in SQL instead of in-memory
        if search:
            search_pattern = f'%{search}%'
            query = query.filter(
                or_(
                    User.username.ilike(search_pattern),
                    User.first_name.ilike(search_pattern),
                    User.last_name.ilike(search_pattern),
                    User.email.ilike(search_pattern)
                )
            )

        users = query.order_by(User.first_name, User.last_name).all()

        users_data = []
        for user in users:
            # Get managed departments info
            managed_depts = [
                {'id': d.id, 'name': d.name, 'year_id': d.year_id}
                for d in user.managed_departments
            ]
            users_data.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_admin': user.is_admin,
                'is_manager': user.is_manager,
                'is_accounting': user.is_accounting,
                'status': user.status,
                'can_use_modern_version': user.can_use_modern_version,
                'department_id': user.department_id,
                'department_name': user.home_department.name if user.home_department else None,
                'managed_departments': managed_depts,
                'managed_department_ids': [d.id for d in user.managed_departments]
            })

        return jsonify({'users': users_data}), 200

    except Exception as e:
        logging.error(f"Error getting users: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to fetch users'}), 500


@api_v1.route('/admin/users', methods=['POST'])
@login_required
def create_user():
    """Create a new user"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('username') or not data.get('email'):
            return jsonify({'error': 'Username and email are required'}), 400
        
        # Check if username or email already exists
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 400
        
        # Create user
        user = User(
            username=data['username'],
            email=data['email'],
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
            is_admin=data.get('is_admin', False),
            is_manager=data.get('is_manager', False),
            is_accounting=data.get('is_accounting', False),
            status=data.get('status', 'active'),
            can_use_modern_version=data.get('can_use_modern_version', True),
            department_id=data.get('department_id')
        )
        
        # Set password if provided
        if data.get('password'):
            user.password = generate_password_hash(data['password'])
        
        db.session.add(user)
        db.session.flush()  # Get the user ID before committing
        
        # Handle managed departments for managers
        if user.is_manager and data.get('managed_department_ids'):
            managed_depts = Department.query.filter(
                Department.id.in_(data['managed_department_ids'])
            ).all()
            user.managed_departments = managed_depts
            logging.info(f"Assigned managed departments to {user.username}: {[d.name for d in managed_depts]}")
        
        db.session.commit()
        
        logging.info(f"User {user.username} created by {current_user.username}")
        
        return jsonify({
            'message': 'User created successfully',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'managed_department_ids': [d.id for d in user.managed_departments]
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating user: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to create user'}), 500


@api_v1.route('/admin/users/<int:user_id>', methods=['PUT'])
@login_required
def update_user(user_id):
    """Update a user"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        # Update fields
        if 'email' in data:
            user.email = data['email']
        if 'first_name' in data:
            user.first_name = data['first_name']
        if 'last_name' in data:
            user.last_name = data['last_name']
        if 'is_admin' in data:
            user.is_admin = data['is_admin']
        if 'is_manager' in data:
            user.is_manager = data['is_manager']
        if 'is_accounting' in data:
            user.is_accounting = data['is_accounting']
        if 'status' in data:
            user.status = data['status']
        if 'can_use_modern_version' in data:
            user.can_use_modern_version = data['can_use_modern_version']
        if 'department_id' in data:
            user.department_id = data['department_id'] if data['department_id'] else None
        if data.get('password'):
            user.password = generate_password_hash(data['password'])
        
        # Handle managed departments for managers
        if 'managed_department_ids' in data:
            if user.is_manager and data['managed_department_ids']:
                managed_depts = Department.query.filter(
                    Department.id.in_(data['managed_department_ids'])
                ).all()
                user.managed_departments = managed_depts
                logging.info(f"Updated managed departments for {user.username}: {[d.name for d in managed_depts]}")
            else:
                # Clear managed departments if not a manager or empty list
                user.managed_departments = []
        
        db.session.commit()
        
        logging.info(f"User {user.username} updated by {current_user.username}")
        
        return jsonify({
            'message': 'User updated successfully',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_admin': user.is_admin,
                'is_manager': user.is_manager,
                'is_accounting': user.is_accounting,
                'status': user.status,
                'can_use_modern_version': user.can_use_modern_version,
                'department_id': user.department_id,
                'managed_department_ids': [d.id for d in user.managed_departments]
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating user: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to update user'}), 500


@api_v1.route('/admin/users/<int:user_id>', methods=['DELETE'])
@login_required
def delete_user(user_id):
    """Delete (deactivate) a user"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Don't allow deleting yourself
        if user.id == current_user.id:
            return jsonify({'error': 'Cannot delete your own account'}), 400
        
        # Check if user has expenses
        if user.submitted_expenses:
            # Soft delete - just deactivate
            user.status = 'inactive'
            db.session.commit()
            logging.info(f"User {user.username} deactivated by {current_user.username}")
            return jsonify({'message': 'User deactivated (has associated expenses)'}), 200
        
        # Hard delete if no expenses
        db.session.delete(user)
        db.session.commit()
        
        logging.info(f"User {user_id} deleted by {current_user.username}")
        
        return jsonify({'message': 'User deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deleting user: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to delete user'}), 500


# ==================== SUPPLIER MANAGEMENT ====================

@api_v1.route('/admin/suppliers', methods=['GET'])
@login_required
def get_all_suppliers():
    """Get all suppliers"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403

    try:
        status = request.args.get('status', 'all')
        search = request.args.get('search', '').strip()

        # Use aggregate query to get expense counts and avoid N+1 queries
        query = db.session.query(
            Supplier,
            func.count(Expense.id).label('expense_count')
        ).outerjoin(Expense, Supplier.id == Expense.supplier_id)\
         .group_by(Supplier.id)

        if status != 'all':
            query = query.filter(Supplier.status == status)

        # Apply search filter in SQL instead of in-memory
        if search:
            search_pattern = f'%{search}%'
            query = query.filter(
                or_(
                    Supplier.name.ilike(search_pattern),
                    Supplier.email.ilike(search_pattern),
                    Supplier.tax_id.ilike(search_pattern)
                )
            )

        suppliers = query.order_by(Supplier.name).all()

        suppliers_data = [{
            'id': s.id,
            'name': s.name,
            'email': s.email,
            'phone': s.phone,
            'address': s.address,
            'tax_id': s.tax_id,
            'bank_name': s.bank_name,
            'bank_account_number': s.bank_account_number,
            'bank_branch': s.bank_branch,
            'bank_swift': s.bank_swift,
            'notes': s.notes,
            'status': s.status,
            'expense_count': int(expense_count)
        } for s, expense_count in suppliers]

        return jsonify({'suppliers': suppliers_data}), 200

    except Exception as e:
        logging.error(f"Error getting suppliers: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to fetch suppliers'}), 500


@api_v1.route('/admin/suppliers', methods=['POST'])
@login_required
def create_supplier():
    """Create a new supplier"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    try:
        data = request.get_json()
        
        if not data.get('name'):
            return jsonify({'error': 'Supplier name is required'}), 400
        
        supplier = Supplier(
            name=data['name'],
            email=data.get('email'),
            phone=data.get('phone'),
            address=data.get('address'),
            tax_id=data.get('tax_id'),
            bank_name=data.get('bank_name'),
            bank_account_number=data.get('bank_account_number'),
            bank_branch=data.get('bank_branch'),
            bank_swift=data.get('bank_swift'),
            notes=data.get('notes'),
            status=data.get('status', 'active')
        )
        
        db.session.add(supplier)
        db.session.commit()
        
        logging.info(f"Supplier {supplier.name} created by {current_user.username}")
        
        return jsonify({
            'message': 'Supplier created successfully',
            'supplier': {'id': supplier.id, 'name': supplier.name}
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating supplier: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to create supplier'}), 500


@api_v1.route('/admin/suppliers/<int:supplier_id>', methods=['PUT'])
@login_required
def update_supplier(supplier_id):
    """Update a supplier"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    try:
        supplier = Supplier.query.get(supplier_id)
        if not supplier:
            return jsonify({'error': 'Supplier not found'}), 404
        
        data = request.get_json()
        
        if 'name' in data:
            supplier.name = data['name']
        if 'email' in data:
            supplier.email = data['email']
        if 'phone' in data:
            supplier.phone = data['phone']
        if 'address' in data:
            supplier.address = data['address']
        if 'tax_id' in data:
            supplier.tax_id = data['tax_id']
        if 'bank_name' in data:
            supplier.bank_name = data['bank_name']
        if 'bank_account_number' in data:
            supplier.bank_account_number = data['bank_account_number']
        if 'bank_branch' in data:
            supplier.bank_branch = data['bank_branch']
        if 'bank_swift' in data:
            supplier.bank_swift = data['bank_swift']
        if 'notes' in data:
            supplier.notes = data['notes']
        if 'status' in data:
            supplier.status = data['status']
        
        db.session.commit()
        
        logging.info(f"Supplier {supplier.id} updated by {current_user.username}")
        
        return jsonify({'message': 'Supplier updated successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating supplier: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to update supplier'}), 500


@api_v1.route('/admin/suppliers/<int:supplier_id>', methods=['DELETE'])
@login_required
def delete_supplier(supplier_id):
    """Delete a supplier"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    try:
        supplier = Supplier.query.get(supplier_id)
        if not supplier:
            return jsonify({'error': 'Supplier not found'}), 404
        
        if supplier.expenses:
            supplier.status = 'inactive'
            db.session.commit()
            return jsonify({'message': 'Supplier deactivated (has associated expenses)'}), 200
        
        db.session.delete(supplier)
        db.session.commit()
        
        logging.info(f"Supplier {supplier_id} deleted by {current_user.username}")
        
        return jsonify({'message': 'Supplier deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deleting supplier: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to delete supplier'}), 500


# ==================== CREDIT CARD MANAGEMENT ====================

@api_v1.route('/admin/credit-cards', methods=['GET'])
@login_required
def get_all_credit_cards():
    """Get all credit cards"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403

    try:
        status = request.args.get('status', 'all')

        # Use aggregate query to get expense counts and avoid N+1 queries
        query = db.session.query(
            CreditCard,
            func.count(Expense.id).label('expense_count')
        ).outerjoin(Expense, CreditCard.id == Expense.credit_card_id)\
         .group_by(CreditCard.id)

        if status != 'all':
            query = query.filter(CreditCard.status == status)

        cards = query.order_by(CreditCard.last_four_digits).all()

        cards_data = [{
            'id': c.id,
            'last_four_digits': c.last_four_digits,
            'description': c.description,
            'status': c.status,
            'expense_count': int(expense_count)
        } for c, expense_count in cards]

        return jsonify({'credit_cards': cards_data}), 200

    except Exception as e:
        logging.error(f"Error getting credit cards: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to fetch credit cards'}), 500


@api_v1.route('/admin/credit-cards', methods=['POST'])
@login_required
def create_credit_card():
    """Create a new credit card"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    try:
        data = request.get_json()
        
        if not data.get('last_four_digits'):
            return jsonify({'error': 'Last four digits are required'}), 400
        
        card = CreditCard(
            last_four_digits=data['last_four_digits'],
            description=data.get('description'),
            status=data.get('status', 'active')
        )
        
        db.session.add(card)
        db.session.commit()
        
        logging.info(f"Credit card *{card.last_four_digits} created by {current_user.username}")
        
        return jsonify({
            'message': 'Credit card created successfully',
            'credit_card': {'id': card.id, 'last_four_digits': card.last_four_digits}
        }), 201
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating credit card: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to create credit card'}), 500


@api_v1.route('/admin/credit-cards/<int:card_id>', methods=['PUT'])
@login_required
def update_credit_card(card_id):
    """Update a credit card"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    try:
        card = CreditCard.query.get(card_id)
        if not card:
            return jsonify({'error': 'Credit card not found'}), 404
        
        data = request.get_json()
        
        if 'last_four_digits' in data:
            card.last_four_digits = data['last_four_digits']
        if 'description' in data:
            card.description = data['description']
        if 'status' in data:
            card.status = data['status']
        
        db.session.commit()
        
        logging.info(f"Credit card {card.id} updated by {current_user.username}")
        
        return jsonify({'message': 'Credit card updated successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating credit card: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to update credit card'}), 500


@api_v1.route('/admin/credit-cards/<int:card_id>', methods=['DELETE'])
@login_required
def delete_credit_card(card_id):
    """Delete a credit card"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    try:
        card = CreditCard.query.get(card_id)
        if not card:
            return jsonify({'error': 'Credit card not found'}), 404
        
        if card.expenses:
            card.status = 'inactive'
            db.session.commit()
            return jsonify({'message': 'Credit card deactivated (has associated expenses)'}), 200
        
        db.session.delete(card)
        db.session.commit()
        
        logging.info(f"Credit card {card_id} deleted by {current_user.username}")
        
        return jsonify({'message': 'Credit card deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deleting credit card: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to delete credit card'}), 500


@api_v1.route('/admin/expenses', methods=['GET'])
@login_required
def admin_list_expenses():
    """List all expenses for admin with filtering and pagination"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403

    try:
        # Get query parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status', None, type=str)
        department_id = request.args.get('department_id', None, type=int)
        user_id = request.args.get('user_id', None, type=int)
        category_id = request.args.get('category_id', None, type=int)
        subcategory_id = request.args.get('subcategory_id', None, type=int)
        supplier_id = request.args.get('supplier_id', None, type=int)
        payment_method = request.args.get('payment_method', None, type=str)
        start_date = request.args.get('start_date', None, type=str)
        end_date = request.args.get('end_date', None, type=str)
        search = request.args.get('search', None, type=str)
        sort_by = request.args.get('sort_by', 'date', type=str)
        sort_order = request.args.get('sort_order', 'desc', type=str)

        # Build query - admin sees all expenses
        query = Expense.query.join(User, Expense.user_id == User.id)

        # Left join Supplier for search functionality
        query = query.outerjoin(Supplier, Expense.supplier_id == Supplier.id)

        # Apply filters
        if status:
            query = query.filter(Expense.status == status)

        if department_id:
            query = query.filter(User.department_id == department_id)

        if user_id:
            query = query.filter(Expense.user_id == user_id)

        if subcategory_id:
            query = query.filter(Expense.subcategory_id == subcategory_id)
        elif category_id:
            query = query.join(Subcategory, Expense.subcategory_id == Subcategory.id).filter(Subcategory.category_id == category_id)

        if supplier_id:
            query = query.filter(Expense.supplier_id == supplier_id)

        if payment_method:
            query = query.filter(Expense.payment_method == payment_method)

        if start_date:
            query = query.filter(Expense.date >= datetime.fromisoformat(start_date))

        if end_date:
            query = query.filter(Expense.date <= datetime.fromisoformat(end_date))

        if search:
            # Search in description, reason, employee name, supplier name, and amount
            query = query.filter(
                (Expense.description.ilike(f'%{search}%')) |
                (Expense.reason.ilike(f'%{search}%')) |
                (User.first_name.ilike(f'%{search}%')) |
                (User.last_name.ilike(f'%{search}%')) |
                (Supplier.name.ilike(f'%{search}%')) |
                (func.cast(Expense.amount, db.String).ilike(f'%{search}%'))
            )

        # Apply sorting
        if sort_by == 'date':
            query = query.order_by(Expense.date.desc() if sort_order == 'desc' else Expense.date.asc())
        elif sort_by == 'amount':
            query = query.order_by(Expense.amount.desc() if sort_order == 'desc' else Expense.amount.asc())
        elif sort_by == 'status':
            query = query.order_by(Expense.status.desc() if sort_order == 'desc' else Expense.status.asc())
        else:
            query = query.order_by(Expense.date.desc())

        # Add eager loading to avoid N+1 queries
        query = query.options(
            joinedload(Expense.submitter).joinedload(User.home_department),
            joinedload(Expense.subcategory).joinedload(Subcategory.category),
            joinedload(Expense.supplier),
            joinedload(Expense.credit_card),
            joinedload(Expense.handler)
        )

        # Paginate
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        expense_list = []
        for expense in pagination.items:
            expense_list.append({
                'id': expense.id,
                'amount': expense.amount,
                'currency': expense.currency,
                'description': expense.description,
                'reason': expense.reason,
                'date': expense.date.isoformat() if expense.date else None,
                'invoice_date': expense.invoice_date.isoformat() if expense.invoice_date else None,
                'status': expense.status,
                'type': expense.type,
                'payment_method': expense.payment_method,
                'payment_status': expense.payment_status,
                'rejection_reason': expense.rejection_reason,
                'credit_card_id': expense.credit_card_id,
                'credit_card': {
                    'id': expense.credit_card.id,
                    'name': expense.credit_card.description or f"Card *{expense.credit_card.last_four_digits}",
                    'last_four_digits': expense.credit_card.last_four_digits
                } if expense.credit_card else None,
                'user': {
                    'id': expense.submitter.id,
                    'username': expense.submitter.username,
                    'name': f"{expense.submitter.first_name} {expense.submitter.last_name}".strip(),
                    'department': expense.submitter.home_department.name if expense.submitter.home_department else None,
                    'department_id': expense.submitter.department_id
                },
                'subcategory': {
                    'id': expense.subcategory.id,
                    'name': expense.subcategory.name
                } if expense.subcategory else None,
                'category': {
                    'id': expense.subcategory.category.id,
                    'name': expense.subcategory.category.name
                } if expense.subcategory and expense.subcategory.category else None,
                'supplier': {
                    'id': expense.supplier.id,
                    'name': expense.supplier.name
                } if expense.supplier else None,
                'handler': {
                    'id': expense.handler.id,
                    'name': f"{expense.handler.first_name} {expense.handler.last_name}".strip()
                } if expense.handler else None,
                'handled_at': expense.handled_at.isoformat() if expense.handled_at else None,
                'has_invoice': bool(expense.invoice_filename),
                'has_receipt': bool(expense.receipt_filename),
                'has_quote': bool(expense.quote_filename),
                'invoice_filename': expense.invoice_filename,
                'receipt_filename': expense.receipt_filename,
                'quote_filename': expense.quote_filename
            })

        return jsonify({
            'expenses': expense_list,
            'pagination': {
                'page': pagination.page,
                'per_page': pagination.per_page,
                'total': pagination.total,
                'pages': pagination.pages,
                'has_next': pagination.has_next,
                'has_prev': pagination.has_prev
            }
        }), 200

    except Exception as e:
        logging.error(f"Error listing admin expenses: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to fetch expenses'}), 500


@api_v1.route('/admin/expenses/<int:expense_id>', methods=['PUT'])
@login_required
def admin_update_expense(expense_id):
    """Update an expense (admin only) - supports all fields and file uploads"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403

    try:
        expense = Expense.query.get(expense_id)
        if not expense:
            return jsonify({'error': 'Expense not found'}), 404

        # Handle both JSON and FormData
        if request.content_type and 'multipart/form-data' in request.content_type:
            data = request.form.to_dict()
        else:
            data = request.get_json() or {}

        # Validate required fields (description and supplier_id)
        if 'description' in data and not data['description']:
            return jsonify({'error': 'Description is required'}), 400
        if 'supplier_id' in data and not data['supplier_id']:
            return jsonify({'error': 'Supplier is required'}), 400

        # Basic fields
        if 'amount' in data and data['amount']:
            expense.amount = float(data['amount'])

        if 'currency' in data and data['currency']:
            expense.currency = data['currency']

        if 'description' in data:
            expense.description = data['description']

        if 'reason' in data:
            expense.reason = data['reason']

        if 'type' in data and data['type']:
            expense.type = data['type']

        if 'subcategory_id' in data and data['subcategory_id']:
            expense.subcategory_id = int(data['subcategory_id'])

        # Status handling
        if 'status' in data and data['status']:
            old_status = expense.status
            new_status = data['status']
            expense.status = new_status

            # Set handler when status changes to approved/rejected
            if new_status in ['approved', 'rejected'] and old_status == 'pending':
                if not expense.manager_id:
                    expense.manager_id = current_user.id
                    expense.handled_at = datetime.now(pytz.utc).replace(microsecond=0)

            # Reset handler if status changed to pending
            if new_status == 'pending' and old_status != 'pending':
                expense.manager_id = None
                expense.handled_at = None

        # Date fields
        if 'date' in data and data['date']:
            try:
                expense.date = datetime.fromisoformat(data['date'].replace('Z', '+00:00'))
            except:
                expense.date = datetime.strptime(data['date'], '%Y-%m-%d')

        if 'invoice_date' in data:
            if data['invoice_date']:
                try:
                    expense.invoice_date = datetime.fromisoformat(data['invoice_date'].replace('Z', '+00:00'))
                except:
                    expense.invoice_date = datetime.strptime(data['invoice_date'], '%Y-%m-%d')
            else:
                expense.invoice_date = None

        # User assignments
        if 'user_id' in data and data['user_id']:
            expense.user_id = int(data['user_id'])

        if 'manager_id' in data:
            if data['manager_id']:
                expense.manager_id = int(data['manager_id'])
            else:
                expense.manager_id = None

        # Rejection reason
        if 'rejection_reason' in data:
            expense.rejection_reason = data['rejection_reason'] if data['rejection_reason'] else None

        # Payment related fields
        if 'payment_method' in data and data['payment_method']:
            expense.payment_method = data['payment_method']

        if 'payment_due_date' in data and data['payment_due_date']:
            expense.payment_due_date = data['payment_due_date']

        if 'payment_status' in data:
            expense.payment_status = data['payment_status'] if data['payment_status'] else 'pending_attention'

        if 'is_paid' in data:
            expense.is_paid = data['is_paid'] in [True, 'true', 'True', '1', 1, 'on']

        # Supplier and credit card
        if 'supplier_id' in data:
            if data['supplier_id']:
                expense.supplier_id = int(data['supplier_id'])
            else:
                expense.supplier_id = None

        if 'credit_card_id' in data:
            if data['credit_card_id']:
                expense.credit_card_id = int(data['credit_card_id'])
            else:
                expense.credit_card_id = None

        # Payment tracking
        if 'paid_by_id' in data:
            if data['paid_by_id']:
                expense.paid_by_id = int(data['paid_by_id'])
            else:
                expense.paid_by_id = None

        if 'paid_at' in data:
            if data['paid_at']:
                try:
                    expense.paid_at = datetime.fromisoformat(data['paid_at'].replace('Z', '+00:00'))
                except:
                    try:
                        expense.paid_at = datetime.strptime(data['paid_at'], '%Y-%m-%dT%H:%M')
                    except:
                        expense.paid_at = datetime.strptime(data['paid_at'], '%Y-%m-%d')
            else:
                expense.paid_at = None

        # Handle file uploads
        upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')

        if 'quote' in request.files:
            file = request.files['quote']
            if file and file.filename and allowed_file(file.filename):
                # Delete old file if exists
                if expense.quote_filename:
                    try:
                        old_path = os.path.join(upload_folder, expense.quote_filename)
                        if os.path.exists(old_path):
                            os.remove(old_path)
                    except OSError:
                        pass
                filename = f"{expense_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}_quote_{secure_filename(file.filename)}"
                file.save(os.path.join(upload_folder, filename))
                expense.quote_filename = filename

        if 'invoice' in request.files:
            file = request.files['invoice']
            if file and file.filename and allowed_file(file.filename):
                # Delete old file if exists
                if expense.invoice_filename:
                    try:
                        old_path = os.path.join(upload_folder, expense.invoice_filename)
                        if os.path.exists(old_path):
                            os.remove(old_path)
                    except OSError:
                        pass
                filename = f"{expense_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}_invoice_{secure_filename(file.filename)}"
                file.save(os.path.join(upload_folder, filename))
                expense.invoice_filename = filename

        if 'receipt' in request.files:
            file = request.files['receipt']
            if file and file.filename and allowed_file(file.filename):
                # Delete old file if exists
                if expense.receipt_filename:
                    try:
                        old_path = os.path.join(upload_folder, expense.receipt_filename)
                        if os.path.exists(old_path):
                            os.remove(old_path)
                    except OSError:
                        pass
                filename = f"{expense_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}_receipt_{secure_filename(file.filename)}"
                file.save(os.path.join(upload_folder, filename))
                expense.receipt_filename = filename

        # Handle file deletion requests
        if data.get('delete_quote') in [True, 'true', 'True', '1', 1]:
            if expense.quote_filename:
                try:
                    old_path = os.path.join(upload_folder, expense.quote_filename)
                    if os.path.exists(old_path):
                        os.remove(old_path)
                except OSError:
                    pass
                expense.quote_filename = None

        if data.get('delete_invoice') in [True, 'true', 'True', '1', 1]:
            if expense.invoice_filename:
                try:
                    old_path = os.path.join(upload_folder, expense.invoice_filename)
                    if os.path.exists(old_path):
                        os.remove(old_path)
                except OSError:
                    pass
                expense.invoice_filename = None

        if data.get('delete_receipt') in [True, 'true', 'True', '1', 1]:
            if expense.receipt_filename:
                try:
                    old_path = os.path.join(upload_folder, expense.receipt_filename)
                    if os.path.exists(old_path):
                        os.remove(old_path)
                except OSError:
                    pass
                expense.receipt_filename = None

        db.session.commit()

        logging.info(f"Expense {expense_id} updated by admin {current_user.username}")

        return jsonify({
            'message': 'Expense updated successfully',
            'expense': {
                'id': expense.id,
                'amount': expense.amount,
                'currency': expense.currency,
                'description': expense.description,
                'status': expense.status,
                'quote_filename': expense.quote_filename,
                'invoice_filename': expense.invoice_filename,
                'receipt_filename': expense.receipt_filename
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating expense: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to update expense: {str(e)}'}), 500


@api_v1.route('/admin/expenses/<int:expense_id>', methods=['DELETE'])
@login_required
def admin_delete_expense(expense_id):
    """Delete an expense (admin can delete any, manager can delete their own)"""
    try:
        expense = Expense.query.get(expense_id)
        if not expense:
            return jsonify({'error': 'Expense not found'}), 404

        # Check permissions: admins can delete any expense, managers can delete their own
        if not current_user.is_admin and not current_user.is_manager:
            return jsonify({'error': 'Admin or manager access required'}), 403

        # If manager, they can only delete their own expenses
        if current_user.is_manager and not current_user.is_admin:
            if expense.user_id != current_user.id:
                return jsonify({'error': 'Managers can only delete their own expenses'}), 403

        db.session.delete(expense)
        db.session.commit()

        logging.info(f"Expense {expense_id} deleted by {current_user.username} (admin={current_user.is_admin}, manager={current_user.is_manager})")

        return jsonify({'message': 'Expense deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deleting expense: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to delete expense'}), 500


# --- Move Expense to Different Budget Year ---

def find_matching_subcategory(source_subcategory, target_year_id):
    """
    Find matching subcategory in target year based on name hierarchy
    Returns: dict with 'exact_match' (Subcategory or None) and 'suggestions' (list of Subcategory)
    """
    try:
        # Get the full hierarchy of the source subcategory
        source_category = Category.query.get(source_subcategory.category_id)
        source_department = Department.query.get(source_category.department_id)

        # Try to find exact match in target year: Department -> Category -> Subcategory by names
        target_department = Department.query.filter_by(
            year_id=target_year_id,
            name=source_department.name
        ).first()

        exact_match = None
        suggestions = []

        if target_department:
            target_category = Category.query.filter_by(
                department_id=target_department.id,
                name=source_category.name
            ).first()

            if target_category:
                exact_match = Subcategory.query.filter_by(
                    category_id=target_category.id,
                    name=source_subcategory.name
                ).first()

                # Get all subcategories in this category as suggestions
                suggestions = Subcategory.query.filter_by(
                    category_id=target_category.id
                ).order_by(Subcategory.name).all()

        # If no exact match, get all subcategories in target year as suggestions
        if not suggestions:
            # Get all departments in target year
            target_departments = Department.query.filter_by(year_id=target_year_id).all()
            for dept in target_departments:
                categories = Category.query.filter_by(department_id=dept.id).all()
                for cat in categories:
                    subs = Subcategory.query.filter_by(category_id=cat.id).order_by(Subcategory.name).all()
                    suggestions.extend(subs)

        return {
            'exact_match': exact_match,
            'suggestions': suggestions[:20]  # Limit to 20 suggestions
        }

    except Exception as e:
        logging.error(f"Error finding matching subcategory: {str(e)}")
        return {'exact_match': None, 'suggestions': []}


@api_v1.route('/admin/expenses/<int:expense_id>/move-options/<int:target_year_id>', methods=['GET'])
@login_required
def get_move_expense_options(expense_id, target_year_id):
    """Get available options for moving an expense to a different budget year"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403

    try:
        # Get the expense
        expense = Expense.query.get(expense_id)
        if not expense:
            return jsonify({'error': 'Expense not found'}), 404

        # Get target budget year
        target_year = BudgetYear.query.get(target_year_id)
        if not target_year:
            return jsonify({'error': 'Target budget year not found'}), 404

        # Get current hierarchy
        current_subcategory = Subcategory.query.get(expense.subcategory_id)
        current_category = Category.query.get(current_subcategory.category_id)
        current_department = Department.query.get(current_category.department_id)
        current_budget_year = BudgetYear.query.get(current_department.year_id)

        # Find matching subcategory in target year
        match_result = find_matching_subcategory(current_subcategory, target_year_id)

        # Format response
        response = {
            'current': {
                'budget_year': {
                    'id': current_budget_year.id,
                    'year': current_budget_year.year,
                    'name': current_budget_year.name
                },
                'department': {
                    'id': current_department.id,
                    'name': current_department.name
                },
                'category': {
                    'id': current_category.id,
                    'name': current_category.name
                },
                'subcategory': {
                    'id': current_subcategory.id,
                    'name': current_subcategory.name
                }
            },
            'target': {
                'budget_year': {
                    'id': target_year.id,
                    'year': target_year.year,
                    'name': target_year.name
                }
            }
        }

        # Add exact match if found
        if match_result['exact_match']:
            exact = match_result['exact_match']
            cat = Category.query.get(exact.category_id)
            dept = Department.query.get(cat.department_id)
            response['exact_match'] = {
                'subcategory_id': exact.id,
                'subcategory_name': exact.name,
                'category_name': cat.name,
                'department_name': dept.name
            }
        else:
            response['exact_match'] = None

        # Add suggestions
        response['suggestions'] = []
        for sub in match_result['suggestions']:
            cat = Category.query.get(sub.category_id)
            dept = Department.query.get(cat.department_id)
            response['suggestions'].append({
                'subcategory_id': sub.id,
                'subcategory_name': sub.name,
                'category_name': cat.name,
                'department_name': dept.name,
                'full_path': f"{dept.name} > {cat.name} > {sub.name}"
            })

        return jsonify(response), 200

    except Exception as e:
        logging.error(f"Error getting move options: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get move options: {str(e)}'}), 500


@api_v1.route('/admin/expenses/<int:expense_id>/move-to-year', methods=['POST'])
@login_required
def move_expense_to_year(expense_id):
    """Move an expense to a different budget year by changing its subcategory"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403

    try:
        data = request.get_json()
        if not data or 'target_subcategory_id' not in data:
            return jsonify({'error': 'target_subcategory_id is required'}), 400

        target_subcategory_id = int(data['target_subcategory_id'])

        # Get the expense
        expense = Expense.query.get(expense_id)
        if not expense:
            return jsonify({'error': 'Expense not found'}), 404

        # Get target subcategory and validate it exists
        target_subcategory = Subcategory.query.get(target_subcategory_id)
        if not target_subcategory:
            return jsonify({'error': 'Target subcategory not found'}), 404

        # Get the full hierarchy for logging
        target_category = Category.query.get(target_subcategory.category_id)
        target_department = Department.query.get(target_category.department_id)
        target_year = BudgetYear.query.get(target_department.year_id)

        # Get old hierarchy for logging
        old_subcategory = Subcategory.query.get(expense.subcategory_id)
        old_category = Category.query.get(old_subcategory.category_id)
        old_department = Department.query.get(old_category.department_id)
        old_year = BudgetYear.query.get(old_department.year_id)

        # Validate that target is in a different year
        if old_year.id == target_year.id:
            return jsonify({'error': 'Target subcategory is in the same budget year'}), 400

        # Update the expense
        old_subcategory_id = expense.subcategory_id
        expense.subcategory_id = target_subcategory_id

        db.session.commit()

        # Log the action
        logging.info(
            f"Expense {expense_id} moved from budget year {old_year.year} "
            f"({old_department.name} > {old_category.name} > {old_subcategory.name}) "
            f"to budget year {target_year.year} "
            f"({target_department.name} > {target_category.name} > {target_subcategory.name}) "
            f"by admin {current_user.username}"
        )

        return jsonify({
            'message': 'Expense moved successfully',
            'expense_id': expense_id,
            'old_year': old_year.year,
            'new_year': target_year.year,
            'old_subcategory_id': old_subcategory_id,
            'new_subcategory_id': target_subcategory_id
        }), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error moving expense to year: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to move expense: {str(e)}'}), 500

