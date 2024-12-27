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
