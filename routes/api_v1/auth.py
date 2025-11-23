from flask import request, jsonify, session
from flask_login import login_user, logout_user, current_user, login_required
from models import db, User
from routes.api_v1 import api_v1_bp
import logging

logger = logging.getLogger(__name__)


def user_to_dict(user):
    """Convert User model to dictionary"""
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'is_manager': user.is_manager,
        'is_admin': user.is_admin,
        'is_accounting': user.is_accounting,
        # 'active': user.status == 'active',
        'active': True, # Default to True until status field is restored
        'home_department_id': user.department_id,
    }


@api_v1_bp.route('/auth/login', methods=['POST'])
def login():
    """Login endpoint"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({
                'success': False,
                'message': 'Username and password are required'
            }), 400

        user = User.query.filter_by(username=username).first()

        if not user:
            return jsonify({
                'success': False,
                'message': 'Invalid username or password'
            }), 401

        # Check if user is active
        # if user.status != 'active':
        #     return jsonify({
        #         'success': False,
        #         'message': 'Your account is not active. Please contact an administrator.'
        #     }), 403

        # TODO: Implement proper password hashing
        if user.password != password:
            return jsonify({
                'success': False,
                'message': 'Invalid username or password'
            }), 401

        # Login user
        login_user(user)
        logger.info(f"User {username} logged in successfully")

        return jsonify({
            'success': True,
            'data': {
                'user': user_to_dict(user)
            },
            'message': 'Login successful'
        }), 200

    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'An error occurred during login'
        }), 500


@api_v1_bp.route('/auth/logout', methods=['POST'])
@login_required
def logout():
    """Logout endpoint"""
    try:
        username = current_user.username
        logout_user()
        logger.info(f"User {username} logged out")

        return jsonify({
            'success': True,
            'message': 'Logout successful'
        }), 200

    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'An error occurred during logout'
        }), 500


@api_v1_bp.route('/auth/me', methods=['GET'])
@login_required
def get_current_user():
    """Get current authenticated user"""
    try:
        return jsonify({
            'success': True,
            'data': user_to_dict(current_user)
        }), 200

    except Exception as e:
        logger.error(f"Get current user error: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'An error occurred'
        }), 500


@api_v1_bp.route('/auth/change-password', methods=['POST'])
@login_required
def change_password():
    """Change user password"""
    try:
        data = request.get_json()
        current_password = data.get('current_password')
        new_password = data.get('new_password')

        if not current_password or not new_password:
            return jsonify({
                'success': False,
                'message': 'Current password and new password are required'
            }), 400

        # TODO: Implement proper password hashing
        if current_user.password != current_password:
            return jsonify({
                'success': False,
                'message': 'Current password is incorrect'
            }), 401

        # Update password
        current_user.password = new_password
        db.session.commit()

        logger.info(f"User {current_user.username} changed password")

        return jsonify({
            'success': True,
            'message': 'Password changed successfully'
        }), 200

    except Exception as e:
        logger.error(f"Change password error: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'An error occurred while changing password'
        }), 500
