from flask import jsonify
from flask_login import current_user, login_required
from models import db, Expense
from routes.api_v1 import api_v1_bp
from sqlalchemy import func
import logging

logger = logging.getLogger(__name__)

@api_v1_bp.route('/dashboard/employee', methods=['GET'])
@login_required
def get_employee_dashboard():
    try:
        expenses = Expense.query.filter_by(user_id=current_user.id).all()
        
        total_expenses = len(expenses)
        pending_expenses = len([e for e in expenses if e.status == 'pending'])
        approved_expenses = len([e for e in expenses if e.status == 'approved'])
        rejected_expenses = len([e for e in expenses if e.status == 'rejected'])
        
        total_amount = sum([float(e.amount) for e in expenses])
        pending_amount = sum([float(e.amount) for e in expenses if e.status == 'pending'])
        approved_amount = sum([float(e.amount) for e in expenses if e.status == 'approved'])
        
        return jsonify({
            'success': True,
            'data': {
                'total_expenses': total_expenses,
                'pending_expenses': pending_expenses,
                'approved_expenses': approved_expenses,
                'rejected_expenses': rejected_expenses,
                'total_amount': total_amount,
                'pending_amount': pending_amount,
                'approved_amount': approved_amount,
            }
        }), 200
    except Exception as e:
        logger.error(f"Get employee dashboard error: {str(e)}")
        return jsonify({'success': False, 'error': 'An error occurred'}), 500

@api_v1_bp.route('/dashboard/manager', methods=['GET'])
@login_required
def get_manager_dashboard():
    try:
        if not current_user.is_manager:
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        # Similar to employee but with manager-specific data
        return jsonify({'success': True, 'data': {}}), 200
    except Exception as e:
        logger.error(f"Get manager dashboard error: {str(e)}")
        return jsonify({'success': False, 'error': 'An error occurred'}), 500

@api_v1_bp.route('/dashboard/admin', methods=['GET'])
@login_required
def get_admin_dashboard():
    try:
        if not current_user.is_admin:
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        return jsonify({'success': True, 'data': {}}), 200
    except Exception as e:
        logger.error(f"Get admin dashboard error: {str(e)}")
        return jsonify({'success': False, 'error': 'An error occurred'}), 500

@api_v1_bp.route('/dashboard/accounting', methods=['GET'])
@login_required
def get_accounting_dashboard():
    try:
        if not current_user.is_accounting:
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        return jsonify({'success': True, 'data': {}}), 200
    except Exception as e:
        logger.error(f"Get accounting dashboard error: {str(e)}")
        return jsonify({'success': False, 'error': 'An error occurred'}), 500
