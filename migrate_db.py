from app import app, db, Expense, User
from sqlalchemy import text
import os
from sqlalchemy import create_engine, MetaData, Column, String
import sqlalchemy as sa

def migrate_attachments():
    print("Starting database migration for expense attachments...")
    
    with app.app_context():
        try:
            # Check if the new columns exist
            inspector = db.inspect(db.engine)
            existing_columns = [col['name'] for col in inspector.get_columns('expense')]
            
            # Add new columns if they don't exist
            with db.engine.connect() as conn:
                if 'reason' not in existing_columns:
                    conn.execute(text('ALTER TABLE expense ADD COLUMN reason VARCHAR(500)'))
                    conn.commit()
                    print("Added reason column")
                
                if 'type' not in existing_columns:
                    conn.execute(text('ALTER TABLE expense ADD COLUMN type VARCHAR(50) NOT NULL DEFAULT "needs_approval"'))
                    conn.commit()
                    print("Added type column")
                
                if 'quote_filename' not in existing_columns:
                    conn.execute(text('ALTER TABLE expense ADD COLUMN quote_filename VARCHAR(255)'))
                    conn.commit()
                    print("Added quote_filename column")
                
                if 'invoice_filename' not in existing_columns:
                    conn.execute(text('ALTER TABLE expense ADD COLUMN invoice_filename VARCHAR(255)'))
                    conn.commit()
                    print("Added invoice_filename column")
                
                if 'receipt_filename' not in existing_columns:
                    conn.execute(text('ALTER TABLE expense ADD COLUMN receipt_filename VARCHAR(255)'))
                    conn.commit()
                    print("Added receipt_filename column")
                
                # Migrate existing attachments to receipt_filename
                if 'attachment_filename' in existing_columns:
                    print("Migrating existing attachments...")
                    # Use raw SQL to get expenses with attachments
                    result = conn.execute(text('SELECT id, attachment_filename FROM expense WHERE attachment_filename IS NOT NULL'))
                    rows = result.fetchall()
                    
                    for row in rows:
                        # Update receipt_filename with the old attachment_filename
                        conn.execute(
                            text('UPDATE expense SET receipt_filename = :filename WHERE id = :id'),
                            {'filename': row[1], 'id': row[0]}
                        )
                    conn.commit()
                    print(f"Migrated {len(rows)} attachments")
                    
                    # Drop the old column
                    conn.execute(text('ALTER TABLE expense DROP COLUMN attachment_filename'))
                    conn.commit()
                    print("Dropped attachment_filename column")
            
            print("Migration completed successfully!")
            
        except Exception as e:
            print(f"Error during migration: {str(e)}")
            db.session.rollback()
            raise

def add_email_column():
    print("Starting database migration to add email column to user table...")
    
    with app.app_context():
        try:
            # Check if the email column exists
            inspector = db.inspect(db.engine)
            existing_columns = [col['name'] for col in inspector.get_columns('user')]
            
            # Add email column if it doesn't exist
            with db.engine.connect() as conn:
                if 'email' not in existing_columns:
                    conn.execute(text('ALTER TABLE user ADD COLUMN email VARCHAR(255)'))
                    conn.commit()
                    print("Added email column to user table")
                else:
                    print("Email column already exists in user table")
            
            print("Migration completed successfully!")
            
        except Exception as e:
            print(f"Error during migration: {str(e)}")
            db.session.rollback()
            raise

def migrate_database():
    # Create a new column for rejection reason
    with app.app_context():
        inspector = db.inspect(db.engine)
        columns = [col['name'] for col in inspector.get_columns('expense')]
        
        if 'rejection_reason' not in columns:
            # Add the column using raw SQL
            db.session.execute(text('ALTER TABLE expense ADD COLUMN rejection_reason VARCHAR(500)'))
            db.session.commit()
            print("Added rejection_reason column")
        else:
            print("Rejection reason column already exists")

def migrate_payment_fields():
    print("Starting database migration for expense payment fields...")
    
    with app.app_context():
        try:
            inspector = db.inspect(db.engine)
            existing_columns = [col['name'] for col in inspector.get_columns('expense')]
            
            with db.engine.connect() as conn:
                if 'notes' not in existing_columns:
                    conn.execute(text('ALTER TABLE expense ADD COLUMN notes VARCHAR(500)'))
                    conn.commit()
                    print("Added notes column")
                
                if 'is_paid' not in existing_columns:
                    conn.execute(text('ALTER TABLE expense ADD COLUMN is_paid BOOLEAN DEFAULT 0'))
                    conn.commit()
                    print("Added is_paid column")
                
                if 'paid_by_id' not in existing_columns:
                    conn.execute(text('ALTER TABLE expense ADD COLUMN paid_by_id INTEGER REFERENCES user(id)'))
                    conn.commit()
                    print("Added paid_by_id column")
                
                if 'paid_at' not in existing_columns:
                    conn.execute(text('ALTER TABLE expense ADD COLUMN paid_at DATETIME'))
                    conn.commit()
                    print("Added paid_at column")
            
            print("Payment fields migration completed successfully!")
            
        except Exception as e:
            print(f"Error during migration: {str(e)}")
            db.session.rollback()
            raise

def migrate_is_accounting_field():
    print("Starting database migration to add is_accounting field to user table...")
    
    with app.app_context():
        try:
            # Check if the column exists
            inspector = db.inspect(db.engine)
            existing_columns = [col['name'] for col in inspector.get_columns('user')]
            
            with db.engine.connect() as connection:
                if 'is_accounting' not in existing_columns:
                    connection.execute(text('ALTER TABLE user ADD COLUMN is_accounting BOOLEAN DEFAULT FALSE;'))
                    connection.commit()
                    print("Added is_accounting column to user table")
                else:
                    print("is_accounting column already exists in user table")
                
            print("Migration completed successfully")
            
        except Exception as e:
            print(f"Error during migration: {str(e)}")
            db.session.rollback()
            raise

def migrate_supplier_details():
    print("Starting migration for supplier details...")
    
    with app.app_context():
        try:
            # Check if the new columns exist
            inspector = db.inspect(db.engine)
            existing_columns = [col['name'] for col in inspector.get_columns('expense')]
            
            # Add new columns if they don't exist
            with db.engine.connect() as conn:
                if 'supplier_name' not in existing_columns:
                    conn.execute(text('ALTER TABLE expense ADD COLUMN supplier_name VARCHAR(200)'))
                    conn.commit()
                    print("Added supplier_name column")
                
                if 'tax_id' not in existing_columns:
                    conn.execute(text('ALTER TABLE expense ADD COLUMN tax_id VARCHAR(50)'))
                    conn.commit()
                    print("Added tax_id column")
                
                if 'purchase_date' not in existing_columns:
                    conn.execute(text('ALTER TABLE expense ADD COLUMN purchase_date DATETIME'))
                    conn.commit()
                    print("Added purchase_date column")
                
            print("Supplier details migration completed successfully")
            
        except Exception as e:
            print(f"Error during supplier details migration: {str(e)}")
            raise e

if __name__ == '__main__':
    migrate_attachments()
    add_email_column()
    migrate_database()
    migrate_payment_fields()
    migrate_is_accounting_field()
    migrate_supplier_details()
