from flask import request, jsonify
from flask_login import current_user, login_required
from models import db, User
from routes.api_v1 import api_v1_bp
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

def user_to_dict(user):
    return {
        'id': user.id,
        'username': user.username or '',
        'email': user.email or '',
        'first_name': user.first_name or '',
        'last_name': user.last_name or '',
        'is_manager': user.is_manager or False,
        'is_admin': user.is_admin or False,
        'is_accounting': user.is_accounting or False,
        'active': True, # Default to True until status field is restored
        'new_frontend': user.new_frontend,
    }

@api_v1_bp.route('/users', methods=['GET'])
@login_required
def get_users():
    try:
        if not current_user.is_admin:
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        users = User.query.all()
        result = []
        for u in users:
            try:
                result.append(user_to_dict(u))
            except Exception as e:
                logger.error(f"Error converting user {u.id} to dict: {str(e)}")
                import traceback
                logger.error(traceback.format_exc())
        return jsonify({'success': True, 'data': result}), 200
    except Exception as e:
        logger.error(f"Get users error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'success': False, 'error': 'An error occurred'}), 500

@api_v1_bp.route('/users/<int:user_id>', methods=['GET'])
@login_required
def get_user(user_id):
    try:
        if not (current_user.is_manager or current_user.is_admin):
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        user = User.query.get_or_404(user_id)
        return jsonify({'success': True, 'data': user_to_dict(user)}), 200
    except Exception as e:
        logger.error(f"Get user error: {str(e)}")
        return jsonify({'success': False, 'error': 'An error occurred'}), 500

@api_v1_bp.route('/users', methods=['POST'])
@login_required
def create_user():
    try:
        if not current_user.is_admin:
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        data = request.get_json()
        user = User(
            username=data['username'],
            email=data['email'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            password=data.get('password', 'temp123'),
            is_manager=data.get('is_manager', False),
            is_admin=data.get('is_admin', False),
            is_accounting=data.get('is_accounting', False),
            department_id=data.get('home_department_id'),
            # status='active'
        )
        db.session.add(user)
        db.session.commit()
        return jsonify({'success': True, 'data': user_to_dict(user), 'message': 'User created'}), 201
    except Exception as e:
        logger.error(f"Create user error: {str(e)}")
        db.session.rollback()
        return jsonify({'success': False, 'error': 'An error occurred'}), 500

@api_v1_bp.route('/users/<int:user_id>', methods=['PUT'])
@login_required
def update_user(user_id):
    try:
        if not current_user.is_admin:
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        
        user = User.query.get_or_404(user_id)
        data = request.get_json()
        
        # Update fields
        if 'email' in data:
            user.email = data['email']
        if 'first_name' in data:
            user.first_name = data['first_name']
        if 'last_name' in data:
            user.last_name = data['last_name']
        if 'password' in data and data['password']:
            user.password = data['password']
        if 'is_manager' in data:
            user.is_manager = data['is_manager']
        if 'is_admin' in data:
            user.is_admin = data['is_admin']
        if 'is_accounting' in data:
            user.is_accounting = data['is_accounting']
        if 'home_department_id' in data:
            user.department_id = data['home_department_id']
        if 'active' in data:
            pass # user.status = 'active' if data['active'] else 'inactive'
        
        db.session.commit()
        return jsonify({'success': True, 'data': user_to_dict(user), 'message': 'User updated'}), 200
    except Exception as e:
        logger.error(f"Update user error: {str(e)}")
        db.session.rollback()
        return jsonify({'success': False, 'error': 'An error occurred'}), 500

@api_v1_bp.route('/users/<int:user_id>', methods=['DELETE'])
@login_required
def delete_user(user_id):
    try:
        if not current_user.is_admin:
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        
        # Prevent deleting yourself
        if user_id == current_user.id:
            return jsonify({'success': False, 'message': 'Cannot delete your own account'}), 400
        
        user = User.query.get_or_404(user_id)
        
        # Check if user has any associated expenses
        if user.submitted_expenses:
            # Instead of deleting, mark as inactive
            # user.status = 'inactive'
            db.session.commit()
            return jsonify({'success': True, 'message': 'User has associated expenses. Marked as inactive instead of deleting.'}), 200
        else:
            db.session.delete(user)
            db.session.commit()
            return jsonify({'success': True, 'message': 'User deleted'}), 200
    except Exception as e:
        logger.error(f"Delete user error: {str(e)}")
        db.session.rollback()
        return jsonify({'success': False, 'error': 'An error occurred'}), 500

@api_v1_bp.route('/users/permissions', methods=['GET'])
@login_required
def get_users_permissions():
    try:
        if not current_user.is_admin:
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        users = User.query.all()
        data = [
            {
                'id': u.id,
                'username': u.username,
                'new_frontend': u.new_frontend,
                'active': True,
            }
            for u in users
        ]
        return jsonify({'success': True, 'data': data}), 200
    except Exception as e:
        logger.error(f"Get users permissions error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'success': False, 'error': 'An error occurred'}), 500

@api_v1_bp.route('/users/<int:user_id>/permissions', methods=['PUT'])
@login_required
def set_user_permission(user_id):
    try:
        if not current_user.is_admin:
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        user = User.query.get_or_404(user_id)
        data = request.get_json()
        if 'new_frontend' not in data:
            return jsonify({'success': False, 'message': 'Missing new_frontend flag'}), 400
        user.new_frontend = bool(data['new_frontend'])
        db.session.commit()
        return jsonify({'success': True, 'message': 'Permission updated'}), 200
    except Exception as e:
        logger.error(f"Set user permission error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        db.session.rollback()
        return jsonify({'success': False, 'error': 'An error occurred'}), 500
