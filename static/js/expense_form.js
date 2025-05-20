document.addEventListener('DOMContentLoaded', function() {
    const invoiceInput = document.getElementById('invoice');
    const receiptInput = document.getElementById('receipt');
    const quoteInput = document.getElementById('quote');
    const amountInput = document.getElementById('amount');
    const purchaseDateInput = document.getElementById('purchase_date');
    const form = document.getElementById('expense-form');

    // Create preview container for OCR data
    const previewContainer = document.createElement('div');
    previewContainer.id = 'ocr-preview';
    previewContainer.style.display = 'none';
    previewContainer.style.marginTop = '10px';
    previewContainer.style.padding = '10px';
    previewContainer.style.border = '1px solid #ddd';
    previewContainer.style.borderRadius = '4px';
    previewContainer.style.backgroundColor = '#f8f9fa';
    form.insertBefore(previewContainer, form.querySelector('.form-actions'));

    function showOcrPreview(data, documentType) {
        previewContainer.innerHTML = `
            <h4>Extracted Data from ${documentType}</h4>
            <div class="ocr-data">
                ${data.amount ? `<p><strong>Amount:</strong> ${data.amount}</p>` : ''}
                ${data.purchase_date ? `<p><strong>Date:</strong> ${new Date(data.purchase_date).toLocaleDateString()}</p>` : ''}
            </div>
            <div class="ocr-actions">
                <button type="button" class="button primary" onclick="applyOcrData()">Apply Data</button>
                <button type="button" class="button secondary" onclick="dismissOcrPreview()">Dismiss</button>
            </div>
        `;
        previewContainer.style.display = 'block';
        // Store the OCR data for later use
        window.ocrData = data;
    }

    function applyOcrData() {
        if (window.ocrData) {
            if (window.ocrData.amount && !amountInput.value) {
                amountInput.value = window.ocrData.amount;
            }
            if (window.ocrData.purchase_date && !purchaseDateInput.value) {
                const date = new Date(window.ocrData.purchase_date);
                const formattedDate = date.toISOString().split('T')[0];
                purchaseDateInput.value = formattedDate;
            }
        }
        dismissOcrPreview();
    }

    function dismissOcrPreview() {
        previewContainer.style.display = 'none';
        window.ocrData = null;
    }

    // Make functions globally available
    window.applyOcrData = applyOcrData;
    window.dismissOcrPreview = dismissOcrPreview;

    if (invoiceInput) {
        invoiceInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('document', file);

            try {
                const response = await fetch('/api/expense/process-expense', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error('Failed to process invoice');
                }

                const data = await response.json();
                showOcrPreview(data, 'Invoice');
            } catch (error) {
                console.error('Error processing invoice:', error);
            }
        });
    }

    if (receiptInput) {
        receiptInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('document', file);

            try {
                const response = await fetch('/api/expense/process-receipt', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error('Failed to process receipt');
                }

                const data = await response.json();
                showOcrPreview(data, 'Receipt');
            } catch (error) {
                console.error('Error processing receipt:', error);
            }
        });
    }

    if (quoteInput) {
        quoteInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('document', file);

            try {
                const response = await fetch('/api/expense/process-quote', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error('Failed to process quote');
                }

                const data = await response.json();
                showOcrPreview(data, 'Quote');
            } catch (error) {
                console.error('Error processing quote:', error);
            }
        });
    }

    // File input preview and validation
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        input.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const fileSize = this.files[0].size / 1024 / 1024; // in MB
                if (fileSize > 16) {
                    alert('File size exceeds 16MB limit. Please choose a smaller file.');
                    this.value = '';
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
            // If form is valid, disable the submit button to prevent multiple submissions
            const submitButton = document.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
                
                // Add a loading overlay to indicate processing
                const loadingOverlay = document.createElement('div');
                loadingOverlay.className = 'loading-overlay';
                loadingOverlay.innerHTML = '<div class="loading-spinner"></div><div class="loading-text">Submitting expense, please wait...</div>';
                document.body.appendChild(loadingOverlay);
            }
        }
    });
});

// Add CSS for loading overlay
document.addEventListener('DOMContentLoaded', function() {
    const style = document.createElement('style');
    style.textContent = `
        .loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        }
        .loading-spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 2s linear infinite;
            margin-bottom: 15px;
        }
        .loading-text {
            color: white;
            font-size: 18px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
});
