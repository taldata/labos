document.addEventListener('DOMContentLoaded', function() {
    const invoiceInput = document.getElementById('invoice');
    const receiptInput = document.getElementById('receipt');
    const quoteInput = document.getElementById('quote');
    const amountInput = document.getElementById('amount');
    const invoiceDateInput = document.getElementById('invoice_date');
    const form = document.getElementById('expense-form');

    // Create preview container for OCR data
    const previewContainer = document.createElement('div');
    previewContainer.id = 'ocr-preview';
    previewContainer.className = 'ocr-preview-container';
    previewContainer.style.display = 'none';
    form.insertBefore(previewContainer, form.querySelector('.form-actions'));

    // Track currently uploaded files
    let currentOcrData = null;
    let currentDocumentType = null;

    /**
     * Show OCR preview with extracted data
     */
    function showOcrPreview(data, response, documentType) {
        currentDocumentType = documentType;

        // Handle OCR service not configured
        if (response.warning === 'OCR service not configured') {
            previewContainer.innerHTML = `
                <div class="ocr-preview warning">
                    <div class="ocr-header">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h4>OCR Not Available</h4>
                    </div>
                    <div class="ocr-message">
                        <p>${response.message}</p>
                        <p class="ocr-hint">Your ${documentType.toLowerCase()} has been selected and will be uploaded when you submit the form.</p>
                    </div>
                    <div class="ocr-actions">
                        <button type="button" class="button secondary" onclick="window.dismissOcrPreview()">
                            <i class="fas fa-times"></i> Dismiss
                        </button>
                    </div>
                </div>
            `;
            previewContainer.style.display = 'block';
            return;
        }

        // Check if we actually extracted any data
        const hasAmount = data.amount !== null && data.amount !== undefined;
        const hasDate = data.purchase_date !== null && data.purchase_date !== undefined;

        if (!hasAmount && !hasDate) {
            previewContainer.innerHTML = `
                <div class="ocr-preview info">
                    <div class="ocr-header">
                        <i class="fas fa-info-circle"></i>
                        <h4>No Data Extracted from ${documentType}</h4>
                    </div>
                    <div class="ocr-message">
                        <p>Could not extract amount or date from the uploaded document.</p>
                        <p class="ocr-hint">Please verify the document is clear and readable, or enter the data manually.</p>
                        <p class="ocr-hint">Your ${documentType.toLowerCase()} will still be uploaded when you submit the form.</p>
                    </div>
                    <div class="ocr-actions">
                        <button type="button" class="button secondary" onclick="window.dismissOcrPreview()">
                            <i class="fas fa-times"></i> Dismiss
                        </button>
                    </div>
                </div>
            `;
            previewContainer.style.display = 'block';
            return;
        }

        // Show extracted data
        currentOcrData = data;

        previewContainer.innerHTML = `
            <div class="ocr-preview success">
                <div class="ocr-header">
                    <i class="fas fa-check-circle"></i>
                    <h4>Data Extracted from ${documentType}</h4>
                </div>
                <div class="ocr-data">
                    ${hasAmount ? `
                        <div class="ocr-field">
                            <span class="ocr-field-label">Amount:</span>
                            <span class="ocr-field-value">${formatAmount(data.amount)}</span>
                        </div>
                    ` : ''}
                    ${hasDate ? `
                        <div class="ocr-field">
                            <span class="ocr-field-label">Date:</span>
                            <span class="ocr-field-value">${formatDate(data.purchase_date)}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="ocr-message">
                    <p class="ocr-hint">Review the extracted data and apply it to your form if it looks correct.</p>
                </div>
                <div class="ocr-actions">
                    <button type="button" class="button primary" onclick="window.applyOcrData()">
                        <i class="fas fa-check"></i> Apply Data
                    </button>
                    <button type="button" class="button secondary" onclick="window.dismissOcrPreview()">
                        <i class="fas fa-times"></i> Dismiss
                    </button>
                </div>
            </div>
        `;
        previewContainer.style.display = 'block';
    }

    /**
     * Show loading state
     */
    function showLoading(documentType) {
        previewContainer.innerHTML = `
            <div class="ocr-preview loading">
                <div class="ocr-header">
                    <div class="ocr-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                    </div>
                    <h4>Processing ${documentType}...</h4>
                </div>
                <div class="ocr-message">
                    <p>Extracting data from your document. This may take a few seconds.</p>
                </div>
            </div>
        `;
        previewContainer.style.display = 'block';
    }

    /**
     * Show error message
     */
    function showError(documentType, errorMessage) {
        previewContainer.innerHTML = `
            <div class="ocr-preview error">
                <div class="ocr-header">
                    <i class="fas fa-exclamation-circle"></i>
                    <h4>Error Processing ${documentType}</h4>
                </div>
                <div class="ocr-message">
                    <p class="error-text">${errorMessage}</p>
                    <p class="ocr-hint">Please try again or enter the data manually.</p>
                </div>
                <div class="ocr-actions">
                    <button type="button" class="button secondary" onclick="window.dismissOcrPreview()">
                        <i class="fas fa-times"></i> Dismiss
                    </button>
                </div>
            </div>
        `;
        previewContainer.style.display = 'block';
    }

    /**
     * Format amount for display
     */
    function formatAmount(amount) {
        if (amount === null || amount === undefined) return '';
        return new Intl.NumberFormat('he-IL', {
            style: 'currency',
            currency: 'ILS',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    /**
     * Format date for display
     */
    function formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('he-IL', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            return dateStr;
        }
    }

    /**
     * Apply OCR data to form fields
     */
    function applyOcrData() {
        if (!currentOcrData) return;

        // Apply amount if available and field is empty
        if (currentOcrData.amount && !amountInput.value) {
            amountInput.value = currentOcrData.amount;
            // Add visual feedback
            amountInput.classList.add('field-updated');
            setTimeout(() => amountInput.classList.remove('field-updated'), 1000);
        }

        // Apply date if available and field is empty
        if (currentOcrData.purchase_date && !invoiceDateInput.value) {
            const date = new Date(currentOcrData.purchase_date);
            const formattedDate = date.toISOString().split('T')[0];
            invoiceDateInput.value = formattedDate;
            // Add visual feedback
            invoiceDateInput.classList.add('field-updated');
            setTimeout(() => invoiceDateInput.classList.remove('field-updated'), 1000);
        }

        // Show success message
        const successMsg = document.createElement('div');
        successMsg.className = 'alert success ocr-success-alert';
        successMsg.innerHTML = '<i class="fas fa-check"></i> Data applied successfully!';
        previewContainer.insertAdjacentElement('afterend', successMsg);

        setTimeout(() => {
            successMsg.style.opacity = '0';
            setTimeout(() => successMsg.remove(), 300);
        }, 3000);

        dismissOcrPreview();
    }

    /**
     * Dismiss OCR preview
     */
    function dismissOcrPreview() {
        previewContainer.style.opacity = '0';
        setTimeout(() => {
            previewContainer.style.display = 'none';
            previewContainer.style.opacity = '1';
        }, 300);
        currentOcrData = null;
    }

    // Make functions globally available
    window.applyOcrData = applyOcrData;
    window.dismissOcrPreview = dismissOcrPreview;

    /**
     * Process document upload
     */
    async function processDocument(file, documentType, endpoint) {
        if (!file) return;

        const formData = new FormData();
        formData.append('document', file);

        showLoading(documentType);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Failed to process ${documentType.toLowerCase()}`);
            }

            // Handle both success and warning cases
            const extractedData = data.extracted_data || {};
            showOcrPreview(extractedData, data, documentType);

        } catch (error) {
            console.error(`Error processing ${documentType}:`, error);
            showError(documentType, error.message);
        }
    }

    // Invoice upload handler
    if (invoiceInput) {
        invoiceInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            processDocument(file, 'Invoice', '/api/expense/process-expense');
        });
    }

    // Receipt upload handler
    if (receiptInput) {
        receiptInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            processDocument(file, 'Receipt', '/api/expense/process-receipt');
        });
    }

    // Quote upload handler
    if (quoteInput) {
        quoteInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            processDocument(file, 'Quote', '/api/expense/process-quote');
        });
    }

    // File input validation
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        input.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const fileSize = this.files[0].size / 1024 / 1024; // in MB
                if (fileSize > 16) {
                    alert('File size exceeds 16MB limit. Please choose a smaller file.');
                    this.value = '';
                    dismissOcrPreview();
                }
            }
        });
    });

    // Form validation
    form.addEventListener('submit', function(e) {
        const amount = document.getElementById('amount').value;
        const type = document.getElementById('type').value;
        const description = document.getElementById('description').value;
        const reason = document.getElementById('reason').value;
        const subcategory = document.getElementById('subcategory').value;

        if (!amount || !type || !description || !reason || !subcategory) {
            e.preventDefault();
            alert('Please fill in all required fields.');
        } else {
            // Disable submit button to prevent multiple submissions
            const submitButton = document.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

                // Add loading overlay
                const loadingOverlay = document.createElement('div');
                loadingOverlay.className = 'loading-overlay';
                loadingOverlay.innerHTML = `
                    <div class="loading-content">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">Submitting expense, please wait...</div>
                    </div>
                `;
                document.body.appendChild(loadingOverlay);
            }
        }
    });
});

// Add CSS for OCR preview
document.addEventListener('DOMContentLoaded', function() {
    const style = document.createElement('style');
    style.textContent = `
        /* OCR Preview Container */
        .ocr-preview-container {
            margin: 20px 0;
            transition: opacity 0.3s ease;
        }

        .ocr-preview {
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            animation: slideDown 0.3s ease;
        }

        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .ocr-preview.success {
            background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
            border: 2px solid #28a745;
        }

        .ocr-preview.error {
            background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
            border: 2px solid #dc3545;
        }

        .ocr-preview.warning {
            background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
            border: 2px solid #ffc107;
        }

        .ocr-preview.info {
            background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%);
            border: 2px solid #17a2b8;
        }

        .ocr-preview.loading {
            background: linear-gradient(135deg, #e7f3ff 0%, #d0e7ff 100%);
            border: 2px solid #007bff;
        }

        .ocr-header {
            display: flex;
            align-items: center;
            margin-bottom: 15px;
            gap: 10px;
        }

        .ocr-header i {
            font-size: 24px;
        }

        .ocr-preview.success .ocr-header i {
            color: #28a745;
        }

        .ocr-preview.error .ocr-header i {
            color: #dc3545;
        }

        .ocr-preview.warning .ocr-header i {
            color: #ffc107;
        }

        .ocr-preview.info .ocr-header i {
            color: #17a2b8;
        }

        .ocr-preview.loading .ocr-header i {
            color: #007bff;
        }

        .ocr-header h4 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: #333;
        }

        .ocr-spinner {
            display: flex;
            align-items: center;
        }

        .ocr-data {
            background: rgba(255, 255, 255, 0.7);
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 15px;
        }

        .ocr-field {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }

        .ocr-field:last-child {
            border-bottom: none;
        }

        .ocr-field-label {
            font-weight: 600;
            color: #555;
        }

        .ocr-field-value {
            font-weight: 500;
            color: #333;
            font-size: 16px;
        }

        .ocr-message {
            margin-bottom: 15px;
        }

        .ocr-message p {
            margin: 8px 0;
            color: #555;
            line-height: 1.5;
        }

        .ocr-hint {
            font-size: 14px;
            color: #666;
            font-style: italic;
        }

        .error-text {
            color: #721c24;
            font-weight: 500;
        }

        .ocr-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .ocr-actions .button {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }

        .ocr-actions .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        }

        .ocr-actions .button.primary {
            background-color: #28a745;
            color: white;
        }

        .ocr-actions .button.primary:hover {
            background-color: #218838;
        }

        .ocr-actions .button.secondary {
            background-color: #6c757d;
            color: white;
        }

        .ocr-actions .button.secondary:hover {
            background-color: #5a6268;
        }

        /* Field updated animation */
        .field-updated {
            animation: fieldHighlight 1s ease;
        }

        @keyframes fieldHighlight {
            0%, 100% {
                background-color: white;
            }
            50% {
                background-color: #d4edda;
            }
        }

        /* Success alert */
        .ocr-success-alert {
            margin: 15px 0;
            padding: 12px 15px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: opacity 0.3s ease;
        }

        /* Loading overlay */
        .loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        }

        .loading-content {
            text-align: center;
        }

        .loading-spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 15px;
        }

        .loading-text {
            color: white;
            font-size: 18px;
            font-weight: 500;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
});
