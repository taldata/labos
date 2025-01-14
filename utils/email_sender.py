from flask import current_app, render_template_string
from threading import Thread
import logging
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content, HtmlContent
import os
from templates.email_templates import (
    EXPENSE_SUBMITTED_TEMPLATE,
    EXPENSE_STATUS_UPDATE_TEMPLATE,
    NEW_USER_TEMPLATE,
    EXPENSE_REQUEST_CONFIRMATION_TEMPLATE,
    EXPENSE_REQUEST_REJECTION_TEMPLATE,
    NEW_REQUEST_MANAGER_NOTIFICATION_TEMPLATE,
    PASSWORD_CHANGE_CONFIRMATION_TEMPLATE
)

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

def send_async_email(app, recipient, subject, html_content):
    """Send email asynchronously"""
    try:
        with app.app_context():
            send_email_sendgrid(recipient, subject, html_content)
    except Exception as e:
        logger.error(f"Failed in async email sending: {str(e)}")
        raise

def send_email(subject, recipient, template, **kwargs):
    """Send an email using a template"""
    try:
        # Create Jinja2 environment for proper template rendering
        from jinja2 import Environment, select_autoescape
        env = Environment(autoescape=select_autoescape(['html', 'xml']))
        
        # Convert the template string to a Jinja2 template
        template = env.from_string(template)
        
        # Render the template with kwargs
        html_content = template.render(**kwargs)
        
        # Log the rendered content for debugging
        logger.info(f"Rendered email content: {html_content[:200]}...")  # Log first 200 chars
        
        # Start async thread for sending email
        Thread(target=send_async_email,
               args=(current_app._get_current_object(), recipient, subject, html_content)).start()
        logger.info(f"Started async email sending to {recipient}")
    except Exception as e:
        logger.error(f"Error preparing email: {str(e)}")
        logger.error(f"Template kwargs: {kwargs}")
        raise

if __name__ == "__main__":
    test_email_setup()
