from app import app, db
from models import Expense
from sqlalchemy.exc import SQLAlchemyError

def delete_all_expenses():
    with app.app_context():
        try:
            # Get count before deletion
            count = Expense.query.count()
            print(f"Found {count} expenses to delete")
            
            # Delete all expenses
            Expense.query.delete()
            db.session.commit()
            
            # Verify deletion
            remaining = Expense.query.count()
            print(f"Successfully deleted all expenses. Remaining: {remaining}")
            return True
        except SQLAlchemyError as e:
            db.session.rollback()
            print(f"Error deleting expenses: {str(e)}")
            return False

if __name__ == "__main__":
    delete_all_expenses()
