from flask import Blueprint, request, jsonify
from services.document_processor import DocumentProcessor
import os
from flask_login import login_required
import logging
from forms import SupplierSearchForm
from models import Supplier
from sqlalchemy import or_

expense_bp = Blueprint('expense', __name__)
document_processor = DocumentProcessor()

def _process_document_file(file):
    """
    Helper function to process a document file and extract information
    Expected input: FileStorage object
    Returns: dict with extracted data or error
    """
    if not file or file.filename == '':
        logging.warning("No file provided in request")
        return {'error': 'No selected file'}, 400

    # Create uploads directory if it doesn't exist
    upload_dir = os.path.join(os.getcwd(), 'uploads')
    os.makedirs(upload_dir, exist_ok=True)

    # Save the file temporarily
    file_path = os.path.join(upload_dir, file.filename)
    logging.info(f"Saving temporary file for OCR to: {file_path}")
    file.save(file_path)

    try:
        # Process the document using unified processor
        logging.info(f"Starting OCR processing for {file_path}")
        result = document_processor.process_document(file_path)
        logging.info(f"OCR processing result: {result}")

        # Clean up
        os.remove(file_path)
        logging.info("Temporary file removed")

        return result, 200

    except Exception as e:
        # Clean up in case of error
        if os.path.exists(file_path):
            os.remove(file_path)
        logging.error(f"Error processing document: {str(e)}", exc_info=True)
        return {'error': str(e)}, 500

@expense_bp.route('/process-expense', methods=['POST'])
def process_expense():
    """
    Process an invoice document and extract information
    Expected input: multipart/form-data with 'document' file
    """
    if 'document' not in request.files:
        logging.warning("No 'document' in request.files")
        return jsonify({'error': 'No document provided'}), 400

    file = request.files['document']
    result, status = _process_document_file(file)
    return jsonify(result), status

@expense_bp.route('/process-receipt', methods=['POST'])
def process_receipt():
    """
    Process a receipt document and extract information
    Expected input: multipart/form-data with 'document' file
    """
    if 'document' not in request.files:
        return jsonify({'error': 'No document provided'}), 400

    file = request.files['document']
    result, status = _process_document_file(file)
    return jsonify(result), status

@expense_bp.route('/process-quote', methods=['POST'])
def process_quote():
    """
    Process a quote document and extract information
    Expected input: multipart/form-data with 'document' file
    """
    if 'document' not in request.files:
        return jsonify({'error': 'No document provided'}), 400

    file = request.files['document']
    result, status = _process_document_file(file)
    return jsonify(result), status

@expense_bp.route('/get_supplier/<int:supplier_id>', methods=['GET'])
@login_required
def get_supplier(supplier_id):
    """Get supplier details including bank information"""
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

@expense_bp.route('/search_suppliers', methods=['GET'])
@login_required
def search_suppliers():
    """Search suppliers by name or tax ID"""
    try:
        logging.info(f"Search suppliers request received - Method: {request.method}")
        logging.info(f"Request args: {request.args}")
        logging.info(f"Request headers: {dict(request.headers)}")
        
        # Check if search_query parameter exists
        if 'search_query' not in request.args:
            logging.error("Missing search_query parameter")
            return jsonify({
                'error': 'Missing search_query parameter',
                'received_args': dict(request.args)
            }), 400, {'Content-Type': 'application/json'}
        
        search_query = request.args.get('search_query')
        logging.info(f"Search query: {search_query}")
        
        if search_query:
            suppliers = Supplier.query.filter(
                or_(
                    Supplier.name.ilike(f'%{search_query}%'),
                    Supplier.tax_id.ilike(f'%{search_query}%')
                ),
                Supplier.status == 'active'
            ).all()
            logging.info(f"Found {len(suppliers)} suppliers matching query")
        else:
            suppliers = Supplier.query.filter_by(status='active').all()
            logging.info(f"No search query, returning all {len(suppliers)} active suppliers")

        result = [{
            'id': s.id,
            'name': s.name,
            'tax_id': s.tax_id
        } for s in suppliers]
        
        response = jsonify(result)
        response.headers['Content-Type'] = 'application/json'
        logging.info(f"Returning response: {response.data}")
        return response
    
    except Exception as e:
        logging.error(f"Error in search_suppliers: {str(e)}", exc_info=True)
        error_response = jsonify({
            'error': 'Server error occurred',
            'details': str(e)
        })
        error_response.headers['Content-Type'] = 'application/json'
        return error_response, 500
