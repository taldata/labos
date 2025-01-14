# Email Templates with modern design

# Common CSS styles for all emails
EMAIL_STYLE = """
<style>
    body {
        font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.6;
        color: #2d3748;
        margin: 0;
        padding: 0;
    }
    .email-container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        background-color: #ffffff;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        border-radius: 12px;
    }
    .header {
        background: linear-gradient(135deg, #4299e1, #2b6cb0);
        color: white;
        padding: 35px 25px;
        border-radius: 12px 12px 0 0;
        text-align: center;
        margin-bottom: 25px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header h2 {
        margin: 0;
        font-size: 28px;
        font-weight: 600;
        letter-spacing: 0.5px;
    }
    .content {
        background: #fff;
        padding: 25px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }
    .details-list {
        background: #f7fafc;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
        border: 1px solid #e2e8f0;
    }
    .details-list h3 {
        color: #2d3748;
        margin-top: 0;
        margin-bottom: 15px;
        font-size: 20px;
    }
    .details-list ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }
    .details-list li {
        padding: 10px 0;
        border-bottom: 1px solid #edf2f7;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .details-list li:last-child {
        border-bottom: none;
    }
    .status {
        display: inline-block;
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: 600;
        margin-top: 12px;
        font-size: 14px;
    }
    .status-pending { 
        background: #fefcbf; 
        color: #744210;
    }
    .status-approved { 
        background: #c6f6d5; 
        color: #22543d;
    }
    .status-rejected { 
        background: #fed7d7; 
        color: #742a2a;
    }
    .footer {
        text-align: center;
        padding: 25px;
        color: #718096;
        font-size: 14px;
        border-top: 1px solid #edf2f7;
        margin-top: 25px;
    }
    .button {
        display: inline-block;
        padding: 12px 24px;
        background: linear-gradient(135deg, #4299e1, #2b6cb0);
        color: white;
        text-decoration: none;
        border-radius: 6px;
        margin-top: 20px;
        font-weight: 600;
        text-align: center;
        transition: all 0.3s ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .button:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
    }
    .warning {
        background-color: #fff5f5;
        border: 1px solid #feb2b2;
        color: #742a2a;
        padding: 16px;
        border-radius: 8px;
        margin: 20px 0;
        font-weight: 500;
    }
    .files-section {
        background: #f7fafc;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
        border: 1px solid #e2e8f0;
    }
    .file-item {
        display: flex;
        align-items: center;
        padding: 12px;
        background: white;
        border-radius: 6px;
        margin: 8px 0;
        border: 1px solid #edf2f7;
        transition: all 0.2s ease;
    }
    .file-item:hover {
        transform: translateX(-2px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }
    .file-icon {
        margin-right: 12px;
        font-size: 20px;
    }
    .highlight {
        color: #4299e1;
        font-weight: 600;
    }
    .amount {
        font-size: 24px;
        color: #2d3748;
        font-weight: 700;
        margin: 15px 0;
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
        <p>Your expense has been successfully submitted to the system.</p>
        
        <div class="amount">${{ "%.2f"|format(expense.amount) }}</div>
        
        <div class="details-list">
            <h3>Expense Details</h3>
            <ul>
                <li>
                    <span>Description:</span>
                    <span class="highlight">{{ expense.description }}</span>
                </li>
                <li>
                    <span>Category:</span>
                    <span>{{ expense.subcategory.name }}</span>
                </li>
                <li>
                    <span>Date:</span>
                    <span>{{ expense.date.strftime('%Y-%m-%d') }}</span>
                </li>
                {% if expense.supplier_name %}
                <li>
                    <span>Supplier:</span>
                    <span>{{ expense.supplier_name }}</span>
                </li>
                {% endif %}
                <li>
                    <span>Status:</span>
                    <span class="status status-pending">Pending Review</span>
                </li>
            </ul>
        </div>

        {% if expense.invoice_filename or expense.quote_filename or expense.receipt_filename %}
        <div class="files-section">
            <h3>Attached Files</h3>
            {% if expense.quote_filename %}
            <div class="file-item">
                <span class="file-icon">📄</span>
                <span>Quote: {{ expense.quote_filename }}</span>
            </div>
            {% endif %}
            {% if expense.invoice_filename %}
            <div class="file-item">
                <span class="file-icon">📑</span>
                <span>Invoice: {{ expense.invoice_filename }}</span>
            </div>
            {% endif %}
            {% if expense.receipt_filename %}
            <div class="file-item">
                <span class="file-icon">🧾</span>
                <span>Receipt: {{ expense.receipt_filename }}</span>
            </div>
            {% endif %}
        </div>
        {% endif %}

        <p>You will be notified once your request has been reviewed.</p>
        <a href="#" class="button">View Expense Details</a>
    </div>
    <div class="footer">
        <p>This is an automated message from your Expense Management System</p>
    </div>
</div>
"""

EXPENSE_STATUS_UPDATE_TEMPLATE = EMAIL_STYLE + """
<div class="email-container">
    <div class="header" style="background: linear-gradient(135deg, {% if status == 'approved' %}#48bb78, #2f855a{% else %}#f56565, #c53030{% endif %});">
        <h2>Expense Status Update</h2>
    </div>
    <div class="content">
        <p>Hello {{ submitter.username }},</p>
        
        {% if status == 'approved' %}
        <p>Your expense request has been approved and will be processed by the Finance department.</p>
        {% else %}
        <p>Unfortunately, your expense request has not been approved.</p>
        {% endif %}
        
        <div class="amount">${{ expense.amount }}</div>
        
        <div class="details-list">
            <h3>Expense Details</h3>
            <ul>
                <li>
                    <span>Description:</span>
                    <span class="highlight">{{ expense.description }}</span>
                </li>
                <li>
                    <span>Category:</span>
                    <span>{{ expense.subcategory.name }}</span>
                </li>
                <li>
                    <span>Date:</span>
                    <span>{{ expense.date.strftime('%Y-%m-%d') }}</span>
                </li>
                <li>
                    <span>Status:</span>
                    <span class="status status-{{ status }}">{{ status|title }}</span>
                </li>
            </ul>
        </div>

        {% if status == 'rejected' and expense.rejection_reason %}
        <div class="warning">
            <strong>Reason for Rejection:</strong> {{ expense.rejection_reason }}
        </div>
        {% endif %}

        <a href="#" class="button">View Expense Details</a>
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
        <p>Your account has been successfully created. You can now log in to the system using your credentials.</p>
        
        <div class="details-list">
            <h3>Account Details</h3>
            <ul>
                <li>
                    <span>Username:</span>
                    <span class="highlight">{{ user.username }}</span>
                </li>
                <li>
                    <span>Email:</span>
                    <span>{{ user.email }}</span>
                </li>
                {% if user.department %}
                <li>
                    <span>Department:</span>
                    <span>{{ user.department.name }}</span>
                </li>
                {% endif %}
            </ul>
        </div>

        <div class="warning">
            For security reasons, please change your password after your first login.
        </div>

        <a href="#" class="button">Login to System</a>
    </div>
    <div class="footer">
        <p>If you have any questions, please contact your department manager.</p>
        <p>This is an automated message from your Expense Management System</p>
    </div>
</div>
"""

NEW_REQUEST_MANAGER_NOTIFICATION_TEMPLATE = EMAIL_STYLE + """
<div class="email-container">
    <div class="header" style="background: linear-gradient(135deg, #ed8936, #dd6b20);">
        <h2>New Request Awaiting Review</h2>
    </div>
    <div class="content">
        <p>Hello {{ manager.username }},</p>
        <p>A new expense request has been submitted and requires your attention.</p>
        
        <div class="amount">${{ "%.2f"|format(expense.amount) }}</div>
        
        <div class="details-list">
            <h3>Request Details</h3>
            <ul>
                <li>
                    <span>Employee:</span>
                    <span class="highlight">{{ expense.submitter.username }}</span>
                </li>
                <li>
                    <span>Department:</span>
                    <span>{{ expense.submitter.department.name if expense.submitter.department else 'N/A' }}</span>
                </li>
                <li>
                    <span>Description:</span>
                    <span>{{ expense.description }}</span>
                </li>
                <li>
                    <span>Category:</span>
                    <span>{{ expense.subcategory.category.name }}</span>
                </li>
                <li>
                    <span>Subcategory:</span>
                    <span>{{ expense.subcategory.name }}</span>
                </li>
                <li>
                    <span>Reason:</span>
                    <span>{{ expense.reason }}</span>
                </li>
                <li>
                    <span>Payment Method:</span>
                    <span>{{ expense.payment_method }}</span>
                </li>
                {% if expense.supplier_name %}
                <li>
                    <span>Supplier:</span>
                    <span>{{ expense.supplier_name }}</span>
                </li>
                {% endif %}
            </ul>
        </div>

        {% if expense.quote_filename or expense.invoice_filename or expense.receipt_filename %}
        <div class="files-section">
            <h3>Attached Files</h3>
            {% if expense.quote_filename %}
            <div class="file-item">
                <span class="file-icon">📄</span>
                <span>Quote: {{ expense.quote_filename }}</span>
            </div>
            {% endif %}
            {% if expense.invoice_filename %}
            <div class="file-item">
                <span class="file-icon">📑</span>
                <span>Invoice: {{ expense.invoice_filename }}</span>
            </div>
            {% endif %}
            {% if expense.receipt_filename %}
            <div class="file-item">
                <span class="file-icon">🧾</span>
                <span>Receipt: {{ expense.receipt_filename }}</span>
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
    <div class="header" style="background: linear-gradient(135deg, #48bb78, #2f855a);">
        <h2>Password Change Confirmation</h2>
    </div>
    <div class="content">
        <p>Hello {{ user.username }},</p>
        <p>Your password has been successfully updated.</p>
        
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

EXPENSE_REQUEST_CONFIRMATION_TEMPLATE = EMAIL_STYLE + """
<div class="email-container">
    <div class="header">
        <h2>Expense Request Confirmation</h2>
    </div>
    <div class="content">
        <p>Hello {{ submitter.username }},</p>
        <p>Your expense request has been successfully registered in the system.</p>
        
        <div class="amount">${{ "%.2f"|format(expense.amount) }}</div>
        
        <div class="details-list">
            <h3>Request Details</h3>
            <ul>
                <li>
                    <span>Description:</span>
                    <span class="highlight">{{ expense.description }}</span>
                </li>
                <li>
                    <span>Amount:</span>
                    <span>${{ "%.2f"|format(expense.amount) }}</span>
                </li>
                <li>
                    <span>Category:</span>
                    <span>{{ expense.subcategory.name }}</span>
                </li>
                <li>
                    <span>Payment Method:</span>
                    <span>{{ expense.payment_method }}</span>
                </li>
                <li>
                    <span>Supplier:</span>
                    <span>{{ expense.supplier_name if expense.supplier_name else 'N/A' }}</span>
                </li>
                <li>
                    <span>Status:</span>
                    <span class="status status-{{ expense.status.lower() }}">{{ expense.status|title }}</span>
                </li>
            </ul>
        </div>

        {% if expense.quote_filename or expense.invoice_filename or expense.receipt_filename %}
        <div class="files-section">
            <h3>Attached Files</h3>
            {% if expense.quote_filename %}
            <div class="file-item">
                <span class="file-icon">📄</span>
                <span>Quote: {{ expense.quote_filename }}</span>
            </div>
            {% endif %}
            {% if expense.invoice_filename %}
            <div class="file-item">
                <span class="file-icon">📑</span>
                <span>Invoice: {{ expense.invoice_filename }}</span>
            </div>
            {% endif %}
            {% if expense.receipt_filename %}
            <div class="file-item">
                <span class="file-icon">🧾</span>
                <span>Receipt: {{ expense.receipt_filename }}</span>
            </div>
            {% endif %}
        </div>
        {% endif %}

        <p>You will receive a notification when your request has been reviewed.</p>
        <a href="#" class="button">View Request Details</a>
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
        <p>Unfortunately, your expense request has not been approved.</p>
        
        <div class="amount">${{ expense.amount }}</div>
        
        <div class="details-list">
            <h3>Request Details</h3>
            <ul>
                <li>
                    <span>Description:</span>
                    <span class="highlight">{{ expense.description }}</span>
                </li>
                <li>
                    <span>Category:</span>
                    <span>{{ expense.subcategory.name }}</span>
                </li>
                <li>
                    <span>Payment Method:</span>
                    <span>{{ expense.payment_method }}</span>
                </li>
                <li>
                    <span>Status:</span>
                    <span class="status status-rejected">Rejected</span>
                </li>
            </ul>
        </div>

        <div class="warning">
            <strong>Reason for Rejection:</strong> {{ expense.rejection_reason }}
        </div>

        <p>If you have any questions about this decision, please contact your manager ({{ expense.handler.username }}).</p>
        <p>You may submit a new request with the necessary corrections if needed.</p>

        <a href="#" class="button">View Request Details</a>
    </div>
    <div class="footer">
        <p>This is an automated message from your Expense Management System</p>
    </div>
</div>
""" 