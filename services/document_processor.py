from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
import os
from dotenv import load_dotenv

load_dotenv()

class DocumentProcessor:
    def __init__(self):
        endpoint = "https://budgetpricingscan.cognitiveservices.azure.com/"
        key = os.environ.get('AZURE_FORM_RECOGNIZER_KEY')
        self.document_analysis_client = DocumentAnalysisClient(
            endpoint=endpoint, 
            credential=AzureKeyCredential(key)
        )

    def process_invoice(self, document_path):
        """
        Process an invoice document and extract relevant information
        
        Args:
            document_path (str): Path to the document file
            
        Returns:
            dict: Extracted invoice information
        """
        try:
            with open(document_path, "rb") as f:
                poller = self.document_analysis_client.begin_analyze_document(
                    "prebuilt-invoice", document=f
                )
            result = poller.result()

            # Extract relevant invoice information
            invoice_data = {
                "vendor_name": None,
                "invoice_date": None,
                "invoice_total": None,
                "invoice_number": None,
                "items": []
            }

            for invoice in result.documents:
                # Get vendor name
                try:
                    invoice_data["vendor_name"] = invoice.fields.get("VendorName").value
                except:
                    pass

                # Get invoice date
                try:
                    invoice_data["invoice_date"] = invoice.fields.get("InvoiceDate").value
                except:
                    pass

                # Get total amount
                try:
                    invoice_data["invoice_total"] = invoice.fields.get("InvoiceTotal").value
                except:
                    pass

                # Get invoice number
                try:
                    invoice_data["invoice_number"] = invoice.fields.get("InvoiceId").value
                except:
                    pass

                # Get items
                try:
                    items = invoice.fields.get("Items").value
                    for item in items:
                        item_data = {
                            "description": item.get("Description").value if item.get("Description") else None,
                            "quantity": item.get("Quantity").value if item.get("Quantity") else None,
                            "unit_price": item.get("UnitPrice").value if item.get("UnitPrice") else None,
                            "amount": item.get("Amount").value if item.get("Amount") else None,
                        }
                        invoice_data["items"].append(item_data)
                except:
                    pass

            return invoice_data

        except Exception as e:
            raise Exception(f"Error processing invoice: {str(e)}")

    def process_receipt(self, document_path):
        """
        Process a receipt document and extract relevant information
        
        Args:
            document_path (str): Path to the document file
            
        Returns:
            dict: Extracted receipt information
        """
        try:
            with open(document_path, "rb") as f:
                poller = self.document_analysis_client.begin_analyze_document(
                    "prebuilt-receipt", document=f
                )
            result = poller.result()

            # Extract relevant receipt information
            receipt_data = {
                "merchant_name": None,
                "transaction_date": None,
                "total": None,
                "items": []
            }

            for receipt in result.documents:
                # Get merchant name
                try:
                    receipt_data["merchant_name"] = receipt.fields.get("MerchantName").value if receipt.fields.get("MerchantName") else None
                except:
                    pass

                # Get transaction date
                try:
                    receipt_data["transaction_date"] = receipt.fields.get("TransactionDate").value if receipt.fields.get("TransactionDate") else None
                except:
                    pass

                # Get total amount
                try:
                    receipt_data["total"] = receipt.fields.get("Total").value if receipt.fields.get("Total") else None
                except:
                    pass

                # Get items
                try:
                    items = receipt.fields.get("Items").value
                    for item in items:
                        item_data = {
                            "description": item.get("Description").value if item.get("Description") else None,
                            "quantity": item.get("Quantity").value if item.get("Quantity") else None,
                            "price": item.get("Price").value if item.get("Price") else None,
                            "total_price": item.get("TotalPrice").value if item.get("TotalPrice") else None,
                        }
                        receipt_data["items"].append(item_data)
                except Exception as e:
                    print(f"Error extracting items from receipt: {str(e)}")

            return receipt_data

        except Exception as e:
            raise Exception(f"Error processing receipt: {str(e)}")

    def process_quote(self, document_path):
        """
        Process a quote document and extract relevant information
        
        Args:
            document_path (str): Path to the document file
            
        Returns:
            dict: Extracted quote information
        """
        try:
            with open(document_path, "rb") as f:
                poller = self.document_analysis_client.begin_analyze_document(
                    "prebuilt-quote", document=f
                )
            result = poller.result()

            # Extract relevant quote information
            quote_data = {
                "customer_name": None,
                "quote_date": None,
                "quote_number": None,
                "expiry_date": None,
                "total_amount": None,
                "items": []
            }

            for quote in result.documents:
                # Get customer name
                try:
                    quote_data["customer_name"] = quote.fields.get("CustomerName").value
                except:
                    pass

                # Get quote date
                try:
                    quote_data["quote_date"] = quote.fields.get("QuoteDate").value
                except:
                    pass

                # Get quote number
                try:
                    quote_data["quote_number"] = quote.fields.get("QuoteNumber").value
                except:
                    pass

                # Get expiry date
                try:
                    quote_data["expiry_date"] = quote.fields.get("ExpiryDate").value
                except:
                    pass

                # Get total amount
                try:
                    quote_data["total_amount"] = quote.fields.get("TotalAmount").value
                except:
                    pass

                # Get items
                try:
                    items = quote.fields.get("Items").value
                    for item in items:
                        item_data = {
                            "description": item.get("Description").value if item.get("Description") else None,
                            "quantity": item.get("Quantity").value if item.get("Quantity") else None,
                            "unit_price": item.get("UnitPrice").value if item.get("UnitPrice") else None,
                            "amount": item.get("Amount").value if item.get("Amount") else None,
                        }
                        quote_data["items"].append(item_data)
                except:
                    pass

            return quote_data

        except Exception as e:
            raise Exception(f"Error processing quote: {str(e)}")
