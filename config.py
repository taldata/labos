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
    # Force use of DATABASE_URL if present, otherwise fall back to local settings
    _db_url = os.getenv('DATABASE_URL')
    if _db_url:
        # Standardize postgres scheme for SQLAlchemy 1.4+
        if _db_url.startswith('postgres://'):
            _db_url = _db_url.replace('postgres://', 'postgresql://', 1)
        SQLALCHEMY_DATABASE_URI = _db_url
    else:
        # Construct from individual components if DATABASE_URL is missing
        db_user = os.getenv('DB_USER', 'postgres')
        db_pass = os.getenv('DB_PASSWORD', '')
        db_host = os.getenv('DB_HOST', 'localhost')
        db_port = os.getenv('DB_PORT', '5432')
        db_name = os.getenv('DB_NAME', 'expense_manager')
        SQLALCHEMY_DATABASE_URI = f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"
    
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Upload configuration
    if os.getenv('RENDER') == 'true':
        # For Render deployment with a persistent disk mounted at /var/data
        RENDER_DISK_PATH = '/var/data' 
        UPLOAD_FOLDER = os.path.abspath(os.path.join(RENDER_DISK_PATH, 'uploads'))
    else:
        # For local development
        UPLOAD_FOLDER = os.path.abspath(os.path.join(BASE_DIR, 'uploads'))
        
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
        
        # Validate upload folder was created successfully
        if not os.path.exists(app.config['UPLOAD_FOLDER']):
            logging.error(f"CRITICAL: Failed to create UPLOAD_FOLDER: {app.config['UPLOAD_FOLDER']}")
        elif not os.access(app.config['UPLOAD_FOLDER'], os.R_OK | os.W_OK):
            logging.error(f"CRITICAL: UPLOAD_FOLDER exists but is not readable/writable: {app.config['UPLOAD_FOLDER']}")
        else:
            # Log successful creation and check if folder is empty
            try:
                file_count = len(os.listdir(app.config['UPLOAD_FOLDER']))
                logging.info(f"✅ UPLOAD_FOLDER configured: {app.config['UPLOAD_FOLDER']}")
                logging.info(f"📁 Upload folder contains {file_count} files")
                if file_count == 0:
                    logging.warning("⚠️  Upload folder is empty - no files have been uploaded yet or folder was recently cleared")
            except Exception as e:
                logging.warning(f"Could not list UPLOAD_FOLDER contents: {e}")
        
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
