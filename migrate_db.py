from app import app, db, Expense
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

if __name__ == '__main__':
    migrate_attachments()
    add_email_column()
    migrate_database()
