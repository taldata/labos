document.addEventListener('DOMContentLoaded', function() {
    const invoiceInput = document.getElementById('invoice');
    const supplierInput = document.getElementById('supplier_name');
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
                
                // Auto-fill form fields if they're empty
                if (data.vendor_name && !supplierInput.value) {
                    supplierInput.value = data.vendor_name;
                }
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
});
