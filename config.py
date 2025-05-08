import os
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

class Config:
    # Base directory of the application
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    
    # Secret key for session management
    SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-here')
    
    # Azure AD Configuration
    AZURE_AD_CLIENT_ID = os.getenv('AZURE_AD_CLIENT_ID')
    AZURE_AD_CLIENT_SECRET = os.getenv('AZURE_AD_CLIENT_SECRET')
    AZURE_AD_TENANT_ID = os.getenv('AZURE_AD_TENANT_ID')
    AZURE_AD_AUTHORITY = f'https://login.microsoftonline.com/{AZURE_AD_TENANT_ID}'
    AZURE_AD_REDIRECT_PATH = '/auth/callback'  # This will be the callback endpoint
    AZURE_AD_SCOPES = ['https://graph.microsoft.com/User.Read']  # Only use the Graph API scope
    
    # Flask configuration
    SESSION_TYPE = 'filesystem'
    PREFERRED_URL_SCHEME = 'https'  # Changed from 'http' to 'https'
    
    # Database configuration
    # If DATABASE_URL is provided (Render), use it directly
    # Otherwise, construct from individual components
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', '').replace('postgres://', 'postgresql://') or \
        f"postgresql://{os.getenv('DB_USER', 'postgres')}:{os.getenv('DB_PASSWORD', '')}@{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '5432')}/{os.getenv('DB_NAME', 'expense_manager')}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Upload configuration
    if os.getenv('RENDER') == 'true':
        # For Render deployment with a persistent disk mounted at /var/data
        RENDER_DISK_PATH = '/var/data' 
        UPLOAD_FOLDER = os.path.join(RENDER_DISK_PATH, 'uploads')
    else:
        # For local development
        UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
        
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size

    @staticmethod
    def init_app(app):
        # Create necessary directories
        # The 'instance' folder is typically for things like SQLite DBs if not using Postgres,
        # or other instance-specific files.
        local_instance_path = os.path.join(app.config['BASE_DIR'], 'instance')
        os.makedirs(local_instance_path, exist_ok=True)
        # It's generally safer to set permissions specifically for what's needed.
        # 0o777 is very permissive.
        try:
            os.chmod(local_instance_path, 0o755) # rwxr-xr-x
        except Exception as e:
            logging.warning(f"Could not chmod local instance path {local_instance_path}: {e}")

        # Create the UPLOAD_FOLDER regardless of environment (local or Render)
        # app.config['UPLOAD_FOLDER'] will have the correct path based on the environment
        if not app.config.get('UPLOAD_FOLDER'):
            logging.error("UPLOAD_FOLDER is not defined in app.config!")
            # Handle error appropriately, maybe raise an exception
            return

        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        
        # Set permissions for UPLOAD_FOLDER
        # On Render, ensure the user running the app has write permissions to /var/data/uploads
        # The chmod might be less critical if Render's disk permissions are already suitable.
        try:
            os.chmod(app.config['UPLOAD_FOLDER'], 0o755) # rwxr-xr-x, allow write for owner, read/execute for others
        except Exception as e:
            # Log if chmod fails, especially on Render where it might not be necessary/allowed
            # depending on how the disk is mounted and user permissions.
            logging.warning(f"Could not chmod UPLOAD_FOLDER {app.config['UPLOAD_FOLDER']}: {e}")

        # Set database file permissions if it exists (relevant for SQLite, less for Postgres)
        db_path = os.path.join(local_instance_path, 'database.db')
        if os.path.exists(db_path):
            try:
                os.chmod(db_path, 0o644) # rw-r--r--
            except Exception as e:
                logging.warning(f"Could not chmod database file {db_path}: {e}")
