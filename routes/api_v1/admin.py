from flask import jsonify, request
from flask_login import login_required, current_user
from models import Expense, Department, Category, Subcategory, User, db
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
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

