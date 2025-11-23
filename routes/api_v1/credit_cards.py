from flask import request, jsonify
from flask_login import current_user, login_required
from models import db, CreditCard
from routes.api_v1 import api_v1_bp
import logging

logger = logging.getLogger(__name__)

@api_v1_bp.route('/credit-cards', methods=['GET'])
@login_required
def get_credit_cards():
    try:
        cards = CreditCard.query.filter_by(status='active').all()
        return jsonify({
            'success': True,
            'data': [{'id': c.id, 'last_four_digits': c.last_four_digits, 'description': c.description} for c in cards]
        }), 200
    except Exception as e:
        logger.error(f"Get credit cards error: {str(e)}")
        return jsonify({'success': False, 'error': 'An error occurred'}), 500
