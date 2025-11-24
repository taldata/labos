from flask import Blueprint

api_v1 = Blueprint('api_v1', __name__, url_prefix='/api/v1')

# Import routes after blueprint creation to avoid circular imports
from . import auth, expenses, organization
