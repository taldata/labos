from flask import current_app, render_template_string
from threading import Thread
import logging
import os
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from dotenv import load_dotenv
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

# Load environment variables from .env file
load_dotenv()

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# SMTP (Mailgun) configuration - using environment variables for security
SMTP_SERVER = os.getenv('SMTP_SERVER', 'smtp.mailgun.org')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))  # TLS
SMTP_USERNAME = os.getenv('SMTP_USERNAME')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD')

# Email sender information
FROM_EMAIL_ADDRESS = os.getenv('FROM_EMAIL', 'expenses-app@labos.com')  # Verified sender email in Mailgun
FROM_NAME = os.getenv('FROM_NAME', 'LabOS Expenses App')  # Friendly sender name

def send_email_smtp(to_email, subject, html_content, attachments=None):
    """Send email using SMTP (Mailgun).
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        html_content: HTML content of the email
        attachments: List of file paths to attach to the email
    """
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

        # Attach files if provided
        if attachments:
            for file_path in attachments:
                if os.path.exists(file_path):
                    try:
                        with open(file_path, 'rb') as f:
                            part = MIMEBase('application', 'octet-stream')
                            part.set_payload(f.read())
                            encoders.encode_base64(part)
                            
                            filename = os.path.basename(file_path)
                            part.add_header('Content-Disposition', f'attachment; filename= {filename}')
                            msg.attach(part)
                            logger.info(f"Attached file: {filename}")
                    except Exception as e:
                        logger.error(f"Failed to attach file {file_path}: {str(e)}")
                else:
                    logger.warning(f"Attachment file not found: {file_path}")

        # Connect and send using STARTTLS
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(FROM_EMAIL_ADDRESS, [to_email], msg.as_string())

        logger.info("Email sent successfully via SMTP (Mailgun).")
        return True

    except Exception as e:
        logger.error(f"Failed to send email via SMTP (Mailgun): {str(e)}")
        raise

def test_email_setup():
    """Test the email setup by sending a test email"""
    try:
        test_subject = "Test Email"
        test_content = """
        <h1>Test Email</h1>
        <p>This is a test email to verify your SMTP (Mailgun) setup.</p>
        """
        
        logger.info("Sending test email...")
        result = send_email_smtp(FROM_EMAIL_ADDRESS, test_subject, test_content)
        logger.info("✅ Email setup is working correctly!" if result else "❌ Email setup failed")
        return bool(result)
            
    except Exception as e:
        logger.error(f"❌ Email setup test failed: {str(e)}")
        return False

def send_async_email(app, recipient, subject, html_content, attachments=None):
    """Send email asynchronously"""
    try:
        with app.app_context():
            logger.info(f"Async email thread started for {recipient}")
            result = send_email_smtp(recipient, subject, html_content, attachments)
            logger.info(f"Async email thread completed successfully for {recipient}")
            return result
    except Exception as e:
        logger.error(f"Failed in async email sending to {recipient}: {str(e)}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise

def send_email(subject, recipient, template, attachments=None, **kwargs):
    """Send an email using a template - now with improved reliability
    
    Args:
        subject: Email subject
        recipient: Recipient email address
        template: Email template string
        attachments: Optional list of file paths to attach
        **kwargs: Template variables
    """
    try:
        logger.info(f"Preparing to send email to {recipient} with subject: {subject}")
        
        # Validate inputs
        if not recipient:
            raise ValueError("Recipient email address is required")
        if not subject:
            raise ValueError("Email subject is required")
        if not template:
            raise ValueError("Email template is required")
            
        # Create Jinja2 environment for proper template rendering
        from jinja2 import Environment, select_autoescape
        env = Environment(autoescape=select_autoescape(['html', 'xml']))
        
        # Convert the template string to a Jinja2 template
        template_obj = env.from_string(template)
        
        # Render the template with kwargs
        html_content = template_obj.render(**kwargs)
        
        # Log the rendered content for debugging
        logger.info(f"Rendered email content preview: {html_content[:200]}...")
        
        # SYNCHRONOUS EMAIL SENDING for better reliability
        # This ensures emails are sent before the request completes
        logger.info(f"Sending email synchronously to {recipient}")
        if attachments:
            logger.info(f"Email will include {len(attachments)} attachment(s)")
        result = send_email_smtp(recipient, subject, html_content, attachments)
        
        if result:
            logger.info(f"✅ Email sent successfully to {recipient}")
        else:
            logger.error(f"❌ Email sending failed to {recipient}")
            
        return result
            
    except Exception as e:
        logger.error(f"❌ Error in send_email for {recipient}: {str(e)}")
        logger.error(f"Template kwargs: {kwargs}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise

if __name__ == "__main__":
    test_email_setup()
