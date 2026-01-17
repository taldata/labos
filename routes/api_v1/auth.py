from flask import jsonify, request, session, url_for, redirect
from flask_login import login_user, logout_user, current_user, login_required
from models import User, db
import msal
import logging
import requests
import os
from . import api_v1
from config import Config

def get_modern_ui_url(path=''):
    """Get the correct modern UI URL based on environment"""
    if os.getenv('FLASK_ENV') == 'development':
        return f'http://localhost:3000/{path}'
    else:
        # In production, serve from Flask route
        return f'/modern/{path}'

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
                'can_use_modern_version': current_user.can_use_modern_version,
                'preferred_version': current_user.preferred_version,
                'department_id': current_user.department_id
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

        # DEV MODE: Allow "dev" password for any user in development
        is_dev_mode = os.getenv('FLASK_ENV') == 'development' or os.getenv('DEV_MODE') == 'true'
        dev_password_used = is_dev_mode and password == 'dev'

        # Find user by username
        user = User.query.filter_by(username=username).first()

        if not user:
            logging.warning(f"Login attempt for non-existent user: {username}")
            return jsonify({'error': 'Invalid username or password'}), 401

        # Check password (in production, use proper password hashing)
        # In dev mode, allow "dev" as a universal password
        if not dev_password_used and user.password != password:
            logging.warning(f"Failed login attempt for user: {username}")
            return jsonify({'error': 'Invalid username or password'}), 401

        # Check if user is active
        if user.status != 'active':
            logging.warning(f"Login attempt for inactive user: {username}")
            return jsonify({'error': 'Account is inactive. Please contact administrator.'}), 403

        # Check if user has access to modern version (admins always have access)
        if not user.can_use_modern_version and not user.is_admin:
            logging.warning(f"User {username} does not have access to modern version")
            return jsonify({'error': 'You do not have access to the modern UI. Please contact your administrator.'}), 403

        # Log the user in
        login_user(user)
        logging.info(f"User {username} logged in successfully via username/password")

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
                'can_use_modern_version': user.can_use_modern_version,
                'preferred_version': user.preferred_version,
                'department_id': user.department_id
            }
        }), 200

    except Exception as e:
        logging.error(f"Error during login: {str(e)}")
        return jsonify({'error': 'Login failed. Please try again.'}), 500

@api_v1.route('/auth/login/azure', methods=['GET'])
def login_azure():
    """Initiate Azure AD login flow"""
    try:
        # Use the legacy redirect URI (/auth/callback) to satisfy Azure AD requirements
        # without adding new URLs to the Azure portal.
        redirect_uri = url_for('auth_callback', _external=True, _scheme='https')
        logging.info(f"API Azure Login - Redirecting to legacy callback: {redirect_uri}")

        # Initialize MSAL flow
        msal_app = _build_msal_app()
        flow = msal_app.initiate_auth_code_flow(
            scopes=['https://graph.microsoft.com/User.Read'],
            redirect_uri=redirect_uri
        )
        logging.info(f"MSAL Flow initiated for API")

        session["flow"] = flow
        session["modern_ui_login"] = True  # Flag to redirect to modern UI after login

        return redirect(flow["auth_uri"])

    except Exception as e:
        logging.error(f"Error initiating Azure AD flow: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to initiate Azure login'}), 500

@api_v1.route('/auth/callback', methods=['GET'])
def auth_callback():
    """Azure AD callback endpoint"""
    if not session.get("flow"):
        logging.error("No flow found in session")
        return redirect(get_modern_ui_url('login?error=no_flow'))

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
            return redirect(get_modern_ui_url(f'login?error={error_msg}'))

        # Get user info from Microsoft Graph
        graph_response = requests.get(
            'https://graph.microsoft.com/v1.0/me',
            headers={'Authorization': f"Bearer {result['access_token']}"}
        )
        logging.info(f"Graph API response status: {graph_response.status_code}")

        if not graph_response.ok:
            logging.error(f"Graph API error: {graph_response.text}")
            return redirect(get_modern_ui_url('login?error=graph_api_failed'))

        graph_data = graph_response.json()
        logging.info("User info retrieved from Graph API")

        # Find or create user based on email
        email = graph_data.get('mail')
        if not email:
            email = graph_data.get('userPrincipalName')
            logging.info(f"Using userPrincipalName as email: {email}")

        if not email:
            logging.error(f"No email found in graph data: {graph_data}")
            return redirect(get_modern_ui_url('login?error=no_email'))

        user = User.query.filter_by(email=email).first()

        if not user:
            logging.info(f"Creating new user for email: {email}")
            # Get department (default to first department if exists)
            from models import Department
            default_dept = Department.query.first()

            user = User(
                username=email.split('@')[0],
                email=email,
                first_name=graph_data.get('givenName', ''),
                last_name=graph_data.get('surname', ''),
                department_id=default_dept.id if default_dept else None,
                status='active',
                can_use_modern_version=False,  # Admin must grant access
                preferred_version='legacy'
            )
            db.session.add(user)
            db.session.commit()
            logging.info(f"New user created: {user.username}")
        else:
            # Update user info from Azure AD
            user.first_name = graph_data.get('givenName', user.first_name)
            user.last_name = graph_data.get('surname', user.last_name)
            db.session.commit()
            logging.info(f"Existing user updated: {user.username}")

        # Check if user has access to modern version (admins always have access)
        if not user.can_use_modern_version and not user.is_admin:
            logging.warning(f"User {user.email} does not have access to modern version")
            # Redirect to legacy version with message
            login_user(user)
            return redirect('/?error=modern_access_denied')

        # Check if user is active
        if user.status == 'inactive':
            logging.warning(f"User {user.email} is inactive")
            return redirect(get_modern_ui_url('login?error=account_inactive'))

        # Log the user in
        login_user(user)
        logging.info(f"User {user.username} logged in successfully")

        # Redirect to modern UI dashboard
        return redirect(get_modern_ui_url('dashboard'))

    except Exception as e:
        logging.error(f"Error in auth callback: {str(e)}", exc_info=True)
        return redirect(get_modern_ui_url('login?error=callback_failed'))

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

@api_v1.route('/auth/switch-to-modern', methods=['GET'])
@login_required
def switch_to_modern():
    """Redirect logged-in user to modern UI"""
    try:
        # Admins always have access to modern UI
        if not current_user.can_use_modern_version and not current_user.is_admin:
            return redirect('/?error=modern_access_denied')

        # Update preference
        current_user.preferred_version = 'modern'
        db.session.commit()

        logging.info(f"User {current_user.username} switching to modern UI")

        # Redirect to modern UI dashboard
        return redirect(get_modern_ui_url('dashboard'))

    except Exception as e:
        logging.error(f"Error switching to modern UI: {str(e)}")
        return redirect('/?error=switch_failed')

@api_v1.route('/auth/set-version-preference', methods=['POST'])
@login_required
def set_version_preference():
    """Set user's preferred version (legacy or modern)"""
    try:
        data = request.get_json()
        version = data.get('version')

        if version not in ['legacy', 'modern']:
            return jsonify({'error': 'Invalid version'}), 400

        # Admins always have access to modern version
        if version == 'modern' and not current_user.can_use_modern_version and not current_user.is_admin:
            return jsonify({'error': 'You do not have access to the modern version'}), 403

        current_user.preferred_version = version
        db.session.commit()

        logging.info(f"User {current_user.username} set version preference to {version}")
        return jsonify({'message': 'Version preference updated', 'version': version}), 200

    except Exception as e:
        logging.error(f"Error setting version preference: {str(e)}")
        return jsonify({'error': 'Failed to update version preference'}), 500


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
        
        # Verify current password
        if current_user.password != current_password:
            return jsonify({'error': 'Current password is incorrect'}), 400
        
        # Verify new password matches confirmation
        if new_password != confirm_password:
            return jsonify({'error': 'New passwords do not match'}), 400
        
        # Validate password length
        if len(new_password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
        
        # Update password
        current_user.password = new_password
        db.session.commit()
        
        logging.info(f"User {current_user.username} changed their password")
        return jsonify({'message': 'Password changed successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error changing password: {str(e)}")
        return jsonify({'error': 'Failed to change password'}), 500
