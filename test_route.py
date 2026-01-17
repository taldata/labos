from app import app, db
from models import User
from flask_login import login_user

with app.test_client() as client:
    with app.app_context():
        # Get the first active user
        user = User.query.filter_by(status='active').first()
        if not user:
            print("No active user found!")
            exit(1)
            
        print(f"Testing with user: {user.username} (ID: {user.id})")
        
        # Simulate login
        # We can't easily use login_user with test_client's session directly without more setup
        # But we can use the test_client and set the session
        with client.session_transaction() as sess:
            sess['_user_id'] = str(user.id)
            sess['_fresh'] = True
            
        # Make the request
        response = client.get('/api/v1/auth/me')
        print(f"Response status: {response.status_code}")
        print(f"Response data: {response.get_data(as_text=True)}")
        
        if response.status_code == 500:
            print("REPRODUCED 500 ERROR!")
