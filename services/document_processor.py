from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

class DocumentProcessor:
    def __init__(self):
        endpoint = "https://budgetpricingscan.cognitiveservices.azure.com/"
        key = os.environ.get('AZURE_FORM_RECOGNIZER_KEY')
        self.document_analysis_client = DocumentAnalysisClient(
            endpoint=endpoint, 
            credential=AzureKeyCredential(key)
        )
        
        # Mapping of document types to their field names for amount and date
        self.field_mappings = {
            "prebuilt-invoice": {
                "date": "InvoiceDate",
                "amount": "InvoiceTotal"
            },
            "prebuilt-receipt": {
                "date": "TransactionDate",
                "amount": "Total"
            },
            "prebuilt-quote": {
                "date": "QuoteDate",
                "amount": "TotalAmount"
            }
        }

    def _extract_amount(self, amount_field):
        """
        Extract float amount from a field value that might be a CurrencyValue
        
        Args:
            amount_field: Field value from Form Recognizer
            
        Returns:
            float: The amount value
        """
        if amount_field is None:
            return None
            
        if hasattr(amount_field, 'amount'):
            # Handle CurrencyValue objects
            return float(amount_field.amount)
        elif isinstance(amount_field, (int, float)):
            # Handle direct numeric values
            return float(amount_field)
        else:
            # Try to convert string or other types
            try:
                return float(amount_field)
            except (ValueError, TypeError):
                return None

    def process_document(self, document_path):
        """
        Process any supported document type and extract amount and purchase date
        
        Args:
            document_path (str): Path to the document file
            
        Returns:
            dict: Extracted document information with amount and purchase date
        """
        try:
            # Try each document type until we get valid results
            for doc_type, fields in self.field_mappings.items():
                try:
                    with open(document_path, "rb") as f:
                        poller = self.document_analysis_client.begin_analyze_document(
                            doc_type, document=f
                        )
                    result = poller.result()

                    # If we got any documents, process them
                    if result.documents:
                        doc = result.documents[0]
                        
                        # Extract date
                        date_field = doc.fields.get(fields["date"])
                        date_value = date_field.value if date_field else None
                        
                        # Extract amount and convert to float
                        amount_field = doc.fields.get(fields["amount"])
                        amount_value = self._extract_amount(amount_field.value if amount_field else None)
                        
                        # If we found either date or amount, return the results
                        if date_value or amount_value:
                            return {
                                "purchase_date": date_value,
                                "amount": amount_value
                            }
                except Exception:
                    # If this document type fails, try the next one
                    continue
                    
            # If we get here, we couldn't extract information from any document type
            return {
                "purchase_date": None,
                "amount": None
            }

        except Exception as e:
            raise Exception(f"Error processing document: {str(e)}")
