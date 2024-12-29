from flask import Blueprint, request, jsonify
from services.document_processor import DocumentProcessor
import os
from flask_login import login_required
import logging

expense_bp = Blueprint('expense', __name__)
document_processor = DocumentProcessor()

@expense_bp.route('/process-expense', methods=['POST'])
async def process_expense():
    """
    Process an expense document and extract information
    Expected input: multipart/form-data with 'document' file
    """
    if 'document' not in request.files:
        return jsonify({'error': 'No document provided'}), 400
    
    file = request.files['document']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file:
        # Create uploads directory if it doesn't exist
        upload_dir = os.path.join(os.getcwd(), 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        
        # Save the file temporarily
        file_path = os.path.join(upload_dir, file.filename)
        file.save(file_path)
        
        try:
            # Process the document
            result = await document_processor.process_invoice(file_path)
            
            # Clean up
            os.remove(file_path)
            
            return jsonify(result)
            
        except Exception as e:
            # Clean up in case of error
            if os.path.exists(file_path):
                os.remove(file_path)
            return jsonify({'error': str(e)}), 500

@expense_bp.route('/get_supplier/<int:supplier_id>', methods=['GET'])
@login_required
def get_supplier(supplier_id):
    """Get supplier details including bank information"""
    from app import Supplier
    
    logging.info(f"Fetching supplier with ID: {supplier_id}")
    supplier = Supplier.query.get_or_404(supplier_id)
    response_data = {
        'id': supplier.id,
        'name': supplier.name,
        'email': supplier.email,
        'phone': supplier.phone,
        'address': supplier.address,
        'tax_id': supplier.tax_id,
        'bank_name': supplier.bank_name,
        'bank_account_number': supplier.bank_account_number,
        'bank_branch': supplier.bank_branch,
        'bank_swift': supplier.bank_swift,
        'notes': supplier.notes,
        'status': supplier.status
    }
    logging.info(f"Supplier data: {response_data}")
    return jsonify(response_data)
