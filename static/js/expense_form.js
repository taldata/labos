document.addEventListener('DOMContentLoaded', function() {
    const invoiceInput = document.getElementById('invoice');
    const receiptInput = document.getElementById('receipt');
    const quoteInput = document.getElementById('quote');
    const amountInput = document.getElementById('amount');
    const purchaseDateInput = document.getElementById('purchase_date');
    const form = document.getElementById('expense-form');

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
                
                // Auto-fill only amount and date fields if they're empty
                if (data.invoice_total && !amountInput.value) {
                    amountInput.value = data.invoice_total;
                }
                if (data.invoice_date && !purchaseDateInput.value) {
                    // Convert date to YYYY-MM-DD format
                    const date = new Date(data.invoice_date);
                    const formattedDate = date.toISOString().split('T')[0];
                    purchaseDateInput.value = formattedDate;
                }
            } catch (error) {
                console.error('Error processing invoice:', error);
                // Continue with form submission even if document processing fails
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
                
                // Auto-fill only amount and date fields if they're empty
                if (data.amount && !amountInput.value) {
                    amountInput.value = data.amount;
                }
                if (data.purchase_date && !purchaseDateInput.value) {
                    // Convert date to YYYY-MM-DD format
                    const date = new Date(data.purchase_date);
                    const formattedDate = date.toISOString().split('T')[0];
                    purchaseDateInput.value = formattedDate;
                }
            } catch (error) {
                console.error('Error processing receipt:', error);
                // Continue with form submission even if document processing fails
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
                
                // Auto-fill only amount and date fields if they're empty
                if (data.total_amount && !amountInput.value) {
                    amountInput.value = data.total_amount;
                }
                if (data.quote_date && !purchaseDateInput.value) {
                    // Convert date to YYYY-MM-DD format
                    const date = new Date(data.quote_date);
                    const formattedDate = date.toISOString().split('T')[0];
                    purchaseDateInput.value = formattedDate;
                }
            } catch (error) {
                console.error('Error processing quote:', error);
                // Continue with form submission even if document processing fails
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
        }
    });
});
