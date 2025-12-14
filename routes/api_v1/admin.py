from flask import jsonify, request
from flask_login import login_required, current_user
from models import Expense, Department, Category, Subcategory, User, Supplier, CreditCard, db
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from werkzeug.security import generate_password_hash
import logging
from . import api_v1

def get_date_range(period):
    """Get start and end dates based on period"""
    today = datetime.now()
    end_date = today
    
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
        start_date, end_date = get_date_range(period)
        
        # Base query for expenses in period
        base_query = Expense.query.filter(
            Expense.date >= start_date,
            Expense.date <= end_date
        )
        
        # Total expenses
        total_expenses = base_query.filter(Expense.status == 'approved').all()
        total_amount = sum(exp.amount for exp in total_expenses)
        total_count = len(total_expenses)
        
        # Status breakdown
        status_query = db.session.query(
            Expense.status,
            func.count(Expense.id).label('count'),
            func.sum(Expense.amount).label('amount')
        ).filter(
            Expense.date >= start_date,
            Expense.date <= end_date
        ).group_by(Expense.status).all()
        
        status_distribution = [
            {'name': status, 'count': int(count), 'amount': float(amount or 0)}
            for status, count, amount in status_query
        ]
        
        approved_query = base_query.filter(Expense.status == 'approved')
        approved_amount = sum(exp.amount for exp in approved_query.all())
        approved_count = approved_query.count()
        
        pending_query = base_query.filter(Expense.status == 'pending')
        pending_amount = sum(exp.amount for exp in pending_query.all())
        pending_count = pending_query.count()
        
        rejected_query = base_query.filter(Expense.status == 'rejected')
        rejected_amount = sum(exp.amount for exp in rejected_query.all())
        rejected_count = rejected_query.count()
        
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
        
        # Budget usage by department
        departments = Department.query.all()
        budget_usage = []
        for dept in departments:
            dept_expenses = db.session.query(func.sum(Expense.amount))\
                .join(User, Expense.user_id == User.id)\
                .filter(
                    User.department_id == dept.id,
                    Expense.date >= start_date,
                    Expense.date <= end_date,
                    Expense.status == 'approved'
                ).scalar() or 0
            
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
        search = request.args.get('search', '').lower()
        
        # Base query
        query = User.query
        
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
        
        users = query.order_by(User.first_name, User.last_name).all()
        
        # Apply search filter in memory (for username, first_name, last_name, email)
        if search:
            users = [u for u in users if 
                     search in (u.username or '').lower() or
                     search in (u.first_name or '').lower() or
                     search in (u.last_name or '').lower() or
                     search in (u.email or '').lower()]
        
        users_data = []
        for user in users:
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
                'department_name': user.home_department.name if user.home_department else None
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
        db.session.commit()
        
        logging.info(f"User {user.username} created by {current_user.username}")
        
        return jsonify({
            'message': 'User created successfully',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name
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
                'department_id': user.department_id
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
        search = request.args.get('search', '').lower()
        
        query = Supplier.query
        
        if status != 'all':
            query = query.filter(Supplier.status == status)
        
        suppliers = query.order_by(Supplier.name).all()
        
        if search:
            suppliers = [s for s in suppliers if 
                        search in (s.name or '').lower() or
                        search in (s.email or '').lower() or
                        search in (s.tax_id or '').lower()]
        
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
            'expense_count': len(s.expenses)
        } for s in suppliers]
        
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
        
        query = CreditCard.query
        
        if status != 'all':
            query = query.filter(CreditCard.status == status)
        
        cards = query.order_by(CreditCard.last_four_digits).all()
        
        cards_data = [{
            'id': c.id,
            'last_four_digits': c.last_four_digits,
            'description': c.description,
            'status': c.status,
            'expense_count': len(c.expenses)
        } for c in cards]
        
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
                'status': expense.status,
                'type': expense.type,
                'payment_method': expense.payment_method,
                'payment_status': expense.payment_status,
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
                'quote_filename': expense.quote_filename,
                'accounting_notes': expense.accounting_notes
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
    """Update an expense (admin only)"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403

    try:
        expense = Expense.query.get(expense_id)
        if not expense:
            return jsonify({'error': 'Expense not found'}), 404

        data = request.get_json()

        # Update allowed fields
        if 'status' in data:
            expense.status = data['status']
            if data['status'] in ['approved', 'rejected']:
                expense.handler_id = current_user.id
                expense.handled_at = datetime.now()

        if 'payment_status' in data:
            expense.payment_status = data['payment_status']

        if 'amount' in data:
            expense.amount = data['amount']

        if 'description' in data:
            expense.description = data['description']

        if 'reason' in data:
            expense.reason = data['reason']

        if 'accounting_notes' in data:
            expense.accounting_notes = data['accounting_notes']

        db.session.commit()

        logging.info(f"Expense {expense_id} updated by admin {current_user.username}")

        return jsonify({'message': 'Expense updated successfully'}), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating expense: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to update expense'}), 500


@api_v1.route('/admin/expenses/<int:expense_id>', methods=['DELETE'])
@login_required
def admin_delete_expense(expense_id):
    """Delete an expense (admin only)"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403

    try:
        expense = Expense.query.get(expense_id)
        if not expense:
            return jsonify({'error': 'Expense not found'}), 404

        db.session.delete(expense)
        db.session.commit()

        logging.info(f"Expense {expense_id} deleted by admin {current_user.username}")

        return jsonify({'message': 'Expense deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deleting expense: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to delete expense'}), 500

