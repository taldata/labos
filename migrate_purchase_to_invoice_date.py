#!/usr/bin/env python3
"""
Migration script to copy purchase_date to invoice_date where invoice_date is null
This preserves existing data before removing the purchase_date field
"""

from app import app
from models import db, Expense
from datetime import datetime

def migrate_purchase_to_invoice_date():
    """Copy purchase_date to invoice_date where invoice_date is null"""
    with app.app_context():
        print("Starting migration: copying purchase_date to invoice_date...")
        
        # Find expenses where purchase_date exists but invoice_date is null
        expenses_to_update = Expense.query.filter(
            Expense.purchase_date.isnot(None),
            Expense.invoice_date.is_(None)
        ).all()
        
        print(f"Found {len(expenses_to_update)} expenses to migrate")
        
        updated_count = 0
        for expense in expenses_to_update:
            expense.invoice_date = expense.purchase_date
            updated_count += 1
            if updated_count % 100 == 0:
                print(f"Updated {updated_count} expenses...")
        
        # Commit the changes
        try:
            db.session.commit()
            print(f"Successfully migrated {updated_count} expenses")
            print("Migration completed successfully!")
        except Exception as e:
            db.session.rollback()
            print(f"Error during migration: {e}")
            raise

if __name__ == "__main__":
    migrate_purchase_to_invoice_date() 