from flask import jsonify, request
from flask_login import login_required, current_user
from models import db, Department, Category, Subcategory, Expense, BudgetYear
from sqlalchemy import func
from . import api_v1
from services.manager_access import get_manager_access
import logging
from datetime import datetime


def _check_hr_access():
    """Check if current user has HR or admin access"""
    return current_user.is_hr or current_user.is_admin


def _get_hr_managed_dept_ids():
    """Get department IDs the current HR user is allowed to access.
    Admins get all departments; non-admin HR users get only their managed departments."""
    if current_user.is_admin:
        return None  # None means no filtering needed (all departments)
    managed_dept_ids, _ = get_manager_access(current_user)
    return managed_dept_ids


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

        # Get departments for this year, filtered by access
        managed_dept_ids = _get_hr_managed_dept_ids()
        dept_query = Department.query
        if year_id:
            dept_query = dept_query.filter_by(year_id=year_id)
        if managed_dept_ids is not None:
            dept_query = dept_query.filter(Department.id.in_(managed_dept_ids))
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

        managed_dept_ids = _get_hr_managed_dept_ids()
        if managed_dept_ids is not None and category.department_id not in managed_dept_ids:
            return jsonify({'error': 'Access denied: department not in your managed departments'}), 403

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

        managed_dept_ids = _get_hr_managed_dept_ids()
        if managed_dept_ids is not None and category.department_id not in managed_dept_ids:
            return jsonify({'error': 'Access denied: department not in your managed departments'}), 403

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


# --- HR Welfare Category & Subcategory CRUD ---

@api_v1.route('/hr/departments', methods=['GET'])
@login_required
def get_hr_departments():
    """Get departments list for a budget year (for HR dropdowns)"""
    if not _check_hr_access():
        return jsonify({'error': 'HR access required'}), 403

    try:
        year_id = request.args.get('year_id', type=int)
        managed_dept_ids = _get_hr_managed_dept_ids()
        query = Department.query
        if year_id:
            query = query.filter_by(year_id=year_id)
        else:
            current_year = BudgetYear.query.filter_by(is_current=True).first()
            if current_year:
                query = query.filter_by(year_id=current_year.id)
        if managed_dept_ids is not None:
            query = query.filter(Department.id.in_(managed_dept_ids))

        departments = query.order_by(Department.name).all()

        return jsonify({
            'departments': [{
                'id': d.id,
                'name': d.name
            } for d in departments]
        }), 200
    except Exception as e:
        logging.error(f"Error getting HR departments: {str(e)}")
        return jsonify({'error': 'Failed to fetch departments'}), 500


@api_v1.route('/hr/welfare-categories', methods=['POST'])
@login_required
def create_welfare_category():
    """Create a new welfare category for a department"""
    if not _check_hr_access():
        return jsonify({'error': 'HR access required'}), 403

    try:
        data = request.get_json()
        if not data or 'name' not in data or 'department_id' not in data:
            return jsonify({'error': 'Name and department are required'}), 400

        department = Department.query.get(int(data['department_id']))
        if not department:
            return jsonify({'error': 'Department not found'}), 404

        managed_dept_ids = _get_hr_managed_dept_ids()
        if managed_dept_ids is not None and department.id not in managed_dept_ids:
            return jsonify({'error': 'Access denied: department not in your managed departments'}), 403

        budget_val = data.get('budget')
        if budget_val == '' or budget_val is None:
            budget_val = 0.0
        else:
            budget_val = float(budget_val)

        category = Category(
            name=data['name'],
            budget=budget_val,
            is_welfare=True,
            department_id=department.id
        )

        db.session.add(category)
        db.session.commit()

        logging.info(f"Welfare category '{category.name}' created for dept '{department.name}' by {current_user.username}")

        return jsonify({
            'message': 'Welfare category created',
            'category': {
                'id': category.id,
                'name': category.name,
                'budget': category.budget,
                'is_welfare': True,
                'department_id': category.department_id
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating welfare category: {str(e)}")
        return jsonify({'error': 'Failed to create welfare category'}), 500


@api_v1.route('/hr/welfare-categories/<int:category_id>', methods=['PUT'])
@login_required
def update_welfare_category(category_id):
    """Update a welfare category (name and/or budget)"""
    if not _check_hr_access():
        return jsonify({'error': 'HR access required'}), 403

    try:
        category = Category.query.get(category_id)
        if not category or not category.is_welfare:
            return jsonify({'error': 'Welfare category not found'}), 404

        managed_dept_ids = _get_hr_managed_dept_ids()
        if managed_dept_ids is not None and category.department_id not in managed_dept_ids:
            return jsonify({'error': 'Access denied: department not in your managed departments'}), 403

        data = request.get_json()

        if 'name' in data:
            name = data['name'].strip()
            if not name:
                return jsonify({'error': 'Name cannot be empty'}), 400
            category.name = name

        if 'budget' in data:
            budget_val = data['budget']
            if budget_val == '' or budget_val is None:
                category.budget = 0.0
            else:
                category.budget = float(budget_val)

        db.session.commit()

        logging.info(f"Welfare category {category_id} updated by {current_user.username}")

        return jsonify({
            'message': 'Welfare category updated',
            'category': {
                'id': category.id,
                'name': category.name,
                'budget': category.budget,
                'is_welfare': True,
                'department_id': category.department_id
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating welfare category: {str(e)}")
        return jsonify({'error': 'Failed to update welfare category'}), 500


@api_v1.route('/hr/welfare-categories/<int:category_id>', methods=['DELETE'])
@login_required
def delete_welfare_category(category_id):
    """Delete a welfare category (only if it has no subcategories with expenses)"""
    if not _check_hr_access():
        return jsonify({'error': 'HR access required'}), 403

    try:
        category = Category.query.get(category_id)
        if not category or not category.is_welfare:
            return jsonify({'error': 'Welfare category not found'}), 404

        managed_dept_ids = _get_hr_managed_dept_ids()
        if managed_dept_ids is not None and category.department_id not in managed_dept_ids:
            return jsonify({'error': 'Access denied: department not in your managed departments'}), 403

        # Check if any subcategory has expenses
        for sub in category.subcategories:
            if sub.expenses:
                return jsonify({
                    'error': 'Cannot delete category with existing expenses. Remove the expenses first.'
                }), 400

        # Delete subcategories first, then the category
        for sub in category.subcategories:
            db.session.delete(sub)
        db.session.delete(category)
        db.session.commit()

        logging.info(f"Welfare category {category_id} deleted by {current_user.username}")

        return jsonify({'message': 'Welfare category deleted'}), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deleting welfare category: {str(e)}")
        return jsonify({'error': 'Failed to delete welfare category'}), 500


@api_v1.route('/hr/welfare-subcategories', methods=['POST'])
@login_required
def create_welfare_subcategory():
    """Create a new subcategory under a welfare category"""
    if not _check_hr_access():
        return jsonify({'error': 'HR access required'}), 403

    try:
        data = request.get_json()
        if not data or 'name' not in data or 'category_id' not in data:
            return jsonify({'error': 'Name and category are required'}), 400

        category = Category.query.get(int(data['category_id']))
        if not category or not category.is_welfare:
            return jsonify({'error': 'Welfare category not found'}), 404

        managed_dept_ids = _get_hr_managed_dept_ids()
        if managed_dept_ids is not None and category.department_id not in managed_dept_ids:
            return jsonify({'error': 'Access denied: department not in your managed departments'}), 403

        budget_val = data.get('budget')
        if budget_val == '' or budget_val is None:
            budget_val = 0.0
        else:
            budget_val = float(budget_val)

        subcategory = Subcategory(
            name=data['name'],
            budget=budget_val,
            category_id=category.id
        )

        db.session.add(subcategory)
        db.session.commit()

        logging.info(f"Welfare subcategory '{subcategory.name}' created under category '{category.name}' by {current_user.username}")

        return jsonify({
            'message': 'Welfare subcategory created',
            'subcategory': {
                'id': subcategory.id,
                'name': subcategory.name,
                'budget': subcategory.budget,
                'category_id': subcategory.category_id
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating welfare subcategory: {str(e)}")
        return jsonify({'error': 'Failed to create welfare subcategory'}), 500


@api_v1.route('/hr/welfare-subcategories/<int:subcategory_id>', methods=['PUT'])
@login_required
def update_welfare_subcategory(subcategory_id):
    """Update a welfare subcategory (name and/or budget)"""
    if not _check_hr_access():
        return jsonify({'error': 'HR access required'}), 403

    try:
        subcategory = Subcategory.query.get(subcategory_id)
        if not subcategory:
            return jsonify({'error': 'Subcategory not found'}), 404

        category = Category.query.get(subcategory.category_id)
        if not category or not category.is_welfare:
            return jsonify({'error': 'Subcategory does not belong to a welfare category'}), 404

        managed_dept_ids = _get_hr_managed_dept_ids()
        if managed_dept_ids is not None and category.department_id not in managed_dept_ids:
            return jsonify({'error': 'Access denied: department not in your managed departments'}), 403

        data = request.get_json()

        if 'name' in data:
            name = data['name'].strip()
            if not name:
                return jsonify({'error': 'Name cannot be empty'}), 400
            subcategory.name = name

        if 'budget' in data:
            budget_val = data['budget']
            if budget_val == '' or budget_val is None:
                subcategory.budget = 0.0
            else:
                subcategory.budget = float(budget_val)

        db.session.commit()

        logging.info(f"Welfare subcategory {subcategory_id} updated by {current_user.username}")

        return jsonify({
            'message': 'Welfare subcategory updated',
            'subcategory': {
                'id': subcategory.id,
                'name': subcategory.name,
                'budget': subcategory.budget,
                'category_id': subcategory.category_id
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating welfare subcategory: {str(e)}")
        return jsonify({'error': 'Failed to update welfare subcategory'}), 500


@api_v1.route('/hr/welfare-subcategories/<int:subcategory_id>', methods=['DELETE'])
@login_required
def delete_welfare_subcategory(subcategory_id):
    """Delete a welfare subcategory (only if it has no expenses)"""
    if not _check_hr_access():
        return jsonify({'error': 'HR access required'}), 403

    try:
        subcategory = Subcategory.query.get(subcategory_id)
        if not subcategory:
            return jsonify({'error': 'Subcategory not found'}), 404

        category = Category.query.get(subcategory.category_id)
        if not category or not category.is_welfare:
            return jsonify({'error': 'Subcategory does not belong to a welfare category'}), 404

        managed_dept_ids = _get_hr_managed_dept_ids()
        if managed_dept_ids is not None and category.department_id not in managed_dept_ids:
            return jsonify({'error': 'Access denied: department not in your managed departments'}), 403

        if subcategory.expenses:
            return jsonify({
                'error': 'Cannot delete subcategory with existing expenses. Remove the expenses first.'
            }), 400

        db.session.delete(subcategory)
        db.session.commit()

        logging.info(f"Welfare subcategory {subcategory_id} deleted by {current_user.username}")

        return jsonify({'message': 'Welfare subcategory deleted'}), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deleting welfare subcategory: {str(e)}")
        return jsonify({'error': 'Failed to delete welfare subcategory'}), 500
