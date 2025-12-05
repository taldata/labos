from flask import jsonify, request
from flask_login import login_required, current_user
from models import Expense, Department, Category, Subcategory, User, db
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
        ).join(Subcategory)\
         .join(Expense)\
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
        ).join(Expense)\
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

