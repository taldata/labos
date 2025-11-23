from flask import request, jsonify
from flask_login import current_user, login_required
from models import db, Department, Category
from routes.api_v1 import api_v1_bp
import logging

logger = logging.getLogger(__name__)


def department_to_dict(dept):
    """Convert Department model to dictionary"""
    return {
        'id': dept.id,
        'name': dept.name,
        'budget': float(dept.budget),
        'currency': dept.currency,
    }


@api_v1_bp.route('/departments', methods=['GET'])
@login_required
def get_departments():
    """Get all departments"""
    try:
        departments = Department.query.all()
        return jsonify({
            'success': True,
            'data': [department_to_dict(d) for d in departments]
        }), 200
    except Exception as e:
        logger.error(f"Get departments error: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'An error occurred'
        }), 500


@api_v1_bp.route('/departments/<int:dept_id>', methods=['GET'])
@login_required
def get_department(dept_id):
    """Get a single department"""
    try:
        dept = Department.query.get(dept_id)
        if not dept:
            return jsonify({
                'success': False,
                'message': 'Department not found'
            }), 404

        return jsonify({
            'success': True,
            'data': department_to_dict(dept)
        }), 200
    except Exception as e:
        logger.error(f"Get department error: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'An error occurred'
        }), 500


@api_v1_bp.route('/departments', methods=['POST'])
@login_required
def create_department():
    """Create a new department (manager/admin only)"""
    try:
        if not (current_user.is_manager or current_user.is_admin):
            return jsonify({
                'success': False,
                'message': 'Access denied'
            }), 403

        data = request.get_json()
        name = data.get('name')
        budget = data.get('budget', 0)
        currency = data.get('currency', 'ILS')

        if not name:
            return jsonify({
                'success': False,
                'message': 'Department name is required'
            }), 400

        dept = Department(name=name, budget=budget, currency=currency)
        db.session.add(dept)
        db.session.commit()

        logger.info(f"Department {dept.id} created by user {current_user.id}")

        return jsonify({
            'success': True,
            'data': department_to_dict(dept),
            'message': 'Department created successfully'
        }), 201
    except Exception as e:
        logger.error(f"Create department error: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'An error occurred'
        }), 500


@api_v1_bp.route('/departments/<int:dept_id>', methods=['PUT'])
@login_required
def update_department(dept_id):
    """Update a department (manager/admin only)"""
    try:
        if not (current_user.is_manager or current_user.is_admin):
            return jsonify({
                'success': False,
                'message': 'Access denied'
            }), 403

        dept = Department.query.get(dept_id)
        if not dept:
            return jsonify({
                'success': False,
                'message': 'Department not found'
            }), 404

        data = request.get_json()
        if 'name' in data:
            dept.name = data['name']
        if 'budget' in data:
            dept.budget = data['budget']
        if 'currency' in data:
            dept.currency = data['currency']

        db.session.commit()

        logger.info(f"Department {dept_id} updated by user {current_user.id}")

        return jsonify({
            'success': True,
            'data': department_to_dict(dept),
            'message': 'Department updated successfully'
        }), 200
    except Exception as e:
        logger.error(f"Update department error: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'An error occurred'
        }), 500


@api_v1_bp.route('/departments/<int:dept_id>', methods=['DELETE'])
@login_required
def delete_department(dept_id):
    """Delete a department (admin only)"""
    try:
        if not current_user.is_admin:
            return jsonify({
                'success': False,
                'message': 'Access denied'
            }), 403

        dept = Department.query.get(dept_id)
        if not dept:
            return jsonify({
                'success': False,
                'message': 'Department not found'
            }), 404

        db.session.delete(dept)
        db.session.commit()

        logger.info(f"Department {dept_id} deleted by user {current_user.id}")

        return jsonify({
            'success': True,
            'message': 'Department deleted successfully'
        }), 200
    except Exception as e:
        logger.error(f"Delete department error: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'An error occurred'
        }), 500
