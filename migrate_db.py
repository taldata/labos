from app import app, db, Expense
from sqlalchemy import text
import os

def migrate_attachments():
    print("Starting database migration for expense attachments...")
    
    with app.app_context():
        try:
            # Check if the new columns exist
            inspector = db.inspect(db.engine)
            existing_columns = [col['name'] for col in inspector.get_columns('expense')]
            
            # Add new columns if they don't exist
            with db.engine.connect() as conn:
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

if __name__ == '__main__':
    migrate_attachments()
