from app import app, db
from models import User
from sqlalchemy import inspect

with app.app_context():
    inspector = inspect(db.engine)
    columns = inspector.get_columns('user')
    print("Columns in 'user' table:")
    for column in columns:
        print(f"- {column['name']}: {column['type']}")
    
    # Also check if there's any user in the DB
    user_count = User.query.count()
    print(f"\nTotal users in DB: {user_count}")
    
    if user_count > 0:
        first_user = User.query.first()
        print(f"\nFirst user details:")
        print(f"ID: {first_user.id}")
        print(f"Username: {first_user.username}")
        print(f"Email: {first_user.email}")
        try:
            print(f"Preferred Version: {first_user.preferred_version}")
            print(f"Can Use Modern: {first_user.can_use_modern_version}")
        except Exception as e:
            print(f"Error accessing attributes: {str(e)}")
