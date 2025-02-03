import pandas as pd
from models import db, Supplier
from app import app
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def truncate_suppliers():
    with app.app_context():
        try:
            # Delete all records from the supplier table
            Supplier.query.delete()
            db.session.commit()
            logger.info("Successfully truncated suppliers table")
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error truncating suppliers table: {str(e)}")
            raise

def load_suppliers_from_excel(excel_path):
    try:
        # Read the Excel file with specific columns
        df = pd.read_excel(excel_path, usecols=['name', 'tax_id', 'status'])
        
        with app.app_context():
            success_count = 0
            error_count = 0
            
            for index, row in df.iterrows():
                try:
                    # Keep status as 'active' or whatever value is in Excel
                    status = str(row['status']).lower() if pd.notna(row.get('status')) else 'active'
                    
                    # Convert tax_id to whole number by removing decimal part
                    tax_id = str(int(float(row['tax_id']))) if pd.notna(row.get('tax_id')) else None
                    
                    # Create new supplier with only the specified fields
                    supplier_data = {
                        'name': str(row['name']) if pd.notna(row.get('name')) else None,
                        'tax_id': tax_id,
                        'status': status
                    }
                    
                    # Remove None values
                    supplier_data = {k: v for k, v in supplier_data.items() if v is not None}
                    
                    # Create new supplier
                    new_supplier = Supplier(**supplier_data)
                    db.session.add(new_supplier)
                    
                    # Commit each supplier individually
                    db.session.commit()
                    success_count += 1
                    logger.info(f"Successfully processed supplier at row {index + 2}")
                    
                except Exception as e:
                    error_count += 1
                    logger.error(f"Error processing row {index + 2}: {str(e)}")
                    db.session.rollback()
            
            logger.info(f"Import completed. Successfully imported {success_count} suppliers. {error_count} errors occurred.")
            
    except Exception as e:
        logger.error(f"Error reading Excel file: {str(e)}")
        raise

if __name__ == "__main__":
    excel_path = "רשימת ספקים.xlsx"
    # First truncate the table
    truncate_suppliers()
    # Then load new data
    load_suppliers_from_excel(excel_path)
