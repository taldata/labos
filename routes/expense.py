from flask import Blueprint, request, jsonify
from services.document_processor import DocumentProcessor
import os

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
