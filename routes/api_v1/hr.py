from flask import jsonify, request
from flask_login import login_required, current_user
from models import db, Department, Category, Subcategory, Expense, BudgetYear
from sqlalchemy import func
from . import api_v1
import logging
from datetime import datetime


def _check_hr_access():
    """Check if current user has HR or admin access"""
    return current_user.is_hr or current_user.is_admin


@api_v1.route('/hr/welfare-overview', methods=['GET'])
@login_required
def get_welfare_overview():
    """Get welfare budget overview across all departments"""
    if not _check_hr_access():
        return jsonify({'error': 'HR access required'}), 403

    try:
        # Determine budget year
        year_id = request.args.get('year_id', type=int)
        if not year_id:
            current_year = BudgetYear.query.filter_by(is_current=True).first()
            if not current_year:
                # Fallback: use the actual current year
                now_year = datetime.now().year
                current_year = BudgetYear.query.filter_by(year=now_year).first()
            if current_year:
                year_id = current_year.id

        # Get all departments for this year
        dept_query = Department.query
        if year_id:
            dept_query = dept_query.filter_by(year_id=year_id)
        departments = dept_query.order_by(Department.name).all()
        dept_ids = [d.id for d in departments]

        if not dept_ids:
            return jsonify({
                'summary': {
                    'total_welfare_budget': 0,
                    'total_welfare_spent': 0,
                    'total_welfare_remaining': 0,
                    'utilization_percent': 0,
                    'department_count': 0,
                    'currency': 'ILS'
                },
                'departments': [],
                'chart_data': []
            }), 200

        # Get all welfare categories for these departments
        welfare_categories = Category.query.filter(
            Category.department_id.in_(dept_ids),
            Category.is_welfare == True
        ).all()

        welfare_cat_ids = [c.id for c in welfare_categories]

        # Calculate category spending (for welfare categories only)
        cat_spending = {}
        if welfare_cat_ids:
            cat_query = db.session.query(
                Subcategory.category_id,
                func.sum(func.coalesce(Expense.amount_ils, Expense.amount)).label('spent')
            ).join(Subcategory, Expense.subcategory_id == Subcategory.id)\
             .filter(Subcategory.category_id.in_(welfare_cat_ids))\
             .filter(Expense.status == 'approved')\
             .group_by(Subcategory.category_id).all()

            for cat_id, spent in cat_query:
                cat_spending[cat_id] = float(spent) if spent else 0.0

        # Calculate subcategory spending
        subcat_spending = {}
        if welfare_cat_ids:
            # Get all subcategories for welfare categories
            welfare_subcats = Subcategory.query.filter(
                Subcategory.category_id.in_(welfare_cat_ids)
            ).all()
            welfare_subcat_ids = [s.id for s in welfare_subcats]

            if welfare_subcat_ids:
                subcat_query = db.session.query(
                    Expense.subcategory_id,
                    func.sum(func.coalesce(Expense.amount_ils, Expense.amount)).label('spent')
                ).filter(
                    Expense.subcategory_id.in_(welfare_subcat_ids),
                    Expense.status == 'approved'
                ).group_by(Expense.subcategory_id).all()

                for subcat_id, spent in subcat_query:
                    subcat_spending[subcat_id] = float(spent) if spent else 0.0

        # Map welfare categories by department
        welfare_by_dept = {}
        for cat in welfare_categories:
            if cat.department_id not in welfare_by_dept:
                welfare_by_dept[cat.department_id] = []
            welfare_by_dept[cat.department_id].append(cat)

        # Build response
        total_budget = 0
        total_spent = 0
        dept_results = []
        chart_data = []

        for dept in departments:
            dept_welfare_cats = welfare_by_dept.get(dept.id, [])
            if not dept_welfare_cats:
                continue

            for wcat in dept_welfare_cats:
                spent = cat_spending.get(wcat.id, 0.0)
                remaining = wcat.budget - spent
                utilization = (spent / wcat.budget * 100) if wcat.budget > 0 else 0

                total_budget += wcat.budget
                total_spent += spent

                # Build subcategory data
                subcats_data = []
                for sub in wcat.subcategories:
                    sub_spent = subcat_spending.get(sub.id, 0.0)
                    sub_remaining = sub.budget - sub_spent
                    subcats_data.append({
                        'id': sub.id,
                        'name': sub.name,
                        'budget': sub.budget,
                        'spent': round(sub_spent, 2),
                        'remaining': round(sub_remaining, 2),
                        'utilization_percent': round((sub_spent / sub.budget * 100) if sub.budget > 0 else 0, 1)
                    })

                dept_results.append({
                    'department_id': dept.id,
                    'department_name': dept.name,
                    'welfare_category': {
                        'id': wcat.id,
                        'name': wcat.name,
                        'budget': wcat.budget,
                        'spent': round(spent, 2),
                        'remaining': round(remaining, 2),
                        'utilization_percent': round(utilization, 1),
                        'subcategories': subcats_data
                    }
                })

                chart_data.append({
                    'name': dept.name,
                    'budget': wcat.budget,
                    'spent': round(spent, 2)
                })

        total_remaining = total_budget - total_spent
        overall_utilization = (total_spent / total_budget * 100) if total_budget > 0 else 0

        return jsonify({
            'summary': {
                'total_welfare_budget': round(total_budget, 2),
                'total_welfare_spent': round(total_spent, 2),
                'total_welfare_remaining': round(total_remaining, 2),
                'utilization_percent': round(overall_utilization, 1),
                'department_count': len(dept_results),
                'currency': 'ILS'
            },
            'departments': dept_results,
            'chart_data': chart_data
        }), 200

    except Exception as e:
        logging.error(f"Error getting welfare overview: {str(e)}")
        return jsonify({'error': 'Failed to fetch welfare overview'}), 500


@api_v1.route('/hr/welfare-budget/<int:category_id>', methods=['PUT'])
@login_required
def update_welfare_category_budget(category_id):
    """Update the budget of a welfare category"""
    if not _check_hr_access():
        return jsonify({'error': 'HR access required'}), 403

    try:
        category = Category.query.get(category_id)
        if not category or not category.is_welfare:
            return jsonify({'error': 'Welfare category not found'}), 404

        data = request.get_json()
        if 'budget' in data:
            budget_val = data['budget']
            if budget_val == '' or budget_val is None:
                category.budget = 0.0
            else:
                category.budget = float(budget_val)

        db.session.commit()

        logging.info(f"Welfare category {category_id} budget updated to {category.budget} by {current_user.username}")

        return jsonify({
            'message': 'Budget updated',
            'category': {
                'id': category.id,
                'name': category.name,
                'budget': category.budget
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating welfare category budget: {str(e)}")
        return jsonify({'error': 'Failed to update budget'}), 500


@api_v1.route('/hr/welfare-subcategory-budget/<int:subcategory_id>', methods=['PUT'])
@login_required
def update_welfare_subcategory_budget(subcategory_id):
    """Update the budget of a welfare subcategory"""
    if not _check_hr_access():
        return jsonify({'error': 'HR access required'}), 403

    try:
        subcategory = Subcategory.query.get(subcategory_id)
        if not subcategory:
            return jsonify({'error': 'Subcategory not found'}), 404

        # Verify parent category is a welfare category
        category = Category.query.get(subcategory.category_id)
        if not category or not category.is_welfare:
            return jsonify({'error': 'Subcategory does not belong to a welfare category'}), 404

        data = request.get_json()
        if 'budget' in data:
            budget_val = data['budget']
            if budget_val == '' or budget_val is None:
                subcategory.budget = 0.0
            else:
                subcategory.budget = float(budget_val)

        db.session.commit()

        logging.info(f"Welfare subcategory {subcategory_id} budget updated to {subcategory.budget} by {current_user.username}")

        return jsonify({
            'message': 'Budget updated',
            'subcategory': {
                'id': subcategory.id,
                'name': subcategory.name,
                'budget': subcategory.budget
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating welfare subcategory budget: {str(e)}")
        return jsonify({'error': 'Failed to update budget'}), 500
