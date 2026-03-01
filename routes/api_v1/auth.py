from flask import jsonify, request, session, url_for, redirect
from flask_login import login_user, logout_user, current_user, login_required
from models import User, db
import msal
import logging
import requests
import os
from . import api_v1
from config import Config

def _build_msal_app(cache=None):
    return msal.ConfidentialClientApplication(
        Config.AZURE_AD_CLIENT_ID,
        authority=f"https://login.microsoftonline.com/{Config.AZURE_AD_TENANT_ID}",
        client_credential=Config.AZURE_AD_CLIENT_SECRET,
        token_cache=cache
    )

@api_v1.route('/auth/me', methods=['GET'])
def get_current_user():
    """Get current authenticated user"""
    if current_user.is_authenticated:
        managed_departments_info = []
        if current_user.is_manager:
            managed_departments_info = [
                {'id': d.id, 'name': d.name, 'year_id': d.year_id}
                for d in current_user.managed_departments
            ]

        home_department_name = None
        if current_user.department_id:
            from models import Department
            home_dept = Department.query.get(current_user.department_id)
            if home_dept:
                home_department_name = home_dept.name

        return jsonify({
            'user': {
                'id': current_user.id,
                'username': current_user.username,
                'email': current_user.email,
                'first_name': current_user.first_name,
                'last_name': current_user.last_name,
                'is_manager': current_user.is_manager,
                'is_admin': current_user.is_admin,
                'is_accounting': current_user.is_accounting,
                'is_hr': current_user.is_hr,
                'department_id': current_user.department_id,
                'home_department_name': home_department_name,
                'profile_pic': current_user.profile_pic,
                'managed_department_ids': [d['id'] for d in managed_departments_info],
                'managed_departments': managed_departments_info
            }
        }), 200
    return jsonify({'error': 'Not authenticated'}), 401

@api_v1.route('/auth/login', methods=['POST'])
def login():
    """Traditional username/password login"""
    try:
        data = request.get_json()

        if not data or not data.get('username') or not data.get('password'):
            return jsonify({'error': 'Username and password required'}), 400

        username = data['username']
        password = data['password']

        is_dev_mode = os.getenv('FLASK_ENV') == 'development' or os.getenv('DEV_MODE') == 'true'
        dev_password_used = is_dev_mode and password == 'dev'

        user = User.query.filter_by(username=username).first()

        if not user:
            logging.warning(f"Login attempt for non-existent user: {username}")
            return jsonify({'error': 'Invalid username or password'}), 401

        if not dev_password_used and user.password != password:
            logging.warning(f"Failed login attempt for user: {username}")
            return jsonify({'error': 'Invalid username or password'}), 401

        if user.status != 'active':
            logging.warning(f"Login attempt for inactive user: {username}")
            return jsonify({'error': 'Account is inactive. Please contact administrator.'}), 403

        login_user(user)
        logging.info(f"User {username} logged in successfully via username/password")

        managed_department_ids = []
        if user.is_manager:
            managed_department_ids = [d.id for d in user.managed_departments]

        return jsonify({
            'message': 'Login successful',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_manager': user.is_manager,
                'is_admin': user.is_admin,
                'is_accounting': user.is_accounting,
                'is_hr': user.is_hr,
                'department_id': user.department_id,
                'managed_department_ids': managed_department_ids
            }
        }), 200

    except Exception as e:
        logging.error(f"Error during login: {str(e)}")
        return jsonify({'error': 'Login failed. Please try again.'}), 500

@api_v1.route('/auth/dev/create-test-user', methods=['POST'])
def create_test_user():
    """Create a test user for development (only works in dev mode)"""
    is_dev_mode = os.getenv('FLASK_ENV') == 'development' or os.getenv('DEV_MODE') == 'true'

    if not is_dev_mode:
        if 'localhost' not in request.host and '127.0.0.1' not in request.host:
            return jsonify({'error': 'This endpoint is only available in development mode'}), 403

    try:
        test_user = User.query.filter_by(username='testuser').first()
        if test_user:
            test_user.password = 'test123'
            test_user.status = 'active'
            test_user.is_admin = True
            db.session.commit()
            return jsonify({
                'message': 'Test user updated',
                'username': 'testuser',
                'password': 'test123'
            }), 200

        test_user = User(
            username='testuser',
            email='testuser@test.com',
            password='test123',
            first_name='Test',
            last_name='User',
            is_admin=True,
            is_manager=True,
            is_accounting=True,
            status='active'
        )
        db.session.add(test_user)
        db.session.commit()

        return jsonify({
            'message': 'Test user created successfully',
            'username': 'testuser',
            'password': 'test123'
        }), 201

    except Exception as e:
        logging.error(f"Error creating test user: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@api_v1.route('/auth/login/azure', methods=['GET'])
def login_azure():
    """Initiate Azure AD login flow"""
    try:
        redirect_uri = url_for('auth_callback', _external=True, _scheme='https')
        logging.info(f"API Azure Login - Redirect URI: {redirect_uri}")

        msal_app = _build_msal_app()
        flow = msal_app.initiate_auth_code_flow(
            scopes=['https://graph.microsoft.com/User.Read'],
            redirect_uri=redirect_uri
        )
        logging.info(f"MSAL Flow initiated for API")

        session["flow"] = flow

        return redirect(flow["auth_uri"])

    except Exception as e:
        logging.error(f"Error initiating Azure AD flow: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to initiate Azure login'}), 500

@api_v1.route('/auth/callback', methods=['GET'])
def auth_callback():
    """Azure AD callback endpoint"""
    if not session.get("flow"):
        logging.error("No flow found in session")
        return redirect('/login?error=no_flow')

    try:
        logging.info(f"API Auth callback received. Args: {request.args}")

        result = _build_msal_app().acquire_token_by_auth_code_flow(
            session.get("flow"),
            request.args,
            scopes=['https://graph.microsoft.com/User.Read']
        )
        logging.info("Token acquired successfully")

        if "error" in result:
            error_msg = result.get('error_description', 'Unknown error')
            logging.error(f"Error during login: {error_msg}")
            return redirect(f'/login?error={error_msg}')

        graph_response = requests.get(
            'https://graph.microsoft.com/v1.0/me',
            headers={'Authorization': f"Bearer {result['access_token']}"}
        )
        logging.info(f"Graph API response status: {graph_response.status_code}")

        if not graph_response.ok:
            logging.error(f"Graph API error: {graph_response.text}")
            return redirect('/login?error=graph_api_failed')

        graph_data = graph_response.json()
        logging.info("User info retrieved from Graph API")

        email = graph_data.get('mail')
        if not email:
            email = graph_data.get('userPrincipalName')
            logging.info(f"Using userPrincipalName as email: {email}")

        if not email:
            logging.error(f"No email found in graph data: {graph_data}")
            return redirect('/login?error=no_email')

        user = User.query.filter_by(email=email).first()

        if not user:
            logging.info(f"Creating new user for email: {email}")
            from models import Department
            default_dept = Department.query.first()

            user = User(
                username=email.split('@')[0],
                email=email,
                first_name=graph_data.get('givenName', ''),
                last_name=graph_data.get('surname', ''),
                department_id=default_dept.id if default_dept else None,
                status='active'
            )
            db.session.add(user)
            db.session.commit()
            logging.info(f"New user created: {user.username}")
        else:
            user.first_name = graph_data.get('givenName', user.first_name)
            user.last_name = graph_data.get('surname', user.last_name)

            try:
                from flask import current_app as app
                photo_response = requests.get(
                    'https://graph.microsoft.com/v1.0/me/photos/96x96/$value',
                    headers={'Authorization': f"Bearer {result['access_token']}"}
                )
                if photo_response.ok:
                    profiles_dir = os.path.join(app.root_path, 'static', 'profiles')
                    if not os.path.exists(profiles_dir):
                        os.makedirs(profiles_dir)

                    filename = f"{user.id}.jpg"
                    filepath = os.path.join(profiles_dir, filename)

                    with open(filepath, 'wb') as f:
                        f.write(photo_response.content)

                    user.profile_pic = f"/static/profiles/{filename}"
                    logging.info(f"Updated profile picture for user {user.username}")
                else:
                    logging.info(f"No profile picture found for user {user.username}: {photo_response.status_code}")
            except Exception as e:
                logging.error(f"Error fetching profile picture: {str(e)}")

            db.session.commit()
            logging.info(f"Existing user updated: {user.username}")

        if user.status == 'inactive':
            logging.warning(f"User {user.email} is inactive")
            return redirect('/login?error=account_inactive')

        login_user(user)
        logging.info(f"User {user.username} logged in successfully")

        return redirect('/dashboard')

    except Exception as e:
        logging.error(f"Error in auth callback: {str(e)}", exc_info=True)
        return redirect('/login?error=callback_failed')

@api_v1.route('/auth/logout', methods=['POST'])
@login_required
def logout():
    """Logout current user"""
    try:
        username = current_user.username
        logout_user()
        session.clear()
        logging.info(f"User {username} logged out successfully")
        return jsonify({'message': 'Logged out successfully'}), 200
    except Exception as e:
        logging.error(f"Error during logout: {str(e)}")
        return jsonify({'error': 'Logout failed'}), 500

@api_v1.route('/auth/profile', methods=['PUT'])
@login_required
def update_profile():
    """Update current user's profile"""
    try:
        data = request.get_json()

        if 'first_name' in data:
            current_user.first_name = data['first_name']
        if 'last_name' in data:
            current_user.last_name = data['last_name']
        if 'email' in data:
            current_user.email = data['email']

        db.session.commit()

        logging.info(f"User {current_user.username} updated their profile")
        return jsonify({
            'message': 'Profile updated successfully',
            'user': {
                'id': current_user.id,
                'username': current_user.username,
                'email': current_user.email,
                'first_name': current_user.first_name,
                'last_name': current_user.last_name
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating profile: {str(e)}")
        return jsonify({'error': 'Failed to update profile'}), 500


@api_v1.route('/auth/change-password', methods=['POST'])
@login_required
def change_password():
    """Change current user's password"""
    try:
        data = request.get_json()
        current_password = data.get('current_password')
        new_password = data.get('new_password')
        confirm_password = data.get('confirm_password')

        if not all([current_password, new_password, confirm_password]):
            return jsonify({'error': 'All password fields are required'}), 400

        if current_user.password != current_password:
            return jsonify({'error': 'Current password is incorrect'}), 400

        if new_password != confirm_password:
            return jsonify({'error': 'New passwords do not match'}), 400

        if len(new_password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400

        current_user.password = new_password
        db.session.commit()

        logging.info(f"User {current_user.username} changed their password")
        return jsonify({'message': 'Password changed successfully'}), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error changing password: {str(e)}")
        return jsonify({'error': 'Failed to change password'}), 500
