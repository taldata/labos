import os

class Config:
    # Base directory of the application
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    
    # Secret key for session management
    SECRET_KEY = 'your-secret-key-here'
    
    # SQLite database
    SQLALCHEMY_DATABASE_URI = f'sqlite:///{os.path.join(BASE_DIR, "instance", "database.db")}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Upload configuration
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size

    @staticmethod
    def init_app(app):
        # Create necessary directories
        os.makedirs(os.path.join(app.config['BASE_DIR'], 'instance'), exist_ok=True)
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        
        # Set directory permissions
        os.chmod(os.path.join(app.config['BASE_DIR'], 'instance'), 0o777)
        os.chmod(app.config['UPLOAD_FOLDER'], 0o777)
        
        # Set database file permissions if it exists
        db_path = os.path.join(app.config['BASE_DIR'], 'instance', 'database.db')
        if os.path.exists(db_path):
            os.chmod(db_path, 0o666)
