from flask import jsonify, request
from flask_login import login_required, current_user
from models import db, Expense, User, Department, Category, Subcategory, Supplier, CreditCard
from sqlalchemy import func
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
from . import api_v1
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

        # Count expenses by status
        pending = Expense.query.filter_by(
            user_id=current_user.id,
            status='pending'
        ).count()

        approved = Expense.query.filter_by(
            user_id=current_user.id,
            status='approved'
        ).count()

        rejected = Expense.query.filter_by(
            user_id=current_user.id,
            status='rejected'
        ).count()

        # Calculate total amount for this month (approved only)
        total_amount = db.session.query(func.sum(Expense.amount)).filter(
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
                .order_by(Expense.date.desc())\
                .limit(limit)\
                .all()
        else:
            # Regular users see only their own expenses
            expenses = Expense.query.filter_by(user_id=current_user.id)\
                .order_by(Expense.date.desc())\
                .limit(limit)\
                .all()

        expense_list = []
        for expense in expenses:
            expense_list.append({
                'id': expense.id,
                'amount': expense.amount,
                'currency': expense.currency,
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
            # Managers see expenses from their managed departments
            managed_dept_ids = [d.id for d in current_user.managed_departments]
            if not managed_dept_ids:
                managed_dept_ids = [current_user.department_id] if current_user.department_id else []

            if managed_dept_ids:
                count = Expense.query.join(User, Expense.user_id == User.id)\
                    .filter(
                        Expense.status == 'pending',
                        User.department_id.in_(managed_dept_ids)
                    ).count()
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

        # Get expenses from managed departments
        if current_user.is_admin:
            # Admins see all pending expenses
            expenses = Expense.query.filter_by(status='pending')\
                .order_by(Expense.date.desc())\
                .all()
        else:
            # Managers see expenses from their managed departments
            managed_dept_ids = [dept.id for dept in current_user.managed_departments]
            expenses = Expense.query.join(User)\
                .filter(
                    Expense.status == 'pending',
                    User.department_id.in_(managed_dept_ids)
                )\
                .order_by(Expense.date.desc())\
                .all()

        expense_list = []
        for expense in expenses:
            # Calculate budget impact for this expense
            budget_impact = _calculate_budget_impact(expense)
            
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
                'user': {
                    'id': expense.submitter.id,
                    'username': expense.submitter.username,
                    'name': f"{expense.submitter.first_name} {expense.submitter.last_name}",
                    'department': expense.submitter.home_department.name if expense.submitter.home_department else None
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


def _calculate_budget_impact(expense):
    """Calculate budget impact for an expense across department, category, and subcategory"""
    try:
        budget_impact = {}
        
        # Get expense amount in ILS (or convert if needed)
        expense_amount = expense.amount
        
        # Calculate Department Budget Impact
        if expense.submitter and expense.submitter.home_department:
            department = expense.submitter.home_department
            
            # Calculate used budget (approved expenses in current period)
            dept_used = db.session.query(func.sum(Expense.amount)).join(User)\
                .filter(
                    User.department_id == department.id,
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
            cat_used = db.session.query(func.sum(Expense.amount))\
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
            subcat_used = db.session.query(func.sum(Expense.amount))\
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
            func.sum(Expense.amount).label('total')
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
            func.sum(Expense.amount).label('total')
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
    """Get all departments for form dropdown"""
    try:
        departments = Department.query.filter_by().all()
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
    """Get categories for current user's department or all categories for admin"""
    try:
        department_id = request.args.get('department_id', type=int)
        include_subcategories = request.args.get('include_subcategories', 'false').lower() == 'true'
        all_categories = request.args.get('all', 'false').lower() == 'true'

        # Admin users can see all categories if 'all' param is true
        if all_categories and current_user.is_admin:
            categories = Category.query.join(Department).order_by(Department.name, Category.name).all()
        elif department_id:
            categories = Category.query.filter_by(department_id=department_id).order_by(Category.name).all()
        elif current_user.department_id:
            categories = Category.query.filter_by(department_id=current_user.department_id).order_by(Category.name).all()
        else:
            categories = Category.query.join(Department).order_by(Department.name, Category.name).all()

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
    """Get subcategories for a category"""
    try:
        category_id = request.args.get('category_id', type=int)

        if category_id:
            subcategories = Subcategory.query.filter_by(category_id=category_id).all()
        else:
            subcategories = Subcategory.query.all()

        subcat_list = [{
            'id': sub.id,
            'name': sub.name,
            'budget': sub.budget,
            'category_id': sub.category_id
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
        suppliers = Supplier.query.filter_by(status='active').all()
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
        sort_by = request.args.get('sort_by', 'date', type=str)
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
            query = query.filter(Expense.date >= datetime.fromisoformat(start_date))

        if end_date:
            query = query.filter(Expense.date <= datetime.fromisoformat(end_date))

        if search:
            query = query.filter(
                (Expense.description.ilike(f'%{search}%')) |
                (Expense.reason.ilike(f'%{search}%'))
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
                'has_invoice': bool(expense.invoice_filename),
                'has_receipt': bool(expense.receipt_filename)
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
            'description': expense.description,
            'reason': expense.reason,
            'date': expense.date.isoformat() if expense.date else None,
            'created_at': expense.created_at.isoformat() if expense.created_at else None,
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
            'budget_impact': budget_impact
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

        # Check if manager has permission for this expense's department
        if not current_user.is_admin:
            user_dept_ids = [dept.id for dept in current_user.managed_departments]
            if expense.submitter.department_id not in user_dept_ids:
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

        # Check if manager has permission for this expense's department
        if not current_user.is_admin:
            user_dept_ids = [dept.id for dept in current_user.managed_departments]
            if expense.submitter.department_id not in user_dept_ids:
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
        required_fields = ['amount', 'subcategory_id', 'expense_type', 'date']
        for field in required_fields:
            if field not in data:
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
            status='pending'
        )

        # Handle file uploads
        upload_folder = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'uploads')
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
            # Managers see their department's expenses
            managed_dept_ids = [d.id for d in current_user.managed_departments]
            if not managed_dept_ids:
                managed_dept_ids = [current_user.department_id] if current_user.department_id else []
            query = Expense.query.join(User, Expense.user_id == User.id)\
                .filter(User.department_id.in_(managed_dept_ids))
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
            query = query.join(User, Expense.user_id == User.id).filter(User.department_id == int(department_id))
        if category_id:
            query = query.join(Subcategory).filter(Subcategory.category_id == int(category_id))
        if user_id and (current_user.is_admin or current_user.is_manager):
            query = query.filter(Expense.user_id == int(user_id))
        
        expenses = query.order_by(Expense.date.desc()).all()
        
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
                'status': exp.status,
                'type': exp.type,
                'category': exp.subcategory.category.name if exp.subcategory and exp.subcategory.category else '',
                'subcategory': exp.subcategory.name if exp.subcategory else '',
                'supplier': exp.supplier.name if exp.supplier else '',
                'user': f"{exp.submitter.first_name} {exp.submitter.last_name}" if exp.submitter else '',
                'department': exp.submitter.home_department.name if exp.submitter and exp.submitter.home_department else '',
                'payment_method': exp.payment_method or '',
                'reason': exp.reason or ''
            })
            if exp.status == 'approved':
                total_amount += exp.amount
        
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

    try:
        # Get filter parameters from expense history page
        status = request.args.get('status', 'all')
        employee_id = request.args.get('employee', 'all')
        department_id = request.args.get('department', 'all')
        category_id = request.args.get('category', 'all')
        subcategory_id = request.args.get('subcategory', 'all')
        adding_month = request.args.get('adding_month', 'all')
        purchase_month = request.args.get('purchase_month', 'all')
        supplier_id = request.args.get('supplier', 'all')
        payment_method = request.args.get('payment_method', 'all')

        # Build query based on user role
        if current_user.is_admin:
            expenses = Expense.query.order_by(Expense.date.desc()).all()
        elif current_user.is_manager:
            managed_dept_ids = [dept.id for dept in current_user.managed_departments]
            if current_user.department_id:
                managed_dept_ids.append(current_user.department_id)
            expenses = db.session.query(Expense).join(User, Expense.user_id == User.id)\
                .filter(User.department_id.in_(managed_dept_ids))\
                .order_by(Expense.date.desc()).all()
        else:
            expenses = Expense.query.filter_by(user_id=current_user.id)\
                .order_by(Expense.date.desc()).all()

        # Apply filters
        if status != 'all':
            expenses = [exp for exp in expenses if exp.status == status]
        if employee_id != 'all':
            expenses = [exp for exp in expenses if exp.user_id == int(employee_id)]
        if department_id != 'all':
            expenses = [exp for exp in expenses if exp.submitter.department_id == int(department_id)]
        if category_id != 'all':
            expenses = [exp for exp in expenses if exp.subcategory and exp.subcategory.category_id == int(category_id)]
        if subcategory_id != 'all':
            expenses = [exp for exp in expenses if exp.subcategory_id == int(subcategory_id)]

        # Apply admin-only filters
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

            if supplier_id != 'all':
                expenses = [exp for exp in expenses if
                           exp.supplier_id and exp.supplier_id == int(supplier_id)]

            if payment_method != 'all':
                expenses = [exp for exp in expenses if exp.payment_method == payment_method]

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
            worksheet.write(row, 2, exp.submitter.home_department.name if exp.submitter and exp.submitter.home_department else '')
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
