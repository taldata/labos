from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
import os
import hashlib
import logging
from functools import lru_cache
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

class DocumentProcessor:
    def __init__(self):
        endpoint = "https://budgetpricingscan.cognitiveservices.azure.com/"
        key = os.environ.get('AZURE_FORM_RECOGNIZER_KEY')
        
        # Check if Azure Form Recognizer is properly configured
        if not key or key.strip() == '':
            print("⚠️  Warning: AZURE_FORM_RECOGNIZER_KEY not set. Document processing will be disabled.")
            logging.warning("AZURE_FORM_RECOGNIZER_KEY not set")
            self.document_analysis_client = None
        else:
            try:
                self.document_analysis_client = DocumentAnalysisClient(
                    endpoint=endpoint, 
                    credential=AzureKeyCredential(key)
                )
                print("✅ Azure Form Recognizer initialized successfully")
                logging.info("Azure Form Recognizer initialized successfully")
            except Exception as e:
                print(f"⚠️  Warning: Failed to initialize Azure Form Recognizer: {e}")
                logging.error(f"Failed to initialize Azure Form Recognizer: {e}")
                self.document_analysis_client = None
        
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

        value = None
        if hasattr(amount_field, 'amount'):
            # Handle CurrencyValue objects
            value = float(amount_field.amount)
        elif isinstance(amount_field, (int, float)):
            # Handle direct numeric values
            value = float(amount_field)
        else:
            # Try to convert string or other types
            try:
                value = float(amount_field)
            except (ValueError, TypeError):
                return None

        # OCR may interpret parentheses (e.g. "(100)") as negative — always return absolute value
        if value is not None:
            return abs(value)
        return None

    def _extract_currency(self, amount_field):
        """
        Extract currency code from a CurrencyValue field.

        Args:
            amount_field: Field value from Form Recognizer (may be CurrencyValue)

        Returns:
            str or None: Currency code (e.g., 'USD', 'ILS', 'EUR')
        """
        if amount_field is None:
            return None

        symbol = getattr(amount_field, 'symbol', None)
        currency_code = getattr(amount_field, 'code', None)

        # Check for unambiguous currency symbols first — these take precedence
        # over the code because Azure Form Recognizer sometimes returns an
        # incorrect currency code (e.g. 'USD') for ILS invoices while
        # correctly identifying the ₪ symbol.
        if symbol:
            unambiguous_symbols = {
                '₪': 'ILS',
                '\u20aa': 'ILS',  # Unicode shekel sign
                '€': 'EUR',
                '\u20ac': 'EUR',  # Unicode euro sign
            }
            if symbol in unambiguous_symbols:
                return unambiguous_symbols[symbol]

        # For ambiguous symbols (like $), prefer the currency code from Azure
        if currency_code:
            return currency_code.upper()

        # Fall back to symbol mapping for remaining cases
        if symbol:
            fallback_map = {
                '$': 'USD',
            }
            return fallback_map.get(symbol, None)

        return None
    
    def _calculate_file_hash(self, file_path):
        """Calculate a hash for the file to use as a cache key"""
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    
    # Cache the document processing results to avoid redundant API calls
    @lru_cache(maxsize=128)
    def _process_document_with_cache(self, file_hash, doc_type):
        """Process document with caching based on file hash"""
        # This is a placeholder function that will be used with the cache decorator
        # The actual implementation is in process_document
        pass

    def process_document(self, document_path):
        """
        Process any supported document type and extract amount and purchase date
        
        Args:
            document_path (str): Path to the document file
            
        Returns:
            dict: Extracted document information with amount and purchase date
        """
        logging.info(f"DocumentProcessor: Starting to process {document_path}")
        
        # Check if Azure Form Recognizer is available
        if self.document_analysis_client is None:
            print("⚠️  Document processing skipped: Azure Form Recognizer not configured")
            logging.warning("Document processing skipped: Azure Form Recognizer not configured")
            return {
                'amount': None,
                'purchase_date': None,
                'document_type': None,
                'confidence': 0,
                'processing_status': 'skipped_no_service'
            }
            
        try:
            # Calculate file hash for caching
            file_hash = self._calculate_file_hash(document_path)
            logging.info(f"DocumentProcessor: File hash: {file_hash}")
            
            # Try each document type until we get valid results
            for doc_type, fields in self.field_mappings.items():
                try:
                    logging.info(f"DocumentProcessor: Trying doc_type: {doc_type}")
                    
                    # Check if we have this result cached
                    cache_key = f"{file_hash}_{doc_type}"
                    cached_result = getattr(self, f"_cached_{cache_key}", None)
                    
                    if cached_result:
                        logging.info(f"DocumentProcessor: Using cached result for {doc_type}")
                        return cached_result
                    
                    with open(document_path, "rb") as f:
                        poller = self.document_analysis_client.begin_analyze_document(
                            doc_type, document=f
                        )
                    result = poller.result()
                    logging.info(f"DocumentProcessor: Azure returned {len(result.documents) if result.documents else 0} documents")

                    # If we got any documents, process them
                    if result.documents:
                        doc = result.documents[0]
                        logging.info(f"DocumentProcessor: Document fields: {list(doc.fields.keys())}")
                        
                        # Extract date
                        date_field = doc.fields.get(fields["date"])
                        date_value = date_field.value if date_field else None
                        logging.info(f"DocumentProcessor: Date field ({fields['date']}): {date_value}")
                        
                        # Extract amount and convert to float
                        amount_field = doc.fields.get(fields["amount"])
                        amount_value = self._extract_amount(amount_field.value if amount_field else None)
                        logging.info(f"DocumentProcessor: Amount field ({fields['amount']}): {amount_value}")

                        # Extract currency from CurrencyValue
                        currency_value = self._extract_currency(amount_field.value if amount_field else None)
                        logging.info(f"DocumentProcessor: Currency: {currency_value}")

                        # If we found either date or amount, return the results
                        if date_value or amount_value:
                            # Convert date to ISO format string for JSON serialization
                            date_str = None
                            if date_value:
                                if hasattr(date_value, 'isoformat'):
                                    date_str = date_value.isoformat()
                                else:
                                    date_str = str(date_value)

                            result = {
                                "purchase_date": date_str,
                                "amount": amount_value,
                                "currency": currency_value
                            }
                            logging.info(f"DocumentProcessor: Success! Returning: {result}")
                            # Cache the result
                            setattr(self, f"_cached_{cache_key}", result)
                            return result
                        else:
                            logging.info(f"DocumentProcessor: No date or amount found for {doc_type}")
                except Exception as e:
                    # If this document type fails, try the next one
                    logging.error(f"DocumentProcessor: Error with {doc_type}: {str(e)}")
                    continue
                    
            # If we get here, we couldn't extract information from any document type
            logging.warning("DocumentProcessor: Could not extract data from any document type")
            return {
                "purchase_date": None,
                "amount": None
            }

        except Exception as e:
            logging.error(f"DocumentProcessor: Fatal error: {str(e)}")
            raise Exception(f"Error processing document: {str(e)}")
