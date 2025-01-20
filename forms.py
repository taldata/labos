from flask_wtf import FlaskForm
from wtforms import StringField
from wtforms.validators import Optional

class SupplierSearchForm(FlaskForm):
    class Meta:
        csrf = False  # Disable CSRF for this form since it's used in AJAX requests
        
    search_query = StringField('Search by name or tax ID', validators=[Optional()]) 