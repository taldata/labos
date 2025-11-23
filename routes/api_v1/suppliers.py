from flask import request, jsonify
from flask_login import current_user, login_required
from models import db, Supplier
from routes.api_v1 import api_v1_bp
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

def supplier_to_dict(s):
    return {
        'id': s.id,
        'name': s.name,
        'email': s.email,
        'phone': s.phone,
        'address': s.address,
        'tax_id': s.tax_id,
        'bank_name': s.bank_name,
        'bank_account_number': s.bank_account_number,
        'bank_branch': s.bank_branch,
        'bank_swift': s.bank_swift,
        'notes': s.notes,
        'status': s.status,
    }

@api_v1_bp.route('/suppliers', methods=['GET'])
@login_required
def get_suppliers():
    try:
        # Show all suppliers (not just active) for admin
        if current_user.is_admin or current_user.is_accounting:
            suppliers = Supplier.query.all()
        else:
            suppliers = Supplier.query.filter_by(status='active').all()
        return jsonify({'success': True, 'data': [supplier_to_dict(s) for s in suppliers]}), 200
    except Exception as e:
        logger.error(f"Get suppliers error: {str(e)}")
        return jsonify({'success': False, 'error': 'An error occurred'}), 500

@api_v1_bp.route('/suppliers/<int:supplier_id>', methods=['GET'])
@login_required
def get_supplier(supplier_id):
    try:
        supplier = Supplier.query.get_or_404(supplier_id)
        return jsonify({'success': True, 'data': supplier_to_dict(supplier)}), 200
    except Exception as e:
        logger.error(f"Get supplier error: {str(e)}")
        return jsonify({'success': False, 'error': 'An error occurred'}), 500

@api_v1_bp.route('/suppliers/search', methods=['GET'])
@login_required
def search_suppliers():
    try:
        query = request.args.get('q', '')
        suppliers = Supplier.query.filter(
            Supplier.name.ilike(f'%{query}%'),
            Supplier.status == 'active'
        ).limit(10).all()
        return jsonify({'success': True, 'data': [supplier_to_dict(s) for s in suppliers]}), 200
    except Exception as e:
        logger.error(f"Search suppliers error: {str(e)}")
        return jsonify({'success': False, 'error': 'An error occurred'}), 500

@api_v1_bp.route('/suppliers', methods=['POST'])
@login_required
def create_supplier():
    try:
        if not (current_user.is_admin or current_user.is_accounting):
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        
        data = request.get_json()
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
            notes=data.get('notes'),
            status=data.get('status', 'active')
        )
        db.session.add(supplier)
        db.session.commit()
        return jsonify({'success': True, 'data': supplier_to_dict(supplier), 'message': 'Supplier created'}), 201
    except Exception as e:
        logger.error(f"Create supplier error: {str(e)}")
        db.session.rollback()
        return jsonify({'success': False, 'error': 'An error occurred'}), 500

@api_v1_bp.route('/suppliers/<int:supplier_id>', methods=['PUT'])
@login_required
def update_supplier(supplier_id):
    try:
        if not (current_user.is_admin or current_user.is_accounting):
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        
        supplier = Supplier.query.get_or_404(supplier_id)
        data = request.get_json()
        
        supplier.name = data.get('name', supplier.name)
        supplier.email = data.get('email', supplier.email)
        supplier.phone = data.get('phone', supplier.phone)
        supplier.address = data.get('address', supplier.address)
        supplier.tax_id = data.get('tax_id', supplier.tax_id)
        supplier.bank_name = data.get('bank_name', supplier.bank_name)
        supplier.bank_account_number = data.get('bank_account_number', supplier.bank_account_number)
        supplier.bank_branch = data.get('bank_branch', supplier.bank_branch)
        supplier.bank_swift = data.get('bank_swift', supplier.bank_swift)
        supplier.notes = data.get('notes', supplier.notes)
        supplier.status = data.get('status', supplier.status)
        supplier.updated_at = datetime.utcnow()
        
        db.session.commit()
        return jsonify({'success': True, 'data': supplier_to_dict(supplier), 'message': 'Supplier updated'}), 200
    except Exception as e:
        logger.error(f"Update supplier error: {str(e)}")
        db.session.rollback()
        return jsonify({'success': False, 'error': 'An error occurred'}), 500

@api_v1_bp.route('/suppliers/<int:supplier_id>', methods=['DELETE'])
@login_required
def delete_supplier(supplier_id):
    try:
        if not current_user.is_admin:
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        
        supplier = Supplier.query.get_or_404(supplier_id)
        
        # Check if supplier has any associated expenses
        if supplier.expenses:
            # Instead of deleting, mark as inactive
            supplier.status = 'inactive'
            db.session.commit()
            return jsonify({'success': True, 'message': 'Supplier has associated expenses. Marked as inactive instead of deleting.'}), 200
        else:
            db.session.delete(supplier)
            db.session.commit()
            return jsonify({'success': True, 'message': 'Supplier deleted'}), 200
    except Exception as e:
        logger.error(f"Delete supplier error: {str(e)}")
        db.session.rollback()
        return jsonify({'success': False, 'error': 'An error occurred'}), 500
