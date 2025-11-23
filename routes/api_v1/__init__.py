from flask import Blueprint

api_v1_bp = Blueprint('api_v1', __name__)

# Import routes to register them
from . import auth, expenses, users, departments, categories, subcategories, suppliers, credit_cards, dashboard
