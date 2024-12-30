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

            # Extract only amount and date information
            invoice_data = {
                "invoice_date": None,
                "invoice_total": None
            }

            for invoice in result.documents:
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

            # Extract only amount and date information
            receipt_data = {
                "purchase_date": None,
                "amount": None
            }

            for receipt in result.documents:
                # Get transaction date
                try:
                    receipt_data["purchase_date"] = receipt.fields.get("TransactionDate").value if receipt.fields.get("TransactionDate") else None
                except:
                    pass

                # Get total amount
                try:
                    receipt_data["amount"] = receipt.fields.get("Total").value if receipt.fields.get("Total") else None
                except:
                    pass

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

            # Extract only amount and date information
            quote_data = {
                "quote_date": None,
                "total_amount": None
            }

            for quote in result.documents:
                # Get quote date
                try:
                    quote_data["quote_date"] = quote.fields.get("QuoteDate").value if quote.fields.get("QuoteDate") else None
                except:
                    pass

                # Get total amount
                try:
                    quote_data["total_amount"] = quote.fields.get("TotalAmount").value if quote.fields.get("TotalAmount") else None
                except:
                    pass

            return quote_data

        except Exception as e:
            raise Exception(f"Error processing quote: {str(e)}")
