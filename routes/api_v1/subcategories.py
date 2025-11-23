from flask import request, jsonify
from flask_login import current_user, login_required
from models import db, Subcategory
from routes.api_v1 import api_v1_bp
import logging

logger = logging.getLogger(__name__)

@api_v1_bp.route('/subcategories', methods=['GET'])
@login_required
def get_subcategories():
    try:
        category_id = request.args.get('category_id', type=int)
        query = Subcategory.query
        if category_id:
            query = query.filter_by(category_id=category_id)
        subcategories = query.all()
        return jsonify({
            'success': True,
            'data': [{'id': s.id, 'name': s.name, 'budget': float(s.budget), 'category_id': s.category_id} for s in subcategories]
        }), 200
    except Exception as e:
        logger.error(f"Get subcategories error: {str(e)}")
        return jsonify({'success': False, 'error': 'An error occurred'}), 500

@api_v1_bp.route('/subcategories', methods=['POST'])
@login_required
def create_subcategory():
    try:
        if not (current_user.is_manager or current_user.is_admin):
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        data = request.get_json()
        subcat = Subcategory(name=data['name'], budget=data.get('budget', 0), category_id=data['category_id'])
        db.session.add(subcat)
        db.session.commit()
        return jsonify({'success': True, 'data': {'id': subcat.id, 'name': subcat.name}, 'message': 'Subcategory created'}), 201
    except Exception as e:
        logger.error(f"Create subcategory error: {str(e)}")
        db.session.rollback()
        return jsonify({'success': False, 'error': 'An error occurred'}), 500

@api_v1_bp.route('/subcategories/<int:id>', methods=['PUT'])
@login_required
def update_subcategory(id):
    try:
        if not (current_user.is_manager or current_user.is_admin):
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        subcat = Subcategory.query.get_or_404(id)
        data = request.get_json()
        if 'name' in data:
            subcat.name = data['name']
        if 'budget' in data:
            subcat.budget = data['budget']
        db.session.commit()
        return jsonify({'success': True, 'data': {'id': subcat.id, 'name': subcat.name, 'budget': subcat.budget}, 'message': 'Subcategory updated'}), 200
    except Exception as e:
        logger.error(f"Update subcategory error: {str(e)}")
        db.session.rollback()
        return jsonify({'success': False, 'error': 'An error occurred'}), 500

@api_v1_bp.route('/subcategories/<int:id>', methods=['DELETE'])
@login_required
def delete_subcategory(id):
    try:
        if not (current_user.is_manager or current_user.is_admin):
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        subcat = Subcategory.query.get_or_404(id)
        db.session.delete(subcat)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Subcategory deleted'}), 200
    except Exception as e:
        logger.error(f"Delete subcategory error: {str(e)}")
        db.session.rollback()
        return jsonify({'success': False, 'error': 'An error occurred'}), 500
