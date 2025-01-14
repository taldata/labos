# Email Templates with modern design

# Common CSS styles for all emails
EMAIL_STYLE = """
<style>
    body {
        font-family: 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        margin: 0;
        padding: 0;
    }
    .email-container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        background-color: #ffffff;
    }
    .header {
        background: linear-gradient(135deg, #2196F3, #1976D2);
        color: white;
        padding: 30px 20px;
        border-radius: 8px 8px 0 0;
        text-align: center;
        margin-bottom: 20px;
    }
    .header h2 {
        margin: 0;
        font-size: 24px;
        font-weight: 500;
    }
    .content {
        background: #fff;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .details-list {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 6px;
        margin: 15px 0;
    }
    .details-list ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    .details-list li {
        padding: 8px 0;
        border-bottom: 1px solid #e9ecef;
    }
    .details-list li:last-child {
        border-bottom: none;
    }
    .status {
        display: inline-block;
        padding: 6px 12px;
        border-radius: 4px;
        font-weight: 500;
        margin-top: 10px;
    }
    .status-pending { background: #fff3cd; color: #856404; }
    .status-approved { background: #d4edda; color: #155724; }
    .status-rejected { background: #f8d7da; color: #721c24; }
    .footer {
        text-align: center;
        padding: 20px;
        color: #6c757d;
        font-size: 14px;
    }
    .button {
        display: inline-block;
        padding: 10px 20px;
        background-color: #2196F3;
        color: white;
        text-decoration: none;
        border-radius: 4px;
        margin-top: 15px;
    }
    .warning {
        background-color: #fff3cd;
        border: 1px solid #ffeeba;
        color: #856404;
        padding: 12px;
        border-radius: 4px;
        margin: 15px 0;
    }
    .files-section {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 6px;
        margin: 15px 0;
    }
    .file-item {
        display: flex;
        align-items: center;
        padding: 8px;
        background: white;
        border-radius: 4px;
        margin: 5px 0;
    }
    .file-icon {
        margin-right: 10px;
        color: #6c757d;
    }
</style>
"""

EXPENSE_SUBMITTED_TEMPLATE = EMAIL_STYLE + """
<div class="email-container">
    <div class="header">
        <h2>New Expense Submission</h2>
    </div>
    <div class="content">
        <p>Hello {{ submitter.username }},</p>
        <p>A new expense has been submitted that requires your review.</p>
        
        <div class="details-list">
            <h3>Expense Details</h3>
            <ul>
                <li><strong>Amount:</strong> ${{ "%.2f"|format(expense.amount) }}</li>
                <li><strong>Description:</strong> {{ expense.description }}</li>
                <li><strong>Category:</strong> {{ expense.subcategory.name }}</li>
                <li><strong>Date:</strong> {{ expense.date.strftime('%Y-%m-%d') }}</li>
                {% if expense.supplier_name %}
                <li><strong>Supplier:</strong> {{ expense.supplier_name }}</li>
                {% endif %}
            </ul>
        </div>

        {% if expense.invoice_filename or expense.quote_filename or expense.receipt_filename %}
        <div class="files-section">
            <h3>Attached Files</h3>
            {% if expense.quote_filename %}
            <div class="file-item">
                <span class="file-icon">📄</span> Quote: {{ expense.quote_filename }}
            </div>
            {% endif %}
            {% if expense.invoice_filename %}
            <div class="file-item">
                <span class="file-icon">📑</span> Invoice: {{ expense.invoice_filename }}
            </div>
            {% endif %}
            {% if expense.receipt_filename %}
            <div class="file-item">
                <span class="file-icon">🧾</span> Receipt: {{ expense.receipt_filename }}
            </div>
            {% endif %}
        </div>
        {% endif %}

        <a href="#" class="button">Review Expense</a>
    </div>
    <div class="footer">
        <p>This is an automated message from your Expense Management System</p>
    </div>
</div>
"""

EXPENSE_STATUS_UPDATE_TEMPLATE = EMAIL_STYLE + """
<div class="email-container">
    <div class="header">
        <h2>Expense Status Update</h2>
    </div>
    <div class="content">
        <p>Hello {{ submitter.username }},</p>
        <p>Your expense submission has been <span class="status status-{{ status.lower() }}">{{ status }}</span></p>
        
        <div class="details-list">
            <h3>Expense Details</h3>
            <ul>
                <li><strong>Amount:</strong> ${{ "%.2f"|format(expense.amount) }}</li>
                <li><strong>Description:</strong> {{ expense.description }}</li>
                <li><strong>Category:</strong> {{ expense.subcategory.name }}</li>
                <li><strong>Date:</strong> {{ expense.date.strftime('%Y-%m-%d') }}</li>
            </ul>
        </div>

        {% if status == 'rejected' and expense.rejection_reason %}
        <div class="warning">
            <strong>Rejection Reason:</strong> {{ expense.rejection_reason }}
        </div>
        {% endif %}
    </div>
    <div class="footer">
        <p>This is an automated message from your Expense Management System</p>
    </div>
</div>
"""

NEW_USER_TEMPLATE = EMAIL_STYLE + """
<div class="email-container">
    <div class="header">
        <h2>Welcome to Expense Management System</h2>
    </div>
    <div class="content">
        <p>Hello {{ user.username }},</p>
        <p>Your account has been created successfully. You can now login to the system using your credentials.</p>
        
        <div class="details-list">
            <h3>Account Details</h3>
            <ul>
                <li><strong>Username:</strong> {{ user.username }}</li>
                <li><strong>Email:</strong> {{ user.email }}</li>
                {% if user.department %}
                <li><strong>Department:</strong> {{ user.department.name }}</li>
                {% endif %}
            </ul>
        </div>

        <p>For security reasons, please change your password after your first login.</p>
        <a href="#" class="button">Login to System</a>
    </div>
    <div class="footer">
        <p>If you have any questions, please contact your department manager.</p>
        <p>This is an automated message from your Expense Management System</p>
    </div>
</div>
"""

EXPENSE_REQUEST_CONFIRMATION_TEMPLATE = EMAIL_STYLE + """
<div class="email-container">
    <div class="header">
        <h2>Expense Request Confirmation</h2>
    </div>
    <div class="content">
        <p>Hello {{ submitter.username }},</p>
        <p>Your request has been successfully registered in the system.</p>
        
        <div class="details-list">
            <h3>Request Details</h3>
            <ul>
                <li><strong>Description:</strong> {{ expense.description }}</li>
                <li><strong>Amount:</strong> ${{ "%.2f"|format(expense.amount) }}</li>
                <li><strong>Category:</strong> {{ expense.subcategory.name }}</li>
                <li><strong>Payment Method:</strong> {{ expense.payment_method }}</li>
                <li><strong>Supplier:</strong> {{ expense.supplier_name if expense.supplier_name else 'N/A' }}</li>
                <li><strong>Status:</strong> <span class="status status-{{ expense.status.lower() }}">{{ expense.status|title }}</span></li>
            </ul>
        </div>

        {% if expense.quote_filename or expense.invoice_filename or expense.receipt_filename %}
        <div class="files-section">
            <h3>Attached Files</h3>
            {% if expense.quote_filename %}
            <div class="file-item">
                <span class="file-icon">📄</span> Quote: {{ expense.quote_filename }}
            </div>
            {% endif %}
            {% if expense.invoice_filename %}
            <div class="file-item">
                <span class="file-icon">📑</span> Invoice: {{ expense.invoice_filename }}
            </div>
            {% endif %}
            {% if expense.receipt_filename %}
            <div class="file-item">
                <span class="file-icon">🧾</span> Receipt: {{ expense.receipt_filename }}
            </div>
            {% endif %}
        </div>
        {% endif %}

        <p>You will receive a notification when your request is reviewed.</p>
    </div>
    <div class="footer">
        <p>This is an automated message from your Expense Management System</p>
    </div>
</div>
"""

EXPENSE_REQUEST_REJECTION_TEMPLATE = EMAIL_STYLE + """
<div class="email-container">
    <div class="header" style="background: linear-gradient(135deg, #dc3545, #c82333);">
        <h2>Expense Request Rejected</h2>
    </div>
    <div class="content">
        <p>Hello {{ submitter.username }},</p>
        <p>Unfortunately, your request has not been approved.</p>
        
        <div class="details-list">
            <h3>Request Details</h3>
            <ul>
                <li><strong>Description:</strong> {{ expense.description }}</li>
                <li><strong>Amount:</strong> ${{ "%.2f"|format(expense.amount) }}</li>
                <li><strong>Category:</strong> {{ expense.subcategory.name }}</li>
                <li><strong>Payment Method:</strong> {{ expense.payment_method }}</li>
                <li><strong>Supplier:</strong> {{ expense.supplier_name if expense.supplier_name else 'N/A' }}</li>
                <li><strong>Status:</strong> <span class="status status-rejected">Rejected</span></li>
            </ul>
        </div>

        {% if expense.quote_filename or expense.invoice_filename or expense.receipt_filename %}
        <div class="files-section">
            <h3>Attached Files</h3>
            {% if expense.quote_filename %}
            <div class="file-item">
                <span class="file-icon">📄</span> Quote: {{ expense.quote_filename }}
            </div>
            {% endif %}
            {% if expense.invoice_filename %}
            <div class="file-item">
                <span class="file-icon">📑</span> Invoice: {{ expense.invoice_filename }}
            </div>
            {% endif %}
            {% if expense.receipt_filename %}
            <div class="file-item">
                <span class="file-icon">🧾</span> Receipt: {{ expense.receipt_filename }}
            </div>
            {% endif %}
        </div>
        {% endif %}

        <div class="warning">
            <strong>Reason for Rejection:</strong> {{ expense.rejection_reason }}
        </div>

        <p><strong>Approval Manager:</strong> {{ expense.handler.username if expense.handler else 'N/A' }}</p>
        
        <p>If you have any questions or wish to appeal the decision, please contact the responsible manager.</p>
        <p>You may submit a new request in the system if there are changes to the request details.</p>
    </div>
    <div class="footer">
        <p>This is an automated message from your Expense Management System</p>
    </div>
</div>
"""

NEW_REQUEST_MANAGER_NOTIFICATION_TEMPLATE = EMAIL_STYLE + """
<div class="email-container">
    <div class="header" style="background: linear-gradient(135deg, #ffc107, #ff9800);">
        <h2>New Request Awaiting Review</h2>
    </div>
    <div class="content">
        <p>Hello {{ manager.username }},</p>
        <p>A new request has been submitted and requires your attention.</p>
        
        <div class="details-list">
            <h3>Request Details</h3>
            <ul>
                <li><strong>Employee:</strong> {{ expense.submitter.username }}</li>
                <li><strong>Department:</strong> {{ expense.submitter.department.name if expense.submitter.department else 'N/A' }}</li>
                <li><strong>Description:</strong> {{ expense.description }}</li>
                <li><strong>Category:</strong> {{ expense.subcategory.category.name }}</li>
                <li><strong>Subcategory:</strong> {{ expense.subcategory.name }}</li>
                <li><strong>Reason:</strong> {{ expense.reason }}</li>
                <li><strong>Amount:</strong> ${{ "%.2f"|format(expense.amount) }}</li>
                <li><strong>Payment Method:</strong> {{ expense.payment_method }}</li>
                <li><strong>Supplier:</strong> {{ expense.supplier_name if expense.supplier_name else 'N/A' }}</li>
                <li><strong>Status:</strong> <span class="status status-{{ expense.status.lower() }}">{{ expense.status|title }}</span></li>
            </ul>
        </div>

        {% if expense.quote_filename or expense.invoice_filename or expense.receipt_filename %}
        <div class="files-section">
            <h3>Attached Files</h3>
            {% if expense.quote_filename %}
            <div class="file-item">
                <span class="file-icon">📄</span> Quote: {{ expense.quote_filename }}
            </div>
            {% endif %}
            {% if expense.invoice_filename %}
            <div class="file-item">
                <span class="file-icon">📑</span> Invoice: {{ expense.invoice_filename }}
            </div>
            {% endif %}
            {% if expense.receipt_filename %}
            <div class="file-item">
                <span class="file-icon">🧾</span> Receipt: {{ expense.receipt_filename }}
            </div>
            {% endif %}
        </div>
        {% endif %}

        <a href="#" class="button">Review Request</a>
    </div>
    <div class="footer">
        <p>This is an automated message from your Expense Management System</p>
    </div>
</div>
"""

PASSWORD_CHANGE_CONFIRMATION_TEMPLATE = EMAIL_STYLE + """
<div class="email-container">
    <div class="header" style="background: linear-gradient(135deg, #28a745, #218838);">
        <h2>Password Change Confirmation</h2>
    </div>
    <div class="content">
        <p>Hello {{ user.username }},</p>
        <p>Your password in the system has been successfully updated.</p>
        
        <div class="warning">
            <strong>Security Notice:</strong> If you did not initiate this password change, please contact the system administrator immediately to ensure the security of your account.
        </div>

        <a href="#" class="button">Login to System</a>
    </div>
    <div class="footer">
        <p>This is an automated message from your Expense Management System</p>
    </div>
</div>
""" 