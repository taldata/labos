from flask import current_app, render_template_string
from threading import Thread
import logging
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content, HtmlContent
import os

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# SendGrid configuration - using environment variables for security
SENDGRID_API_KEY = os.getenv('SENDGRID_API_KEY')
if not SENDGRID_API_KEY:
    raise ValueError("SendGrid API key not found. Please set the SENDGRID_API_KEY environment variable.")

FROM_EMAIL = os.getenv('SENDGRID_FROM_EMAIL', 'sabag.tal@gmail.com')  # Replace with your verified sender email

def send_email_sendgrid(to_email, subject, html_content):
    """Send email using SendGrid"""
    try:
        # Create SendGrid client
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        
        # Log attempt
        logger.info(f"Attempting to send email to {to_email}")
        
        # Create the email message
        message = Mail(
            from_email=FROM_EMAIL,
            to_emails=to_email,
            subject=subject,
            html_content=html_content
        )
        
        # Send the email
        response = sg.send(message)
        
        # Log success
        logger.info(f"Email sent successfully. Status code: {response.status_code}")
        return response
        
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        logger.error(f"API Key present: {'Yes' if SENDGRID_API_KEY else 'No'}")
        logger.error(f"From email: {FROM_EMAIL}")
        raise

def test_email_setup():
    """Test the email setup by sending a test email"""
    try:
        test_subject = "Test Email"
        test_content = """
        <h1>Test Email</h1>
        <p>This is a test email to verify your SendGrid setup.</p>
        """
        
        logger.info("Sending test email...")
        response = send_email_sendgrid(FROM_EMAIL, test_subject, test_content)
        
        if response.status_code == 202:
            logger.info("✅ Email setup is working correctly!")
            return True
        else:
            logger.error(f"❌ Unexpected status code: {response.status_code}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Email setup test failed: {str(e)}")
        return False

def send_async_email(app, recipient, subject, template, **kwargs):
    """Send email asynchronously"""
    try:
        with app.app_context():
            html_content = render_template_string(template, **kwargs)
            send_email_sendgrid(recipient, subject, html_content)
    except Exception as e:
        logger.error(f"Failed in async email sending: {str(e)}")
        raise

def send_email(subject, recipient, template, **kwargs):
    """Send an email using a template"""
    try:
        # Start async thread for sending email
        Thread(target=send_async_email,
               args=(current_app._get_current_object(), recipient, subject, template),
               kwargs=kwargs).start()
        logger.info(f"Started async email sending to {recipient}")
    except Exception as e:
        logger.error(f"Error preparing email: {str(e)}")
        raise

# Email Templates
EXPENSE_SUBMITTED_TEMPLATE = """
<h2>New Expense Submission</h2>
<p>Hello {{ submitter.username }},</p>
<p>A new expense has been submitted that requires your review.</p>
<p><strong>Details:</strong></p>
<ul>
    <li>Amount: ${{ "%.2f"|format(expense.amount) }}</li>
    <li>Description: {{ expense.description }}</li>
    <li>Subcategory: {{ expense.subcategory.name }}</li>
    <li>Date: {{ expense.date.strftime('%Y-%m-%d') }}</li>
    {% if expense.supplier_name %}
    <li>Supplier: {{ expense.supplier_name }}</li>
    {% endif %}
    {% if expense.invoice_filename %}
    <li>Invoice attached: {{ expense.invoice_filename }}</li>
    {% endif %}
</ul>
<p>Please login to the expense management system to review this submission.</p>
"""

EXPENSE_STATUS_UPDATE_TEMPLATE = """
<h2>Expense Status Update</h2>
<p>Hello {{ submitter.username }},</p>
<p>Your expense submission has been {{ status }}.</p>
<p><strong>Expense Details:</strong></p>
<ul>
    <li>Amount: ${{ "%.2f"|format(expense.amount) }}</li>
    <li>Description: {{ expense.description }}</li>
    <li>Subcategory: {{ expense.subcategory.name }}</li>
    <li>Date: {{ expense.date.strftime('%Y-%m-%d') }}</li>
</ul>
{% if status == 'rejected' and expense.rejection_reason %}
<p><strong>Rejection Reason:</strong> {{ expense.rejection_reason }}</p>
{% endif %}
"""

NEW_USER_TEMPLATE = """
<h2>Welcome to Expense Management System</h2>
<p>Hello {{ user.username }},</p>
<p>Your account has been created successfully. You can now login to the system using your credentials.</p>
<p>If you have any questions, please contact your department manager.</p>
"""

# New Email Templates
EXPENSE_REQUEST_CONFIRMATION_TEMPLATE = """
<h2>Confirmation: Your Request Has Been Successfully Registered</h2>
<p>Hello {{ submitter.username }},</p>

<p>Your request has been successfully registered in the system. Below are the main details of your request:</p>

<ul>
    <li><strong>Description:</strong> {{ expense.description }}</li>
    <li><strong>Amount:</strong> ${{ "%.2f"|format(expense.amount) }}</li>
    <li><strong>Type of Request:</strong> {{ expense.subcategory.name }}</li>
    <li><strong>Payment Method:</strong> {{ expense.payment_method }}</li>
    <li><strong>Supplier:</strong> {{ expense.supplier_name if expense.supplier_name else 'N/A' }}</li>
    <li><strong>Status:</strong> {{ expense.status|title }}</li>
    <li><strong>Attached Files:</strong>
        <ul>
            {% if expense.quote_filename %}<li>Quote: {{ expense.quote_filename }}</li>{% endif %}
            {% if expense.invoice_filename %}<li>Invoice: {{ expense.invoice_filename }}</li>{% endif %}
            {% if expense.receipt_filename %}<li>Receipt: {{ expense.receipt_filename }}</li>{% endif %}
            {% if not expense.quote_filename and not expense.invoice_filename and not expense.receipt_filename %}
            <li>No files attached</li>
            {% endif %}
        </ul>
    </li>
</ul>

<p>If additional information regarding your request becomes available, you will receive a notification.</p>
"""

EXPENSE_REQUEST_REJECTION_TEMPLATE = """
<h2>Status Update: Your Request Has Not Been Approved</h2>
<p>Hello {{ submitter.username }},</p>

<p>Unfortunately, your request has not been approved.</p>

<h3>Request Details:</h3>
<ul>
    <li><strong>Description:</strong> {{ expense.description }}</li>
    <li><strong>Amount:</strong> ${{ "%.2f"|format(expense.amount) }}</li>
    <li><strong>Type of Request:</strong> {{ expense.subcategory.name }}</li>
    <li><strong>Payment Method:</strong> {{ expense.payment_method }}</li>
    <li><strong>Supplier:</strong> {{ expense.supplier_name if expense.supplier_name else 'N/A' }}</li>
    <li><strong>Status:</strong> Rejected</li>
    <li><strong>Attached Files:</strong>
        <ul>
            {% if expense.quote_filename %}<li>Quote: {{ expense.quote_filename }}</li>{% endif %}
            {% if expense.invoice_filename %}<li>Invoice: {{ expense.invoice_filename }}</li>{% endif %}
            {% if expense.receipt_filename %}<li>Receipt: {{ expense.receipt_filename }}</li>{% endif %}
            {% if not expense.quote_filename and not expense.invoice_filename and not expense.receipt_filename %}
            <li>No files attached</li>
            {% endif %}
        </ul>
    </li>
</ul>

<p><strong>Reason for Rejection:</strong> {{ expense.rejection_reason }}</p>
<p><strong>Approval Manager:</strong> {{ expense.handler.username if expense.handler else 'N/A' }}</p>

<p>If you have any questions or wish to appeal the decision, please contact the responsible manager.</p>
<p>You may submit a new request in the system if there are changes to the request details.</p>
"""

PASSWORD_CHANGE_CONFIRMATION_TEMPLATE = """
<h2>Password Change Confirmation</h2>
<p>Hello {{ user.username }},</p>

<p>Your password in the system has been successfully updated.</p>

<p><strong>If you did not initiate the password change, please contact the system administrator immediately to ensure the security of your account.</strong></p>
"""

NEW_REQUEST_MANAGER_NOTIFICATION_TEMPLATE = """
<h2>New Request Awaiting Your Attention</h2>
<p>Hello {{ manager.username }},</p>

<p>A new request has been submitted by an employee and requires your attention. Below are the request details:</p>

<ul>
    <li><strong>Employee Name:</strong> {{ expense.submitter.username }}</li>
    <li><strong>Department:</strong> {{ expense.submitter.department.name if expense.submitter.department else 'N/A' }}</li>
    <li><strong>Description:</strong> {{ expense.description }}</li>
    <li><strong>Category:</strong> {{ expense.subcategory.category.name }}</li>
    <li><strong>Subcategory:</strong> {{ expense.subcategory.name }}</li>
    <li><strong>Reason:</strong> {{ expense.reason }}</li>
    <li><strong>Amount:</strong> ${{ "%.2f"|format(expense.amount) }}</li>
    <li><strong>Payment Method:</strong> {{ expense.payment_method }}</li>
    <li><strong>Supplier:</strong> {{ expense.supplier_name if expense.supplier_name else 'N/A' }}</li>
    <li><strong>Status:</strong> {{ expense.status|title }}</li>
    <li><strong>Attached Files:</strong>
        <ul>
            {% if expense.quote_filename %}<li>Quote: {{ expense.quote_filename }}</li>{% endif %}
            {% if expense.invoice_filename %}<li>Invoice: {{ expense.invoice_filename }}</li>{% endif %}
            {% if expense.receipt_filename %}<li>Receipt: {{ expense.receipt_filename }}</li>{% endif %}
            {% if not expense.quote_filename and not expense.invoice_filename and not expense.receipt_filename %}
            <li>No files attached</li>
            {% endif %}
        </ul>
    </li>
</ul>

<p>Please login to the expense management system to review this request.</p>
"""

if __name__ == "__main__":
    test_email_setup()
