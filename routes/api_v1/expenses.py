from flask import jsonify, request, current_app
from flask_login import login_required, current_user
from models import db, Expense, User, Department, Category, Subcategory, Supplier, CreditCard, BudgetYear
from services.manager_access import get_manager_access, build_category_access_filter, has_category_access
from sqlalchemy import func, or_
from sqlalchemy.orm import joinedload
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
from . import api_v1
from services.exchange_rate import get_exchange_rate
import logging
import os

@api_v1.route('/expenses/summary', methods=['GET'])
@login_required
def get_expense_summary():
    """Get expense summary for current user"""
    try:
        # Get current month's date range
        today = datetime.now()
        start_of_month = datetime(today.year, today.month, 1)

        # Count expenses by status - use single query instead of 3 separate queries
        status_counts = db.session.query(
            Expense.status,
            func.count(Expense.id).label('count')
        ).filter(Expense.user_id == current_user.id)\
         .group_by(Expense.status).all()

        status_map = {status: count for status, count in status_counts}
        pending = status_map.get('pending', 0)
        approved = status_map.get('approved', 0)
        rejected = status_map.get('rejected', 0)

        # Calculate total amount for this month (approved only) - use ILS equivalent
        total_amount = db.session.query(func.sum(
            func.coalesce(Expense.amount_ils, Expense.amount))).filter(
            Expense.user_id == current_user.id,
            Expense.status == 'approved',
            Expense.date >= start_of_month
        ).scalar() or 0.0

        # Get budget usage if user has a department
        budget_usage = 0
        monthly_expenses = 0
        department_budget = 0

        if current_user.home_department:
            department_budget = current_user.home_department.budget
            monthly_expenses = current_user.get_monthly_expenses(today.year, today.month)
            if department_budget > 0:
                budget_usage = (monthly_expenses / department_budget) * 100

        return jsonify({
            'summary': {
                'pending': pending,
                'approved': approved,
                'rejected': rejected,
                'total_amount': round(total_amount, 2),
                'currency': current_user.home_department.currency if current_user.home_department else 'ILS'
            },
            'budget': {
                'usage_percent': round(budget_usage, 1),
                'spent': round(monthly_expenses, 2),
                'total': round(department_budget, 2),
                'currency': current_user.home_department.currency if current_user.home_department else 'ILS'
            }
        }), 200

    except Exception as e:
        logging.error(f"Error getting expense summary: {str(e)}")
        return jsonify({'error': 'Failed to fetch expense summary'}), 500

@api_v1.route('/expenses/recent', methods=['GET'])
@login_required
def get_recent_expenses():
    """Get recent expenses - all users for admin, own expenses for others"""
    try:
        limit = request.args.get('limit', 10, type=int)

        if current_user.is_admin:
            # Admin sees all expenses
            expenses = Expense.query\
                .options(
                    joinedload(Expense.submitter),
                    joinedload(Expense.subcategory).joinedload(Subcategory.category)
                )\
                .order_by(Expense.id.desc())\
                .limit(limit)\
                .all()
        elif current_user.is_manager:
            # Managers see expenses from managed departments + cross-dept categories
            managed_dept_ids, managed_cat_ids = get_manager_access(current_user)
            cat_access_filter = build_category_access_filter(managed_dept_ids, managed_cat_ids)

            if cat_access_filter is not None:
                recent_query = Expense.query.join(Subcategory, Expense.subcategory_id == Subcategory.id)\
                    .join(Category, Subcategory.category_id == Category.id)\
                    .filter(cat_access_filter)

                # HR users have a dedicated welfare dashboard; exclude welfare
                # from other departments, but keep welfare from their own department.
                if current_user.is_hr and not current_user.is_admin:
                    recent_query = recent_query.filter(or_(
                        Category.is_welfare == False,
                        Category.department_id == current_user.department_id
                    ))

                expenses = recent_query\
                    .options(
                        joinedload(Expense.submitter),
                        joinedload(Expense.subcategory).joinedload(Subcategory.category)
                    )\
                    .order_by(Expense.id.desc())\
                    .limit(limit)\
                    .all()
            else:
                expenses = Expense.query.filter_by(user_id=current_user.id)\
                    .options(
                        joinedload(Expense.submitter),
                        joinedload(Expense.subcategory).joinedload(Subcategory.category)
                    )\
                    .order_by(Expense.id.desc())\
                    .limit(limit)\
                    .all()
        else:
            # Regular users see only their own expenses
            expenses = Expense.query.filter_by(user_id=current_user.id)\
                .options(
                    joinedload(Expense.submitter),
                    joinedload(Expense.subcategory).joinedload(Subcategory.category)
                )\
                .order_by(Expense.id.desc())\
                .limit(limit)\
                .all()

        expense_list = []
        for expense in expenses:
            expense_list.append({
                'id': expense.id,
                'amount': expense.amount,
                'currency': expense.currency,
                'amount_ils': expense.amount_ils,
                'exchange_rate': expense.exchange_rate,
                'description': expense.description,
                'date': expense.date.isoformat() if expense.date else None,
                'status': expense.status,
                'subcategory': expense.subcategory.name if expense.subcategory else None,
                'category': expense.subcategory.category.name if expense.subcategory and expense.subcategory.category else None,
                'submitter': f"{expense.submitter.first_name} {expense.submitter.last_name}" if expense.submitter else None
            })

        return jsonify({'expenses': expense_list}), 200

    except Exception as e:
        logging.error(f"Error getting recent expenses: {str(e)}")
        return jsonify({'error': 'Failed to fetch recent expenses'}), 500


@api_v1.route('/expenses/pending-count', methods=['GET'])
@login_required
def get_pending_count():
    """Get count of expenses pending approval (for managers)"""
    try:
        if not current_user.is_manager and not current_user.is_admin:
            return jsonify({'count': 0}), 200

        # Get expenses from managed departments
        if current_user.is_admin:
            # Admins see all pending expenses
            count = Expense.query.filter_by(status='pending').count()
        else:
            # Managers see expenses from managed departments + cross-dept categories
            managed_dept_ids, managed_cat_ids = get_manager_access(current_user)
            cat_access_filter = build_category_access_filter(managed_dept_ids, managed_cat_ids)

            if cat_access_filter is not None:
                count_query = Expense.query.join(Subcategory, Expense.subcategory_id == Subcategory.id)\
                    .join(Category, Subcategory.category_id == Category.id)\
                    .filter(
                        Expense.status == 'pending',
                        cat_access_filter
                    )
                # HR users: exclude welfare from other departments (handled via HR dashboard)
                if current_user.is_hr and not current_user.is_admin:
                    count_query = count_query.filter(or_(
                        Category.is_welfare == False,
                        Category.department_id == current_user.department_id
                    ))
                count = count_query.count()
            else:
                count = 0

        return jsonify({'count': count}), 200

    except Exception as e:
        logging.error(f"Error getting pending count: {str(e)}")
        return jsonify({'count': 0}), 200


@api_v1.route('/expenses/pending-approval', methods=['GET'])
@login_required
def get_pending_approvals():
    """Get expenses pending approval (for managers) with budget impact analysis"""
    try:
        if not current_user.is_manager and not current_user.is_admin:
            return jsonify({'error': 'Not authorized'}), 403

        # Get expenses from managed departments with eager loading to avoid N+1 queries
        base_query = Expense.query.options(
            joinedload(Expense.submitter).joinedload(User.home_department),
            joinedload(Expense.subcategory).joinedload(Subcategory.category).joinedload(Category.department),
            joinedload(Expense.supplier)
        )

        if current_user.is_admin:
            # Admins see all pending expenses
            expenses = base_query.filter_by(status='pending')\
                .order_by(Expense.id.desc())\
                .all()
        else:
            # Managers see expenses from managed departments + cross-dept categories
            managed_dept_ids, managed_cat_ids = get_manager_access(current_user)
            cat_access_filter = build_category_access_filter(managed_dept_ids, managed_cat_ids)
            if cat_access_filter is not None:
                pending_query = base_query.join(Subcategory, Expense.subcategory_id == Subcategory.id)\
                    .join(Category, Subcategory.category_id == Category.id)\
                    .filter(
                        Expense.status == 'pending',
                        cat_access_filter
                    )

                # HR users have a dedicated welfare dashboard; exclude welfare
                # from other departments in the pending approvals view.
                if current_user.is_hr and not current_user.is_admin:
                    pending_query = pending_query.filter(or_(
                        Category.is_welfare == False,
                        Category.department_id == current_user.department_id
                    ))

                expenses = pending_query\
                    .order_by(Expense.id.desc())\
                    .all()
            else:
                expenses = []

        # Pre-calculate all budget usage in 3 queries instead of N*3 queries
        # 1. Calculate department budget usage
        dept_budget_usage = {}
        dept_usage_query = db.session.query(
            Category.department_id,
            func.sum(func.coalesce(Expense.amount_ils, Expense.amount)).label('used')
        ).join(Subcategory, Expense.subcategory_id == Subcategory.id)\
         .join(Category, Subcategory.category_id == Category.id)\
         .filter(Expense.status == 'approved')\
         .group_by(Category.department_id).all()

        for dept_id, used in dept_usage_query:
            dept_budget_usage[dept_id] = float(used) if used else 0.0

        # 2. Calculate category budget usage
        cat_budget_usage = {}
        cat_usage_query = db.session.query(
            Subcategory.category_id,
            func.sum(func.coalesce(Expense.amount_ils, Expense.amount)).label('used')
        ).join(Subcategory, Expense.subcategory_id == Subcategory.id)\
         .filter(Expense.status == 'approved')\
         .group_by(Subcategory.category_id).all()

        for cat_id, used in cat_usage_query:
            cat_budget_usage[cat_id] = float(used) if used else 0.0

        # 3. Calculate subcategory budget usage
        subcat_budget_usage = {}
        subcat_usage_query = db.session.query(
            Expense.subcategory_id,
            func.sum(func.coalesce(Expense.amount_ils, Expense.amount)).label('used')
        ).filter(Expense.status == 'approved')\
         .group_by(Expense.subcategory_id).all()

        for subcat_id, used in subcat_usage_query:
            subcat_budget_usage[subcat_id] = float(used) if used else 0.0

        # Build expense list using pre-calculated budget data
        expense_list = []
        for expense in expenses:
            # Calculate budget impact using pre-calculated data
            budget_impact = _calculate_budget_impact_optimized(
                expense,
                dept_budget_usage,
                cat_budget_usage,
                subcat_budget_usage
            )

            expense_list.append({
                'id': expense.id,
                'amount': expense.amount,
                'currency': expense.currency,
                'amount_ils': expense.amount_ils,
                'exchange_rate': expense.exchange_rate,
                'description': expense.description,
                'reason': expense.reason,
                'date': expense.date.isoformat() if expense.date else None,
                'status': expense.status,
                'type': expense.type,
                'payment_method': expense.payment_method,
                'user': {
                    'id': expense.submitter.id,
                    'username': expense.submitter.username,
                    'name': f"{expense.submitter.first_name} {expense.submitter.last_name}",
                    'department': expense.subcategory.category.department.name if expense.subcategory and expense.subcategory.category and expense.subcategory.category.department else None
                },
                'subcategory': expense.subcategory.name if expense.subcategory else None,
                'category': expense.subcategory.category.name if expense.subcategory and expense.subcategory.category else None,
                'supplier': {
                    'id': expense.supplier.id,
                    'name': expense.supplier.name
                } if expense.supplier else None,
                'budget_impact': budget_impact
            })

        return jsonify({
            'count': len(expense_list),
            'expenses': expense_list
        }), 200

    except Exception as e:
        logging.error(f"Error getting pending approvals: {str(e)}")
        return jsonify({'error': 'Failed to fetch pending approvals'}), 500


def _calculate_budget_impact_optimized(expense, dept_budget_usage, cat_budget_usage, subcat_budget_usage):
    """Calculate budget impact for an expense using pre-calculated budget usage data"""
    try:
        budget_impact = {}
        expense_amount = expense.amount_ils if expense.amount_ils else expense.amount

        # Calculate Department Budget Impact - use the budget's department (subcategory->category->department)
        if expense.subcategory and expense.subcategory.category and expense.subcategory.category.department:
            department = expense.subcategory.category.department
            dept_used = dept_budget_usage.get(department.id, 0.0)

            dept_remaining_before = department.budget - dept_used
            dept_remaining_after = dept_remaining_before - expense_amount
            dept_usage_before = (dept_used / department.budget * 100) if department.budget > 0 else 0
            dept_usage_after = ((dept_used + expense_amount) / department.budget * 100) if department.budget > 0 else 0

            budget_impact['department'] = {
                'id': department.id,
                'name': department.name,
                'budget': round(department.budget, 2),
                'used': round(dept_used, 2),
                'remaining_before': round(dept_remaining_before, 2),
                'remaining_after': round(dept_remaining_after, 2),
                'usage_percent_before': round(dept_usage_before, 1),
                'usage_percent_after': round(dept_usage_after, 1),
                'will_exceed': dept_remaining_after < 0
            }

        # Calculate Category Budget Impact
        if expense.subcategory and expense.subcategory.category:
            category = expense.subcategory.category
            cat_used = cat_budget_usage.get(category.id, 0.0)

            cat_remaining_before = category.budget - cat_used
            cat_remaining_after = cat_remaining_before - expense_amount
            cat_usage_before = (cat_used / category.budget * 100) if category.budget > 0 else 0
            cat_usage_after = ((cat_used + expense_amount) / category.budget * 100) if category.budget > 0 else 0

            budget_impact['category'] = {
                'id': category.id,
                'name': category.name,
                'budget': round(category.budget, 2),
                'used': round(cat_used, 2),
                'remaining_before': round(cat_remaining_before, 2),
                'remaining_after': round(cat_remaining_after, 2),
                'usage_percent_before': round(cat_usage_before, 1),
                'usage_percent_after': round(cat_usage_after, 1),
                'will_exceed': cat_remaining_after < 0
            }

        # Calculate Subcategory Budget Impact
        if expense.subcategory:
            subcategory = expense.subcategory
            subcat_used = subcat_budget_usage.get(subcategory.id, 0.0)

            subcat_remaining_before = subcategory.budget - subcat_used
            subcat_remaining_after = subcat_remaining_before - expense_amount
            subcat_usage_before = (subcat_used / subcategory.budget * 100) if subcategory.budget > 0 else 0
            subcat_usage_after = ((subcat_used + expense_amount) / subcategory.budget * 100) if subcategory.budget > 0 else 0

            budget_impact['subcategory'] = {
                'id': subcategory.id,
                'name': subcategory.name,
                'budget': round(subcategory.budget, 2),
                'used': round(subcat_used, 2),
                'remaining_before': round(subcat_remaining_before, 2),
                'remaining_after': round(subcat_remaining_after, 2),
                'usage_percent_before': round(subcat_usage_before, 1),
                'usage_percent_after': round(subcat_usage_after, 1),
                'will_exceed': subcat_remaining_after < 0
            }

        return budget_impact

    except Exception as e:
        logging.error(f"Error calculating budget impact: {str(e)}")
        return {}


def _calculate_budget_impact(expense):
    """Calculate budget impact for an expense across department, category, and subcategory

    Note: This is the legacy version that runs separate queries for each expense.
    Use _calculate_budget_impact_optimized() when processing multiple expenses.
    """
    try:
        budget_impact = {}

        # Get expense amount in ILS
        expense_amount = expense.amount_ils if expense.amount_ils else expense.amount

        # Calculate Department Budget Impact - use the budget's department (subcategory->category->department)
        if expense.subcategory and expense.subcategory.category and expense.subcategory.category.department:
            department = expense.subcategory.category.department

            # Calculate used budget (approved expenses in current period)
            dept_used = db.session.query(func.sum(func.coalesce(Expense.amount_ils, Expense.amount)))\
                .join(Subcategory, Expense.subcategory_id == Subcategory.id)\
                .join(Category, Subcategory.category_id == Category.id)\
                .filter(
                    Category.department_id == department.id,
                    Expense.status == 'approved'
                ).scalar() or 0.0

            dept_remaining_before = department.budget - dept_used
            dept_remaining_after = dept_remaining_before - expense_amount
            dept_usage_before = (dept_used / department.budget * 100) if department.budget > 0 else 0
            dept_usage_after = ((dept_used + expense_amount) / department.budget * 100) if department.budget > 0 else 0

            budget_impact['department'] = {
                'id': department.id,
                'name': department.name,
                'budget': round(department.budget, 2),
                'used': round(dept_used, 2),
                'remaining_before': round(dept_remaining_before, 2),
                'remaining_after': round(dept_remaining_after, 2),
                'usage_percent_before': round(dept_usage_before, 1),
                'usage_percent_after': round(dept_usage_after, 1),
                'will_exceed': dept_remaining_after < 0
            }

        # Calculate Category Budget Impact
        if expense.subcategory and expense.subcategory.category:
            category = expense.subcategory.category

            # Calculate used budget (approved expenses in this category)
            cat_used = db.session.query(func.sum(func.coalesce(Expense.amount_ils, Expense.amount)))\
                .join(Subcategory)\
                .filter(
                    Subcategory.category_id == category.id,
                    Expense.status == 'approved'
                ).scalar() or 0.0

            cat_remaining_before = category.budget - cat_used
            cat_remaining_after = cat_remaining_before - expense_amount
            cat_usage_before = (cat_used / category.budget * 100) if category.budget > 0 else 0
            cat_usage_after = ((cat_used + expense_amount) / category.budget * 100) if category.budget > 0 else 0

            budget_impact['category'] = {
                'id': category.id,
                'name': category.name,
                'budget': round(category.budget, 2),
                'used': round(cat_used, 2),
                'remaining_before': round(cat_remaining_before, 2),
                'remaining_after': round(cat_remaining_after, 2),
                'usage_percent_before': round(cat_usage_before, 1),
                'usage_percent_after': round(cat_usage_after, 1),
                'will_exceed': cat_remaining_after < 0
            }

        # Calculate Subcategory Budget Impact
        if expense.subcategory:
            subcategory = expense.subcategory

            # Calculate used budget (approved expenses in this subcategory)
            subcat_used = db.session.query(func.sum(func.coalesce(Expense.amount_ils, Expense.amount)))\
                .filter(
                    Expense.subcategory_id == subcategory.id,
                    Expense.status == 'approved'
                ).scalar() or 0.0

            subcat_remaining_before = subcategory.budget - subcat_used
            subcat_remaining_after = subcat_remaining_before - expense_amount
            subcat_usage_before = (subcat_used / subcategory.budget * 100) if subcategory.budget > 0 else 0
            subcat_usage_after = ((subcat_used + expense_amount) / subcategory.budget * 100) if subcategory.budget > 0 else 0

            budget_impact['subcategory'] = {
                'id': subcategory.id,
                'name': subcategory.name,
                'budget': round(subcategory.budget, 2),
                'used': round(subcat_used, 2),
                'remaining_before': round(subcat_remaining_before, 2),
                'remaining_after': round(subcat_remaining_after, 2),
                'usage_percent_before': round(subcat_usage_before, 1),
                'usage_percent_after': round(subcat_usage_after, 1),
                'will_exceed': subcat_remaining_after < 0
            }

        return budget_impact

    except Exception as e:
        logging.error(f"Error calculating budget impact: {str(e)}")
        return {}

@api_v1.route('/expenses/stats', methods=['GET'])
@login_required
def get_expense_stats():
    """Get expense statistics for charts"""
    try:
        # Get last 6 months of data
        today = datetime.now()
        six_months_ago = today - timedelta(days=180)

        # Get expenses by month
        monthly_data = db.session.query(
            func.date_trunc('month', Expense.date).label('month'),
            func.sum(func.coalesce(Expense.amount_ils, Expense.amount)).label('total')
        ).filter(
            Expense.user_id == current_user.id,
            Expense.status == 'approved',
            Expense.date >= six_months_ago
        ).group_by('month').order_by('month').all()

        months = []
        amounts = []
        for month, total in monthly_data:
            months.append(month.strftime('%b %Y'))
            amounts.append(float(total))

        # Get expenses by category
        category_data = db.session.query(
            Category.name,
            func.sum(func.coalesce(Expense.amount_ils, Expense.amount)).label('total')
        ).join(Subcategory).join(Expense).filter(
            Expense.user_id == current_user.id,
            Expense.status == 'approved',
            Expense.date >= six_months_ago
        ).group_by(Category.name).all()

        categories = []
        category_amounts = []
        for category, total in category_data:
            categories.append(category)
            category_amounts.append(float(total))

        return jsonify({
            'monthly': {
                'labels': months,
                'data': amounts
            },
            'by_category': {
                'labels': categories,
                'data': category_amounts
            }
        }), 200

    except Exception as e:
        logging.error(f"Error getting expense stats: {str(e)}")
        return jsonify({'error': 'Failed to fetch expense statistics'}), 500

@api_v1.route('/form-data/departments', methods=['GET'])
@login_required
def get_departments():
    """Get all departments for form dropdown (filtered by current budget year)"""
    try:
        # Get current budget year
        current_year = BudgetYear.query.filter_by(is_current=True).first()

        if current_year:
            departments = Department.query.filter_by(year_id=current_year.id).all()
        else:
            departments = Department.query.all()

        dept_list = [{
            'id': dept.id,
            'name': dept.name,
            'budget': dept.budget,
            'currency': dept.currency
        } for dept in departments]
        return jsonify({'departments': dept_list}), 200
    except Exception as e:
        logging.error(f"Error getting departments: {str(e)}")
        return jsonify({'error': 'Failed to fetch departments'}), 500

@api_v1.route('/form-data/categories', methods=['GET'])
@login_required
def get_categories():
    """Get categories for current user's department or all categories for admin (filtered by budget year)"""
    try:
        department_id = request.args.get('department_id', type=int)
        include_subcategories = request.args.get('include_subcategories', 'false').lower() == 'true'
        all_categories = request.args.get('all', 'false').lower() == 'true'
        budget_year_param = request.args.get('budget_year', type=int)

        # Get budget year - use parameter if provided, otherwise fall back to current year
        if budget_year_param:
            target_year = BudgetYear.query.filter_by(year=budget_year_param).first()
        else:
            target_year = BudgetYear.query.filter_by(is_current=True).first()

        # Base query - always filter by target budget year
        base_query = Category.query.join(Department)
        if target_year:
            base_query = base_query.filter(Department.year_id == target_year.id)

        # Admin users can see all categories if 'all' param is true
        if all_categories and current_user.is_admin:
            categories = base_query.order_by(Department.name, Category.name).all()
        elif department_id:
            categories = base_query.filter(Category.department_id == department_id).order_by(Category.name).all()
        elif current_user.department_id:
            # Get the user's department in the target budget year
            user_dept = Department.query.get(current_user.department_id)
            if user_dept and target_year:
                # Find matching home department in target year by name
                target_year_dept = Department.query.filter_by(
                    name=user_dept.name,
                    year_id=target_year.id
                ).first()

                if current_user.is_manager:
                    # Managers: include home dept + managed depts + managed categories
                    accessible_dept_ids = set()
                    if target_year_dept:
                        accessible_dept_ids.add(target_year_dept.id)

                    # Resolve managed departments to target budget year by name
                    for managed_dept in current_user.managed_departments:
                        dept_in_target_year = Department.query.filter_by(
                            name=managed_dept.name,
                            year_id=target_year.id
                        ).first()
                        if dept_in_target_year:
                            accessible_dept_ids.add(dept_in_target_year.id)

                    # Resolve directly managed categories to target budget year
                    direct_cat_ids = set()
                    for managed_cat in current_user.managed_categories:
                        if managed_cat.department:
                            dept_in_target_year = Department.query.filter_by(
                                name=managed_cat.department.name,
                                year_id=target_year.id
                            ).first()
                            if dept_in_target_year:
                                cat = Category.query.filter_by(
                                    name=managed_cat.name,
                                    department_id=dept_in_target_year.id
                                ).first()
                                if cat:
                                    direct_cat_ids.add(cat.id)

                    # Build combined filter
                    conditions = []
                    if accessible_dept_ids:
                        conditions.append(Category.department_id.in_(list(accessible_dept_ids)))
                    if direct_cat_ids:
                        conditions.append(Category.id.in_(list(direct_cat_ids)))

                    if conditions:
                        categories = base_query.filter(or_(*conditions)).order_by(Department.name, Category.name).all()
                    else:
                        categories = []
                else:
                    # Non-manager: home department only
                    if target_year_dept:
                        categories = base_query.filter(Category.department_id == target_year_dept.id).order_by(Category.name).all()
                    else:
                        categories = base_query.filter(Category.department_id == current_user.department_id).order_by(Category.name).all()
            else:
                categories = base_query.filter(Category.department_id == current_user.department_id).order_by(Category.name).all()
        else:
            categories = base_query.order_by(Department.name, Category.name).all()

        cat_list = []
        for cat in categories:
            cat_data = {
                'id': cat.id,
                'name': cat.name,
                'budget': cat.budget,
                'department_id': cat.department_id,
                'department_name': cat.department.name if cat.department else None
            }
            if include_subcategories:
                cat_data['subcategories'] = [{
                    'id': sub.id,
                    'name': sub.name,
                    'budget': sub.budget,
                    'category_id': sub.category_id
                } for sub in cat.subcategories]
            cat_list.append(cat_data)

        return jsonify({'categories': cat_list}), 200
    except Exception as e:
        logging.error(f"Error getting categories: {str(e)}")
        return jsonify({'error': 'Failed to fetch categories'}), 500

@api_v1.route('/form-data/subcategories', methods=['GET'])
@login_required
def get_subcategories():
    """Get subcategories for a category (filtered by current budget year)"""
    try:
        category_id = request.args.get('category_id', type=int)

        if category_id:
            subcategories = Subcategory.query.filter_by(category_id=category_id).all()
        else:
            # Filter by current budget year when getting all subcategories
            current_year = BudgetYear.query.filter_by(is_current=True).first()
            if current_year:
                subcategories = Subcategory.query.join(Category).join(Department).filter(
                    Department.year_id == current_year.id
                ).all()
            else:
                subcategories = Subcategory.query.all()

        subcat_list = [{
            'id': sub.id,
            'name': sub.name,
            'budget': sub.budget,
            'category_id': sub.category_id,
            'category_name': sub.category.name if sub.category else None,
            'department_name': sub.category.department.name if sub.category and sub.category.department else None
        } for sub in subcategories]

        return jsonify({'subcategories': subcat_list}), 200
    except Exception as e:
        logging.error(f"Error getting subcategories: {str(e)}")
        return jsonify({'error': 'Failed to fetch subcategories'}), 500

@api_v1.route('/form-data/suppliers', methods=['GET'])
@login_required
def get_suppliers():
    """Get all active suppliers"""
    try:
        suppliers = Supplier.query.filter(
            or_(Supplier.status == 'active', Supplier.status.is_(None))
        ).all()
        supplier_list = [{
            'id': sup.id,
            'name': sup.name,
            'email': sup.email,
            'phone': sup.phone
        } for sup in suppliers]
        return jsonify({'suppliers': supplier_list}), 200
    except Exception as e:
        logging.error(f"Error getting suppliers: {str(e)}")
        return jsonify({'error': 'Failed to fetch suppliers'}), 500


@api_v1.route('/form-data/suppliers', methods=['POST'])
@login_required
def create_supplier_quick():
    """Create a new supplier - available to all logged-in users"""
    try:
        data = request.get_json()
        
        if not data.get('name'):
            return jsonify({'error': 'Supplier name is required'}), 400
        
        # Check if supplier with same name already exists
        existing = Supplier.query.filter_by(name=data['name']).first()
        if existing:
            return jsonify({'error': 'A supplier with this name already exists'}), 400
        
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
            iban=data.get('iban'),
            notes=data.get('notes'),
            status='active'
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


@api_v1.route('/form-data/credit-cards', methods=['GET'])
@login_required
def get_credit_cards():
    """Get all active credit cards"""
    try:
        cards = CreditCard.query.filter_by(status='active').all()
        card_list = [{
            'id': card.id,
            'last_four_digits': card.last_four_digits,
            'description': card.description
        } for card in cards]
        return jsonify({'credit_cards': card_list}), 200
    except Exception as e:
        logging.error(f"Error getting credit cards: {str(e)}")
        return jsonify({'error': 'Failed to fetch credit cards'}), 500

@api_v1.route('/expenses', methods=['GET'])
@login_required
def list_expenses():
    """List all expenses for current user with filtering and pagination"""
    try:
        # Get query parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status', None, type=str)
        category_id = request.args.get('category_id', None, type=int)
        subcategory_id = request.args.get('subcategory_id', None, type=int)
        start_date = request.args.get('start_date', None, type=str)
        end_date = request.args.get('end_date', None, type=str)
        search = request.args.get('search', None, type=str)
        sort_by = request.args.get('sort_by', 'id', type=str)  # Default to insertion order (newest first)
        sort_order = request.args.get('sort_order', 'desc', type=str)

        # Build query
        query = Expense.query.filter_by(user_id=current_user.id)

        # Apply filters
        if status:
            query = query.filter_by(status=status)

        if subcategory_id:
            query = query.filter_by(subcategory_id=subcategory_id)
        elif category_id:
            query = query.join(Subcategory).filter(Subcategory.category_id == category_id)

        if start_date:
            try:
                query = query.filter(Expense.date >= datetime.fromisoformat(start_date))
            except ValueError:
                return jsonify({'error': 'Invalid start_date format. Use ISO format (YYYY-MM-DD)'}), 400

        if end_date:
            try:
                query = query.filter(Expense.date <= datetime.fromisoformat(end_date))
            except ValueError:
                return jsonify({'error': 'Invalid end_date format. Use ISO format (YYYY-MM-DD)'}), 400

        if search:
            query = query.filter(
                (Expense.description.ilike(f'%{search}%')) |
                (Expense.reason.ilike(f'%{search}%'))
            )

        # Apply sorting
        if sort_by == 'id':
            query = query.order_by(Expense.id.desc() if sort_order == 'desc' else Expense.id.asc())
        elif sort_by == 'date':
            query = query.order_by(Expense.date.desc() if sort_order == 'desc' else Expense.date.asc())
        elif sort_by == 'amount':
            query = query.order_by(Expense.amount.desc() if sort_order == 'desc' else Expense.amount.asc())
        elif sort_by == 'status':
            query = query.order_by(Expense.status.desc() if sort_order == 'desc' else Expense.status.asc())
        else:
            query = query.order_by(Expense.id.desc())

        # Add eager loading to avoid N+1 queries
        query = query.options(
            joinedload(Expense.subcategory).joinedload(Subcategory.category),
            joinedload(Expense.supplier)
        )

        # Paginate
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        expense_list = []
        for expense in pagination.items:
            expense_list.append({
                'id': expense.id,
                'amount': expense.amount,
                'currency': expense.currency,
                'amount_ils': expense.amount_ils,
                'exchange_rate': expense.exchange_rate,
                'description': expense.description,
                'reason': expense.reason,
                'date': expense.date.isoformat() if expense.date else None,
                'status': expense.status,
                'type': expense.type,
                'payment_method': expense.payment_method,
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
                'invoice_filename': expense.invoice_filename,
                'receipt_filename': expense.receipt_filename,
                'quote_filename': expense.quote_filename,
                'submit_date': expense.submit_date.isoformat() if expense.submit_date else None,
                'invoice_date': expense.invoice_date.isoformat() if expense.invoice_date else None
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
        logging.error(f"Error listing expenses: {str(e)}")
        return jsonify({'error': 'Failed to fetch expenses'}), 500

@api_v1.route('/expenses/<int:expense_id>', methods=['GET'])
@login_required
def get_expense_details(expense_id):
    """Get detailed information about a specific expense"""
    try:
        expense = Expense.query.get(expense_id)

        if not expense:
            return jsonify({'error': 'Expense not found'}), 404

        # Check if user has permission to view this expense
        if expense.user_id != current_user.id and not current_user.is_manager and not current_user.is_admin:
            return jsonify({'error': 'Not authorized'}), 403

        # Calculate budget impact if expense is pending
        budget_impact = None
        if expense.status == 'pending':
            budget_impact = _calculate_budget_impact(expense)

        expense_data = {
            'id': expense.id,
            'amount': expense.amount,
            'currency': expense.currency,
            'amount_ils': expense.amount_ils,
            'exchange_rate': expense.exchange_rate,
            'description': expense.description,
            'reason': expense.reason,
            'date': expense.date.isoformat() if expense.date else None,
            'status': expense.status,
            'type': expense.type,
            'payment_method': expense.payment_method,
            'payment_due_date': expense.payment_due_date,
            'submitter': {
                'id': expense.submitter.id,
                'username': expense.submitter.username,
                'name': f"{expense.submitter.first_name} {expense.submitter.last_name}",
                'email': expense.submitter.email
            },
            'subcategory': {
                'id': expense.subcategory.id,
                'name': expense.subcategory.name,
                'budget': expense.subcategory.budget
            } if expense.subcategory else None,
            'category': {
                'id': expense.subcategory.category.id,
                'name': expense.subcategory.category.name,
                'budget': expense.subcategory.category.budget
            } if expense.subcategory and expense.subcategory.category else None,
            'supplier': {
                'id': expense.supplier.id,
                'name': expense.supplier.name,
                'email': expense.supplier.email,
                'phone': expense.supplier.phone
            } if expense.supplier else None,
            'credit_card': {
                'id': expense.credit_card.id,
                'last_four_digits': expense.credit_card.last_four_digits,
                'description': expense.credit_card.description
            } if expense.credit_card else None,
            'invoice_filename': expense.invoice_filename,
            'receipt_filename': expense.receipt_filename,
            'quote_filename': expense.quote_filename,
            'rejection_reason': expense.rejection_reason,
            'budget_impact': budget_impact,
            'submit_date': expense.submit_date.isoformat() if expense.submit_date else None,
            'created_at': expense.submit_date.isoformat() if expense.submit_date else None
        }

        return jsonify({'expense': expense_data}), 200

    except Exception as e:
        logging.error(f"Error getting expense details: {str(e)}")
        return jsonify({'error': 'Failed to fetch expense details'}), 500

@api_v1.route('/expenses/<int:expense_id>/approve', methods=['PUT'])
@login_required
def approve_expense(expense_id):
    """Approve an expense (managers/admins only)"""
    try:
        if not current_user.is_manager and not current_user.is_admin:
            return jsonify({'error': 'Not authorized'}), 403

        expense = Expense.query.get(expense_id)

        if not expense:
            return jsonify({'error': 'Expense not found'}), 404

        if expense.status != 'pending':
            return jsonify({'error': f'Cannot approve expense with status: {expense.status}'}), 400

        # Check if manager has permission for this expense's category/department
        if not current_user.is_admin:
            expense_cat_id = expense.subcategory.category.id if expense.subcategory and expense.subcategory.category else None
            expense_dept_id = expense.subcategory.category.department_id if expense.subcategory and expense.subcategory.category else None
            if not has_category_access(current_user, expense_cat_id, expense_dept_id):
                return jsonify({'error': 'Not authorized to approve this expense'}), 403

        expense.status = 'approved'
        db.session.commit()

        logging.info(f"Expense {expense_id} approved by {current_user.username}")

        return jsonify({
            'message': 'Expense approved successfully',
            'expense_id': expense.id,
            'status': expense.status
        }), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error approving expense: {str(e)}")
        return jsonify({'error': 'Failed to approve expense'}), 500

@api_v1.route('/expenses/<int:expense_id>/reject', methods=['PUT'])
@login_required
def reject_expense(expense_id):
    """Reject an expense (managers/admins only)"""
    try:
        if not current_user.is_manager and not current_user.is_admin:
            return jsonify({'error': 'Not authorized'}), 403

        expense = Expense.query.get(expense_id)

        if not expense:
            return jsonify({'error': 'Expense not found'}), 404

        if expense.status != 'pending':
            return jsonify({'error': f'Cannot reject expense with status: {expense.status}'}), 400

        # Check if manager has permission for this expense's category/department
        if not current_user.is_admin:
            expense_cat_id = expense.subcategory.category.id if expense.subcategory and expense.subcategory.category else None
            expense_dept_id = expense.subcategory.category.department_id if expense.subcategory and expense.subcategory.category else None
            if not has_category_access(current_user, expense_cat_id, expense_dept_id):
                return jsonify({'error': 'Not authorized to reject this expense'}), 403

        data = request.get_json() or {}
        rejection_reason = data.get('reason', '')

        expense.status = 'rejected'
        if rejection_reason:
            expense.rejection_reason = rejection_reason

        db.session.commit()

        logging.info(f"Expense {expense_id} rejected by {current_user.username}")

        return jsonify({
            'message': 'Expense rejected successfully',
            'expense_id': expense.id,
            'status': expense.status
        }), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error rejecting expense: {str(e)}")
        return jsonify({'error': 'Failed to reject expense'}), 500

@api_v1.route('/expenses/submit', methods=['POST'])
@login_required
def submit_expense():
    """Submit a new expense"""
    try:
        data = request.form

        # Validate required fields
        required_fields = ['amount', 'subcategory_id', 'expense_type', 'date', 'description', 'supplier_id']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        # Create expense
        expense = Expense(
            amount=float(data['amount']),
            currency=data.get('currency', 'ILS'),
            description=data.get('description', ''),
            reason=data.get('reason', ''),
            type=data['expense_type'],
            date=datetime.fromisoformat(data['date']),
            user_id=current_user.id,
            subcategory_id=int(data['subcategory_id']),
            supplier_id=int(data['supplier_id']) if data.get('supplier_id') else None,
            payment_method=data.get('payment_method', 'credit'),
            credit_card_id=int(data['credit_card_id']) if data.get('credit_card_id') else None,
            payment_due_date=data.get('payment_due_date', 'end_of_month'),
            status='approved',  # All expenses are auto-approved
            submit_date=datetime.utcnow()  # Track when the expense was submitted
        )

        # Calculate ILS equivalent
        try:
            if expense.currency == 'ILS':
                expense.amount_ils = expense.amount
                expense.exchange_rate = 1.0
            else:
                rate = get_exchange_rate(expense.currency, expense.date.date() if hasattr(expense.date, 'date') else expense.date)
                expense.exchange_rate = rate
                expense.amount_ils = round(expense.amount * rate, 2)
        except Exception as e:
            logging.warning(f"Failed to get exchange rate for {expense.currency}: {e}. Using amount as-is.")
            expense.amount_ils = expense.amount
            expense.exchange_rate = 1.0

        # Auto-mark credit card and standing order payments as paid for auto-approved expenses
        if (data.get('payment_method') in ['credit', 'standing_order']) and expense.status == 'approved':
            expense.is_paid = True
            expense.paid_at = datetime.utcnow()
            expense.paid_by_id = current_user.id
            expense.payment_status = 'paid'

        # Handle file uploads - use configured UPLOAD_FOLDER for consistency with download route
        upload_folder = current_app.config.get('UPLOAD_FOLDER')
        if not upload_folder:
            logging.error("UPLOAD_FOLDER is not configured in app.config")
            return jsonify({'error': 'Server configuration error'}), 500
        os.makedirs(upload_folder, exist_ok=True)

        if 'invoice' in request.files:
            file = request.files['invoice']
            if file and file.filename:
                filename = secure_filename(f"{current_user.id}_{datetime.now().timestamp()}_{file.filename}")
                file.save(os.path.join(upload_folder, filename))
                expense.invoice_filename = filename

        if 'receipt' in request.files:
            file = request.files['receipt']
            if file and file.filename:
                filename = secure_filename(f"{current_user.id}_{datetime.now().timestamp()}_{file.filename}")
                file.save(os.path.join(upload_folder, filename))
                expense.receipt_filename = filename

        if 'quote' in request.files:
            file = request.files['quote']
            if file and file.filename:
                filename = secure_filename(f"{current_user.id}_{datetime.now().timestamp()}_{file.filename}")
                file.save(os.path.join(upload_folder, filename))
                expense.quote_filename = filename

        db.session.add(expense)
        db.session.commit()

        logging.info(f"Expense {expense.id} submitted by {current_user.username}")

        return jsonify({
            'message': 'Expense submitted successfully',
            'expense_id': expense.id,
            'status': expense.status
        }), 201

    except ValueError as e:
        logging.error(f"Validation error submitting expense: {str(e)}")
        return jsonify({'error': f'Invalid data: {str(e)}'}), 400
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error submitting expense: {str(e)}")
        return jsonify({'error': 'Failed to submit expense'}), 500


@api_v1.route('/exchange-rate', methods=['GET'])
@login_required
def get_exchange_rate_endpoint():
    """Get exchange rate for a currency on a given date"""
    try:
        currency = request.args.get('currency', 'USD')
        date_str = request.args.get('date')
        amount = request.args.get('amount', type=float)

        if currency == 'ILS':
            return jsonify({
                'currency': 'ILS',
                'rate': 1.0,
                'amount_ils': amount if amount else None
            }), 200

        from datetime import date as date_type
        if date_str:
            target_date = date_type.fromisoformat(date_str)
        else:
            target_date = date_type.today()

        rate = get_exchange_rate(currency, target_date)

        result = {
            'currency': currency,
            'date': target_date.isoformat(),
            'rate': rate
        }
        if amount is not None:
            result['amount_ils'] = round(amount * rate, 2)

        return jsonify(result), 200

    except Exception as e:
        logging.error(f"Error getting exchange rate: {str(e)}")
        return jsonify({'error': 'Failed to get exchange rate'}), 500


@api_v1.route('/expenses/report', methods=['GET'])
@login_required
def get_expense_report():
    """Get expense report with filters"""
    try:
        # Get filter parameters
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        status = request.args.get('status')
        department_id = request.args.get('department_id')
        category_id = request.args.get('category_id')
        user_id = request.args.get('user_id')
        
        # Build query based on user role
        if current_user.is_admin:
            query = Expense.query
        elif current_user.is_manager:
            # Managers see expenses from managed departments + cross-dept categories
            managed_dept_ids, managed_cat_ids = get_manager_access(current_user)
            cat_access_filter = build_category_access_filter(managed_dept_ids, managed_cat_ids)
            if cat_access_filter is not None:
                query = Expense.query.join(Subcategory, Expense.subcategory_id == Subcategory.id)\
                    .join(Category, Subcategory.category_id == Category.id)\
                    .filter(cat_access_filter)
                # HR users: exclude welfare from other departments (handled via HR dashboard)
                if current_user.is_hr:
                    query = query.filter(or_(
                        Category.is_welfare == False,
                        Category.department_id == current_user.department_id
                    ))
            else:
                query = Expense.query.filter_by(user_id=current_user.id)
        else:
            # Regular users see only their expenses
            query = Expense.query.filter_by(user_id=current_user.id)

        # Apply filters
        if start_date:
            query = query.filter(Expense.date >= datetime.strptime(start_date, '%Y-%m-%d'))
        if end_date:
            query = query.filter(Expense.date <= datetime.strptime(end_date, '%Y-%m-%d'))
        if status and status != 'all':
            query = query.filter(Expense.status == status)
        if department_id and current_user.is_admin:
            query = query.join(Subcategory, Expense.subcategory_id == Subcategory.id)\
                .join(Category, Subcategory.category_id == Category.id)\
                .filter(Category.department_id == int(department_id))
        if category_id:
            if not (department_id and current_user.is_admin) and not current_user.is_manager:
                query = query.join(Subcategory, Expense.subcategory_id == Subcategory.id)
            query = query.filter(Subcategory.category_id == int(category_id))
        if user_id and (current_user.is_admin or current_user.is_manager):
            query = query.filter(Expense.user_id == int(user_id))
        
        expenses = query.order_by(Expense.id.desc()).all()
        
        # Build response
        report_data = []
        total_amount = 0
        
        for exp in expenses:
            report_data.append({
                'id': exp.id,
                'date': exp.date.strftime('%Y-%m-%d') if exp.date else '',
                'description': exp.description or '',
                'amount': exp.amount,
                'currency': exp.currency,
                'amount_ils': exp.amount_ils,
                'exchange_rate': exp.exchange_rate,
                'status': exp.status,
                'type': exp.type,
                'category': exp.subcategory.category.name if exp.subcategory and exp.subcategory.category else '',
                'subcategory': exp.subcategory.name if exp.subcategory else '',
                'supplier': exp.supplier.name if exp.supplier else '',
                'user': f"{exp.submitter.first_name} {exp.submitter.last_name}" if exp.submitter else '',
                'department': exp.subcategory.category.department.name if exp.subcategory and exp.subcategory.category and exp.subcategory.category.department else '',
                'payment_method': exp.payment_method or '',
                'reason': exp.reason or ''
            })
            if exp.status == 'approved':
                total_amount += (exp.amount_ils if exp.amount_ils else exp.amount)
        
        return jsonify({
            'expenses': report_data,
            'total_count': len(report_data),
            'total_approved_amount': round(total_amount, 2),
            'filters_applied': {
                'start_date': start_date,
                'end_date': end_date,
                'status': status,
                'department_id': department_id,
                'category_id': category_id
            }
        }), 200
        
    except Exception as e:
        logging.error(f"Error generating expense report: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to generate report'}), 500


@api_v1.route('/expenses/export', methods=['GET'])
@login_required
def export_expenses():
    """Export expenses as XLSX"""
    from flask import send_file
    import xlsxwriter
    from io import BytesIO
    from datetime import datetime as dt

    try:
        # Get filter parameters - support both old (Flask template) and new (React) parameter names
        status = request.args.get('status', 'all')

        # Support both 'employee' (old) and 'user_id' (new) parameters
        employee_id = request.args.get('employee', request.args.get('user_id', 'all'))

        # Support both 'department' (old) and 'department_id' (new) parameters
        department_id = request.args.get('department', request.args.get('department_id', 'all'))

        # Support both 'category' (old) and 'category_id' (new) parameters
        category_id = request.args.get('category', request.args.get('category_id', 'all'))

        # Support both 'subcategory' (old) and 'subcategory_id' (new) parameters
        subcategory_id = request.args.get('subcategory', request.args.get('subcategory_id', 'all'))

        # Support both 'supplier' (old) and 'supplier_id' (new) parameters
        supplier_id = request.args.get('supplier', request.args.get('supplier_id', 'all'))

        payment_method = request.args.get('payment_method', 'all')

        # Date range filters (React version)
        start_date = request.args.get('start_date', None)
        end_date = request.args.get('end_date', None)

        # Month filters (Flask template version)
        adding_month = request.args.get('adding_month', 'all')
        purchase_month = request.args.get('purchase_month', 'all')

        # Search parameter (React version)
        search = request.args.get('search', None)

        # Build query based on user role
        if current_user.is_admin:
            expenses = Expense.query.order_by(Expense.id.desc()).all()
        elif current_user.is_manager:
            managed_dept_ids, managed_cat_ids = get_manager_access(current_user)
            cat_access_filter = build_category_access_filter(managed_dept_ids, managed_cat_ids)
            if cat_access_filter is not None:
                export_query = db.session.query(Expense).join(Subcategory, Expense.subcategory_id == Subcategory.id)\
                    .join(Category, Subcategory.category_id == Category.id)\
                    .filter(cat_access_filter)
                # HR users: exclude welfare from other departments (handled via HR dashboard)
                if current_user.is_hr:
                    export_query = export_query.filter(or_(
                        Category.is_welfare == False,
                        Category.department_id == current_user.department_id
                    ))
                expenses = export_query.order_by(Expense.id.desc()).all()
            else:
                expenses = Expense.query.filter_by(user_id=current_user.id)\
                    .order_by(Expense.id.desc()).all()
        else:
            expenses = Expense.query.filter_by(user_id=current_user.id)\
                .order_by(Expense.id.desc()).all()

        # Apply filters
        if status != 'all' and status:
            expenses = [exp for exp in expenses if exp.status == status]

        if employee_id != 'all' and employee_id:
            expenses = [exp for exp in expenses if exp.user_id == int(employee_id)]

        # Filter by the budget's department (subcategory -> category -> department)
        if department_id != 'all' and department_id:
            expenses = [exp for exp in expenses if exp.subcategory and exp.subcategory.category and exp.subcategory.category.department_id == int(department_id)]

        if category_id != 'all' and category_id:
            expenses = [exp for exp in expenses if exp.subcategory and exp.subcategory.category_id == int(category_id)]

        if subcategory_id != 'all' and subcategory_id:
            expenses = [exp for exp in expenses if exp.subcategory_id == int(subcategory_id)]

        if supplier_id != 'all' and supplier_id:
            expenses = [exp for exp in expenses if exp.supplier_id and exp.supplier_id == int(supplier_id)]

        if payment_method != 'all' and payment_method:
            expenses = [exp for exp in expenses if exp.payment_method == payment_method]

        # Apply date range filters (React version)
        if start_date:
            start_dt = dt.fromisoformat(start_date)
            expenses = [exp for exp in expenses if exp.date and exp.date >= start_dt]

        if end_date:
            end_dt = dt.fromisoformat(end_date)
            expenses = [exp for exp in expenses if exp.date and exp.date <= end_dt]

        # Apply search filter
        if search:
            search_lower = search.lower()
            expenses = [exp for exp in expenses if
                       (exp.description and search_lower in exp.description.lower()) or
                       (exp.reason and search_lower in exp.reason.lower()) or
                       (exp.submitter and search_lower in (exp.submitter.first_name + ' ' + exp.submitter.last_name).lower()) or
                       (exp.supplier and exp.supplier.name and search_lower in exp.supplier.name.lower()) or
                       (search_lower in str(exp.amount))]

        # Apply admin-only month filters (Flask template version)
        if current_user.is_admin:
            if adding_month != 'all':
                year, month = adding_month.split('-')
                expenses = [exp for exp in expenses if
                           exp.date.year == int(year) and exp.date.month == int(month)]

            if purchase_month != 'all':
                year, month = purchase_month.split('-')
                expenses = [exp for exp in expenses if
                           exp.invoice_date and exp.invoice_date.year == int(year) and
                           exp.invoice_date.month == int(month)]

        # Create XLSX file in memory
        output = BytesIO()
        workbook = xlsxwriter.Workbook(output, {'in_memory': True})
        worksheet = workbook.add_worksheet('Expenses')

        # Define formats
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#4472C4',
            'font_color': 'white',
            'border': 1,
            'align': 'center',
            'valign': 'vcenter'
        })

        currency_format = workbook.add_format({'num_format': '#,##0.00'})
        date_format = workbook.add_format({'num_format': 'dd/mm/yyyy hh:mm'})
        date_only_format = workbook.add_format({'num_format': 'dd/mm/yyyy'})

        status_formats = {
            'approved': workbook.add_format({'bg_color': '#C6EFCE', 'font_color': '#006100'}),
            'rejected': workbook.add_format({'bg_color': '#FFC7CE', 'font_color': '#9C0006'}),
            'pending': workbook.add_format({'bg_color': '#FFEB9C', 'font_color': '#9C6500'})
        }

        # Write headers
        headers = [
            'Date', 'Employee', 'Department', 'Description', 'Reason', 'Supplier',
            'Invoice Date', 'Category', 'Subcategory', 'Type', 'Payment Method',
            'Amount', 'Currency', 'Status', 'Payment Status', 'Handled By', 'Handled At'
        ]

        for col, header in enumerate(headers):
            worksheet.write(0, col, header, header_format)

        # Set column widths
        worksheet.set_column(0, 0, 18)  # Date
        worksheet.set_column(1, 1, 15)  # Employee
        worksheet.set_column(2, 2, 15)  # Department
        worksheet.set_column(3, 3, 30)  # Description
        worksheet.set_column(4, 4, 30)  # Reason
        worksheet.set_column(5, 5, 20)  # Supplier
        worksheet.set_column(6, 6, 12)  # Invoice Date
        worksheet.set_column(7, 7, 15)  # Category
        worksheet.set_column(8, 8, 15)  # Subcategory
        worksheet.set_column(9, 9, 12)  # Type
        worksheet.set_column(10, 10, 15) # Payment Method
        worksheet.set_column(11, 11, 12) # Amount
        worksheet.set_column(12, 12, 8)  # Currency
        worksheet.set_column(13, 13, 12) # Status
        worksheet.set_column(14, 14, 15) # Payment Status
        worksheet.set_column(15, 15, 15) # Handled By
        worksheet.set_column(16, 16, 18) # Handled At

        # Write data rows
        for row, exp in enumerate(expenses, start=1):
            worksheet.write_datetime(row, 0, exp.date, date_format)
            worksheet.write(row, 1, exp.submitter.username if exp.submitter else '')
            worksheet.write(row, 2, exp.subcategory.category.department.name if exp.subcategory and exp.subcategory.category and exp.subcategory.category.department else '')
            worksheet.write(row, 3, exp.description or '')
            worksheet.write(row, 4, exp.reason or '')
            worksheet.write(row, 5, exp.supplier.name if exp.supplier else '')

            if exp.invoice_date:
                worksheet.write_datetime(row, 6, exp.invoice_date, date_only_format)
            else:
                worksheet.write(row, 6, '')

            worksheet.write(row, 7, exp.subcategory.category.name if exp.subcategory and exp.subcategory.category else '')
            worksheet.write(row, 8, exp.subcategory.name if exp.subcategory else '')
            worksheet.write(row, 9, exp.type or '')
            worksheet.write(row, 10, exp.payment_method or '')
            worksheet.write(row, 11, exp.amount, currency_format)
            worksheet.write(row, 12, exp.currency)

            # Write status with conditional formatting
            status_format = status_formats.get(exp.status)
            worksheet.write(row, 13, exp.status, status_format)

            # Payment status
            payment_status = ''
            if exp.payment_status == 'paid':
                payment_status = 'PAID'
            elif exp.payment_status == 'pending_payment':
                payment_status = 'Payment Pending'
            elif exp.payment_status == 'pending_attention' and exp.status == 'approved':
                payment_status = 'Processing'
            worksheet.write(row, 14, payment_status)

            worksheet.write(row, 15, exp.handler.username if exp.handler and exp.status != 'pending' else '')

            if exp.handled_at:
                worksheet.write_datetime(row, 16, exp.handled_at, date_format)
            else:
                worksheet.write(row, 16, '')

        # Add autofilter
        worksheet.autofilter(0, 0, len(expenses), len(headers) - 1)

        # Freeze header row
        worksheet.freeze_panes(1, 0)

        workbook.close()
        output.seek(0)

        filename = f'expenses_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'

        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )

    except Exception as e:
        logging.error(f"Error exporting expenses: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to export expenses'}), 500
