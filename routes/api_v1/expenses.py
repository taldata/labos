from flask import request, jsonify, send_file
from flask_login import current_user, login_required
from models import db, Expense, Subcategory, Category, Department, Supplier, CreditCard, User
from routes.api_v1 import api_v1_bp
from werkzeug.utils import secure_filename
from services.document_processor import DocumentProcessor
import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)
document_processor = DocumentProcessor()

ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'gif'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def expense_to_dict(expense):
    """Convert Expense model to dictionary"""
    return {
        'id': expense.id,
        'amount': float(expense.amount),
        'currency': expense.currency,
        'description': expense.description,
        'reason': expense.reason,
        'type': expense.type,
        'status': expense.status,
        'date': expense.date.isoformat() if expense.date else None,
        'user_id': expense.user_id,
        'subcategory_id': expense.subcategory_id,
        'supplier_id': expense.supplier_id,
        'credit_card_id': expense.credit_card_id,
        'payment_method': expense.payment_method,
        'is_paid': expense.is_paid,
        'paid_at': expense.paid_at.isoformat() if expense.paid_at else None,
        'paid_by_id': expense.paid_by_id,
        'payment_status': expense.payment_status,
        'payment_due_date': expense.payment_due_date,
        'invoice_date': expense.invoice_date.isoformat() if expense.invoice_date else None,
        'manager_id': expense.manager_id,
        'handled_at': expense.handled_at.isoformat() if expense.handled_at else None,
        'rejection_reason': expense.rejection_reason,
        'external_accounting_entry': expense.external_accounting_entry,
        'external_accounting_entry_by_id': expense.external_accounting_entry_by_id,
        'external_accounting_entry_at': expense.external_accounting_entry_at.isoformat() if expense.external_accounting_entry_at else None,
        'quote_filename': expense.quote_filename,
        'invoice_filename': expense.invoice_filename,
        'receipt_filename': expense.receipt_filename,
        'created_at': expense.date.isoformat() if expense.date else None,
        'updated_at': expense.date.isoformat() if expense.date else None,
        'user': {
            'id': expense.submitter.id,
            'first_name': expense.submitter.first_name,
            'last_name': expense.submitter.last_name,
            'email': expense.submitter.email,
            'home_department_id': expense.submitter.department_id,
        } if expense.submitter else None,
        'subcategory': {
            'id': expense.subcategory.id,
            'name': expense.subcategory.name,
        } if expense.subcategory else None,
        'supplier': {
            'id': expense.supplier.id,
            'name': expense.supplier.name,
        } if expense.supplier else None,
    }


@api_v1_bp.route('/expenses', methods=['GET'])
@login_required
def get_expenses():
    """Get all expenses (filtered by permissions)"""
    try:
        query = Expense.query

        # Filter by status if provided
        status = request.args.get('status')
        if status:
            query = query.filter(Expense.status == status)

        # Regular users can only see their own expenses
        if not (current_user.is_manager or current_user.is_admin or current_user.is_accounting):
            query = query.filter(Expense.user_id == current_user.id)
        else:
            # Managers can filter by user_id or see all in their departments
            user_id = request.args.get('user_id')
            if user_id:
                query = query.filter(Expense.user_id == int(user_id))
            elif current_user.is_manager and not current_user.is_admin:
                # Show only expenses from managed departments
                dept_ids = [d.id for d in current_user.managed_departments]
                if dept_ids:
                    query = query.join(Subcategory).join(Category).filter(
                        Category.department_id.in_(dept_ids)
                    )

        # Order by date descending
        expenses = query.order_by(Expense.date.desc()).all()

        return jsonify({
            'success': True,
            'data': [expense_to_dict(e) for e in expenses]
        }), 200

    except Exception as e:
        logger.error(f"Get expenses error: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'An error occurred while fetching expenses'
        }), 500


@api_v1_bp.route('/expenses/<int:expense_id>', methods=['GET'])
@login_required
def get_expense(expense_id):
    """Get a single expense"""
    try:
        expense = Expense.query.get(expense_id)

        if not expense:
            return jsonify({
                'success': False,
                'message': 'Expense not found'
            }), 404

        # Check permissions
        if not (current_user.is_admin or current_user.is_accounting or
                expense.user_id == current_user.id or
                (current_user.is_manager and expense.subcategory.category.department in current_user.managed_departments)):
            return jsonify({
                'success': False,
                'message': 'Access denied'
            }), 403

        return jsonify({
            'success': True,
            'data': expense_to_dict(expense)
        }), 200

    except Exception as e:
        logger.error(f"Get expense error: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'An error occurred while fetching expense'
        }), 500


@api_v1_bp.route('/expenses', methods=['POST'])
@login_required
def create_expense():
    """Create a new expense"""
    try:
        # Get form data
        amount = request.form.get('amount', type=float)
        currency = request.form.get('currency', 'ILS')
        description = request.form.get('description')
        reason = request.form.get('reason')
        expense_type = request.form.get('type', 'needs_approval')
        subcategory_id = request.form.get('subcategory_id', type=int)
        supplier_id = request.form.get('supplier_id', type=int)
        credit_card_id = request.form.get('credit_card_id', type=int)
        payment_method = request.form.get('payment_method')
        invoice_date_str = request.form.get('invoice_date')
        payment_due_date_str = request.form.get('payment_due_date')

        # Validation
        if not all([amount, description, reason, subcategory_id]):
            return jsonify({
                'success': False,
                'message': 'Missing required fields'
            }), 400

        # Create expense
        expense = Expense(
            amount=amount,
            currency=currency,
            description=description,
            reason=reason,
            type=expense_type,
            user_id=current_user.id,
            subcategory_id=subcategory_id,
            supplier_id=supplier_id if supplier_id else None,
            credit_card_id=credit_card_id if credit_card_id else None,
            payment_method=payment_method,
            status='pending' if expense_type == 'needs_approval' else 'approved',
            date=datetime.now(),
        )

        # Parse dates
        if invoice_date_str:
            expense.invoice_date = datetime.fromisoformat(invoice_date_str.replace('Z', '+00:00'))
        if payment_due_date_str:
            expense.payment_due_date = datetime.fromisoformat(payment_due_date_str.replace('Z', '+00:00'))

        # Handle file uploads
        upload_folder = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'uploads')
        os.makedirs(upload_folder, exist_ok=True)

        for file_key in ['quote_file', 'invoice_file', 'receipt_file']:
            if file_key in request.files:
                file = request.files[file_key]
                if file and file.filename and allowed_file(file.filename):
                    filename = secure_filename(f"{current_user.id}_{datetime.now().timestamp()}_{file.filename}")
                    filepath = os.path.join(upload_folder, filename)
                    file.save(filepath)

                    if file_key == 'quote_file':
                        expense.quote_filename = filename
                    elif file_key == 'invoice_file':
                        expense.invoice_filename = filename
                    elif file_key == 'receipt_file':
                        expense.receipt_filename = filename

        db.session.add(expense)
        db.session.commit()

        logger.info(f"Expense {expense.id} created by user {current_user.id}")

        return jsonify({
            'success': True,
            'data': expense_to_dict(expense),
            'message': 'Expense created successfully'
        }), 201

    except Exception as e:
        logger.error(f"Create expense error: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'An error occurred while creating expense: {str(e)}'
        }), 500


@api_v1_bp.route('/expenses/<int:expense_id>', methods=['PUT'])
@login_required
def update_expense(expense_id):
    """Update an expense"""
    try:
        expense = Expense.query.get(expense_id)

        if not expense:
            return jsonify({
                'success': False,
                'message': 'Expense not found'
            }), 404

        # Check permissions (only owner or admin can edit)
        if not (current_user.is_admin or expense.user_id == current_user.id):
            return jsonify({
                'success': False,
                'message': 'Access denied'
            }), 403

        # Update fields from form data
        if 'amount' in request.form:
            expense.amount = float(request.form.get('amount'))
        if 'currency' in request.form:
            expense.currency = request.form.get('currency')
        if 'description' in request.form:
            expense.description = request.form.get('description')
        if 'reason' in request.form:
            expense.reason = request.form.get('reason')
        if 'type' in request.form:
            expense.type = request.form.get('type')
        if 'subcategory_id' in request.form:
            expense.subcategory_id = int(request.form.get('subcategory_id'))
        if 'supplier_id' in request.form:
            supplier_id = request.form.get('supplier_id')
            expense.supplier_id = int(supplier_id) if supplier_id else None
        if 'credit_card_id' in request.form:
            credit_card_id = request.form.get('credit_card_id')
            expense.credit_card_id = int(credit_card_id) if credit_card_id else None
        if 'payment_method' in request.form:
            expense.payment_method = request.form.get('payment_method')

        # Handle file uploads (similar to create)
        upload_folder = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'uploads')

        for file_key in ['quote_file', 'invoice_file', 'receipt_file']:
            if file_key in request.files:
                file = request.files[file_key]
                if file and file.filename and allowed_file(file.filename):
                    filename = secure_filename(f"{current_user.id}_{datetime.now().timestamp()}_{file.filename}")
                    filepath = os.path.join(upload_folder, filename)
                    file.save(filepath)

                    if file_key == 'quote_file':
                        expense.quote_filename = filename
                    elif file_key == 'invoice_file':
                        expense.invoice_filename = filename
                    elif file_key == 'receipt_file':
                        expense.receipt_filename = filename

        expense.updated_at = datetime.now()
        db.session.commit()

        logger.info(f"Expense {expense.id} updated by user {current_user.id}")

        return jsonify({
            'success': True,
            'data': expense_to_dict(expense),
            'message': 'Expense updated successfully'
        }), 200

    except Exception as e:
        logger.error(f"Update expense error: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'An error occurred while updating expense'
        }), 500


@api_v1_bp.route('/expenses/<int:expense_id>', methods=['DELETE'])
@login_required
def delete_expense(expense_id):
    """Delete an expense"""
    try:
        expense = Expense.query.get(expense_id)

        if not expense:
            return jsonify({
                'success': False,
                'message': 'Expense not found'
            }), 404

        # Check permissions
        if not (current_user.is_admin or expense.user_id == current_user.id):
            return jsonify({
                'success': False,
                'message': 'Access denied'
            }), 403

        db.session.delete(expense)
        db.session.commit()

        logger.info(f"Expense {expense_id} deleted by user {current_user.id}")

        return jsonify({
            'success': True,
            'message': 'Expense deleted successfully'
        }), 200

    except Exception as e:
        logger.error(f"Delete expense error: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'An error occurred while deleting expense'
        }), 500


@api_v1_bp.route('/expenses/<int:expense_id>/approve', methods=['POST'])
@login_required
def approve_expense(expense_id):
    """Approve an expense (manager only)"""
    try:
        if not current_user.is_manager and not current_user.is_admin:
            return jsonify({
                'success': False,
                'message': 'Access denied'
            }), 403

        expense = Expense.query.get(expense_id)

        if not expense:
            return jsonify({
                'success': False,
                'message': 'Expense not found'
            }), 404

        expense.status = 'approved'
        expense.manager_id = current_user.id
        expense.handled_at = datetime.now()

        db.session.commit()

        logger.info(f"Expense {expense_id} approved by user {current_user.id}")

        return jsonify({
            'success': True,
            'data': expense_to_dict(expense),
            'message': 'Expense approved successfully'
        }), 200

    except Exception as e:
        logger.error(f"Approve expense error: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'An error occurred while approving expense'
        }), 500


@api_v1_bp.route('/expenses/<int:expense_id>/reject', methods=['POST'])
@login_required
def reject_expense(expense_id):
    """Reject an expense (manager only)"""
    try:
        if not current_user.is_manager and not current_user.is_admin:
            return jsonify({
                'success': False,
                'message': 'Access denied'
            }), 403

        data = request.get_json()
        reason = data.get('reason')

        if not reason:
            return jsonify({
                'success': False,
                'message': 'Rejection reason is required'
            }), 400

        expense = Expense.query.get(expense_id)

        if not expense:
            return jsonify({
                'success': False,
                'message': 'Expense not found'
            }), 404

        expense.status = 'rejected'
        expense.rejection_reason = reason
        expense.manager_id = current_user.id
        expense.handled_at = datetime.now()

        db.session.commit()

        logger.info(f"Expense {expense_id} rejected by user {current_user.id}")

        return jsonify({
            'success': True,
            'data': expense_to_dict(expense),
            'message': 'Expense rejected successfully'
        }), 200

    except Exception as e:
        logger.error(f"Reject expense error: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'An error occurred while rejecting expense'
        }), 500


@api_v1_bp.route('/expenses/process-document', methods=['POST'])
@login_required
def process_document():
    """Process a document with OCR"""
    try:
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'message': 'No file provided'
            }), 400

        file = request.files['file']
        document_type = request.form.get('document_type', 'invoice')

        if not file or not file.filename:
            return jsonify({
                'success': False,
                'message': 'No file selected'
            }), 400

        # Save file temporarily
        upload_folder = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'uploads', 'temp')
        os.makedirs(upload_folder, exist_ok=True)

        filename = secure_filename(file.filename)
        filepath = os.path.join(upload_folder, filename)
        file.save(filepath)

        # Process with OCR
        result = document_processor.process_document(filepath, document_type)

        # Clean up temp file
        if os.path.exists(filepath):
            os.remove(filepath)

        return jsonify({
            'success': True,
            'data': result
        }), 200

    except Exception as e:
        logger.error(f"Process document error: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'An error occurred while processing document'
        }), 500


# Payment tracking endpoints (accounting only)
@api_v1_bp.route('/expenses/<int:expense_id>/mark-paid', methods=['POST'])
@login_required
def mark_expense_paid(expense_id):
    """Mark an expense as paid (accounting only)"""
    try:
        if not current_user.is_accounting and not current_user.is_admin:
            return jsonify({
                'success': False,
                'message': 'Access denied'
            }), 403

        expense = Expense.query.get(expense_id)

        if not expense:
            return jsonify({
                'success': False,
                'message': 'Expense not found'
            }), 404

        expense.is_paid = True
        expense.paid_at = datetime.now()
        expense.paid_by_id = current_user.id
        expense.payment_status = 'paid'

        db.session.commit()

        logger.info(f"Expense {expense_id} marked as paid by user {current_user.id}")

        return jsonify({
            'success': True,
            'data': expense_to_dict(expense),
            'message': 'Expense marked as paid'
        }), 200

    except Exception as e:
        logger.error(f"Mark paid error: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'An error occurred'
        }), 500


@api_v1_bp.route('/expenses/<int:expense_id>/mark-unpaid', methods=['POST'])
@login_required
def mark_expense_unpaid(expense_id):
    """Mark an expense as unpaid (accounting only)"""
    try:
        if not current_user.is_accounting and not current_user.is_admin:
            return jsonify({
                'success': False,
                'message': 'Access denied'
            }), 403

        expense = Expense.query.get(expense_id)

        if not expense:
            return jsonify({
                'success': False,
                'message': 'Expense not found'
            }), 404

        expense.is_paid = False
        expense.paid_at = None
        expense.paid_by_id = None
        expense.payment_status = 'pending_attention'

        db.session.commit()

        logger.info(f"Expense {expense_id} marked as unpaid by user {current_user.id}")

        return jsonify({
            'success': True,
            'data': expense_to_dict(expense),
            'message': 'Expense marked as unpaid'
        }), 200

    except Exception as e:
        logger.error(f"Mark unpaid error: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'An error occurred'
        }), 500


@api_v1_bp.route('/expenses/<int:expense_id>/mark-pending-payment', methods=['POST'])
@login_required
def mark_expense_pending_payment(expense_id):
    """Mark an expense as pending payment (accounting only)"""
    try:
        if not current_user.is_accounting and not current_user.is_admin:
            return jsonify({
                'success': False,
                'message': 'Access denied'
            }), 403

        expense = Expense.query.get(expense_id)

        if not expense:
            return jsonify({
                'success': False,
                'message': 'Expense not found'
            }), 404

        expense.payment_status = 'pending_payment'

        db.session.commit()

        logger.info(f"Expense {expense_id} marked as pending payment by user {current_user.id}")

        return jsonify({
            'success': True,
            'data': expense_to_dict(expense),
            'message': 'Expense marked as pending payment'
        }), 200

    except Exception as e:
        logger.error(f"Mark pending payment error: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'An error occurred'
        }), 500


@api_v1_bp.route('/expenses/<int:expense_id>/mark-external-accounting', methods=['POST'])
@login_required
def mark_external_accounting(expense_id):
    """Mark an expense as entered in external accounting system"""
    try:
        if not current_user.is_accounting and not current_user.is_admin:
            return jsonify({
                'success': False,
                'message': 'Access denied'
            }), 403

        expense = Expense.query.get(expense_id)

        if not expense:
            return jsonify({
                'success': False,
                'message': 'Expense not found'
            }), 404

        expense.external_accounting_entry = True
        expense.external_accounting_entry_by_id = current_user.id
        expense.external_accounting_entry_at = datetime.now()

        db.session.commit()

        logger.info(f"Expense {expense_id} marked as external accounting entry by user {current_user.id}")

        return jsonify({
            'success': True,
            'data': expense_to_dict(expense),
            'message': 'Expense marked as entered in external accounting system'
        }), 200

    except Exception as e:
        logger.error(f"Mark external accounting error: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'An error occurred'
        }), 500


@api_v1_bp.route('/expenses/<int:expense_id>/unmark-external-accounting', methods=['POST'])
@login_required
def unmark_external_accounting(expense_id):
    """Unmark an expense from external accounting system"""
    try:
        if not current_user.is_accounting and not current_user.is_admin:
            return jsonify({
                'success': False,
                'message': 'Access denied'
            }), 403

        expense = Expense.query.get(expense_id)

        if not expense:
            return jsonify({
                'success': False,
                'message': 'Expense not found'
            }), 404

        expense.external_accounting_entry = False
        expense.external_accounting_entry_by_id = None
        expense.external_accounting_entry_at = None

        db.session.commit()

        logger.info(f"Expense {expense_id} unmarked from external accounting by user {current_user.id}")

        return jsonify({
            'success': True,
            'data': expense_to_dict(expense),
            'message': 'Expense unmarked from external accounting system'
        }), 200

    except Exception as e:
        logger.error(f"Unmark external accounting error: {str(e)}")
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': 'An error occurred'
        }), 500
