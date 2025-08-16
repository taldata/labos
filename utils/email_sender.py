from flask import current_app, render_template_string
from threading import Thread
import logging
import os
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from templates.email_templates import (
    EXPENSE_SUBMITTED_TEMPLATE,
    EXPENSE_STATUS_UPDATE_TEMPLATE,
    NEW_USER_TEMPLATE,
    EXPENSE_REQUEST_CONFIRMATION_TEMPLATE,
    EXPENSE_REQUEST_REJECTION_TEMPLATE,
    NEW_REQUEST_MANAGER_NOTIFICATION_TEMPLATE,
    PASSWORD_CHANGE_CONFIRMATION_TEMPLATE,
    EXPENSE_PAYMENT_NOTIFICATION_TEMPLATE
)

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# SMTP (AWS SES) configuration - using environment variables for security
SMTP_SERVER = os.getenv('SMTP_SERVER', 'email-smtp.eu-west-1.amazonaws.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))  # TLS
SMTP_USERNAME = os.getenv('SMTP_USERNAME')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD')

# Email sender information
FROM_EMAIL_ADDRESS = os.getenv('FROM_EMAIL', 'budget-sys@labos.co')  # Verified sender email in SES
FROM_NAME = os.getenv('FROM_NAME', 'LabOS - Expenses System')  # Friendly sender name

def send_email_smtp(to_email, subject, html_content):
    """Send email using SMTP (AWS SES)."""
    try:
        if not (SMTP_USERNAME and SMTP_PASSWORD):
            raise ValueError("SMTP credentials not configured. Set SMTP_USERNAME and SMTP_PASSWORD environment variables.")

        logger.info(f"Attempting to send email via SMTP to {to_email} using server {SMTP_SERVER}:{SMTP_PORT}")

        # Build MIME email
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{FROM_NAME} <{FROM_EMAIL_ADDRESS}>"
        msg['To'] = to_email

        part_html = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(part_html)

        # Connect and send using STARTTLS
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(FROM_EMAIL_ADDRESS, [to_email], msg.as_string())

        logger.info("Email sent successfully via SMTP.")
        return True

    except Exception as e:
        logger.error(f"Failed to send email via SMTP: {str(e)}")
        raise

def test_email_setup():
    """Test the email setup by sending a test email"""
    try:
        test_subject = "Test Email"
        test_content = """
        <h1>Test Email</h1>
        <p>This is a test email to verify your SMTP (AWS SES) setup.</p>
        """
        
        logger.info("Sending test email...")
        result = send_email_smtp(FROM_EMAIL_ADDRESS, test_subject, test_content)
        logger.info("✅ Email setup is working correctly!" if result else "❌ Email setup failed")
        return bool(result)
            
    except Exception as e:
        logger.error(f"❌ Email setup test failed: {str(e)}")
        return False

def send_async_email(app, recipient, subject, html_content):
    """Send email asynchronously"""
    try:
        with app.app_context():
            send_email_smtp(recipient, subject, html_content)
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
