from flask import request, jsonify
from flask_login import current_user, login_required
from models import db, Category
from routes.api_v1 import api_v1_bp
import logging

logger = logging.getLogger(__name__)

@api_v1_bp.route('/categories', methods=['GET'])
@login_required
def get_categories():
    try:
        department_id = request.args.get('department_id', type=int)
        query = Category.query
        if department_id:
            query = query.filter_by(department_id=department_id)
        categories = query.all()
        return jsonify({
            'success': True,
            'data': [{'id': c.id, 'name': c.name, 'budget': float(c.budget), 'department_id': c.department_id} for c in categories]
        }), 200
    except Exception as e:
        logger.error(f"Get categories error: {str(e)}")
        return jsonify({'success': False, 'error': 'An error occurred'}), 500

@api_v1_bp.route('/categories', methods=['POST'])
@login_required
def create_category():
    try:
        if not (current_user.is_manager or current_user.is_admin):
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        data = request.get_json()
        cat = Category(name=data['name'], budget=data.get('budget', 0), department_id=data['department_id'])
        db.session.add(cat)
        db.session.commit()
        return jsonify({'success': True, 'data': {'id': cat.id, 'name': cat.name}, 'message': 'Category created'}), 201
    except Exception as e:
        logger.error(f"Create category error: {str(e)}")
        db.session.rollback()
        return jsonify({'success': False, 'error': 'An error occurred'}), 500

@api_v1_bp.route('/categories/<int:id>', methods=['PUT'])
@login_required
def update_category(id):
    try:
        if not (current_user.is_manager or current_user.is_admin):
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        cat = Category.query.get_or_404(id)
        data = request.get_json()
        if 'name' in data:
            cat.name = data['name']
        if 'budget' in data:
            cat.budget = data['budget']
        db.session.commit()
        return jsonify({'success': True, 'data': {'id': cat.id, 'name': cat.name, 'budget': cat.budget}, 'message': 'Category updated'}), 200
    except Exception as e:
        logger.error(f"Update category error: {str(e)}")
        db.session.rollback()
        return jsonify({'success': False, 'error': 'An error occurred'}), 500

@api_v1_bp.route('/categories/<int:id>', methods=['DELETE'])
@login_required
def delete_category(id):
    try:
        if not (current_user.is_manager or current_user.is_admin):
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        cat = Category.query.get_or_404(id)
        db.session.delete(cat)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Category deleted'}), 200
    except Exception as e:
        logger.error(f"Delete category error: {str(e)}")
        db.session.rollback()
        return jsonify({'success': False, 'error': 'An error occurred'}), 500
