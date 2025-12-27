import os
import sys
import logging
from azure.ai.formrecognizer import DocumentModelAdministrationClient
from azure.core.credentials import AzureKeyCredential
from dotenv import load_dotenv

# Add current directory to path
sys.path.append(os.getcwd())

# Configure logging to capture output
logging.basicConfig(level=logging.INFO)

def check_available_models():
    print("Checking available Azure models...")
    load_dotenv()
    
    endpoint = "https://budgetpricingscan.cognitiveservices.azure.com/"
    key = os.environ.get('AZURE_FORM_RECOGNIZER_KEY')
    
    if not key:
        print("❌ No key found")
        return

    try:
        client = DocumentModelAdministrationClient(endpoint=endpoint, credential=AzureKeyCredential(key))
        
        print(f"Connected to {endpoint}")
        print("Listing custom models (to verify API)...")
        
        # Correct method for v3.x
        models = client.list_document_models()
        count = 0
        for model in models:
            print(f" - Model: {model.model_id}")
            count += 1
            if count > 5:
                print("... truncated")
                break
        print(f"Found {count} custom models (listing capped).")
        
        print("\nTesting 'prebuilt-invoice' with VALID minimal PDF...")
        from azure.ai.formrecognizer import DocumentAnalysisClient
        analysis_client = DocumentAnalysisClient(endpoint=endpoint, credential=AzureKeyCredential(key))
        
        # Valid minimal PDF (Blank page)
        # %PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 3 3]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n149\n%%EOF
        minimal_pdf = b"%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 3 3]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n149\n%%EOF"
        
        try:
            poller = analysis_client.begin_analyze_document("prebuilt-invoice", document=minimal_pdf)
            result = poller.result()
            print("✅ 'prebuilt-invoice' worked! (Analyzed blank PDF)")
            # If this works, then the User's issue was NOT 'ModelNotFound' on the server side,
            # but maybe something else or intermittent.
        except Exception as e:
            print(f"❌ 'prebuilt-invoice' Failed: {e}")
            if "ModelNotFound" in str(e):
                 print("   -> CONFIRMED: Model is missing on this resource.")

    except Exception as e:
        print(f"❌ Error connecting to Azure: {e}")

if __name__ == "__main__":
    check_available_models()
