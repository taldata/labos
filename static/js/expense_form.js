/**
 * Expense Form Handler
 * Handles expense form functionality including OCR document processing
 *
 * @version 2.0.0 - Rebuilt with modular OCR processor
 */

document.addEventListener('DOMContentLoaded', function() {
    // ==================== OCR Setup ====================

    // Initialize OCR Processor
    const ocrProcessor = new OCRProcessor({
        containerSelector: '#ocr-preview',
        formSelector: '#expense-form',
        amountInputSelector: '#amount',
        dateInputSelector: '#invoice_date',
        locale: 'he-IL', // Hebrew locale for Israeli shekel
        currency: 'ILS'
    });

    // File input elements
    const invoiceInput = document.getElementById('invoice');
    const receiptInput = document.getElementById('receipt');
    const quoteInput = document.getElementById('quote');

    // Attach OCR processing to file inputs
    if (invoiceInput) {
        invoiceInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                ocrProcessor.processDocument(file, 'Invoice');
            }
        });
    }

    if (receiptInput) {
        receiptInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                ocrProcessor.processDocument(file, 'Receipt');
            }
        });
    }

    if (quoteInput) {
        quoteInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                ocrProcessor.processDocument(file, 'Quote');
            }
        });
    }

    // ==================== File Validation ====================

    const fileInputs = document.querySelectorAll('input[type="file"]');
    const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB

    fileInputs.forEach(input => {
        input.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const fileSize = this.files[0].size;
                if (fileSize > MAX_FILE_SIZE) {
                    alert('גודל הקובץ חורג מהמגבלה של 16MB. אנא בחר קובץ קטן יותר.\n\nFile size exceeds 16MB limit. Please choose a smaller file.');
                    this.value = '';
                    ocrProcessor.dismiss();
                }
            }
        });
    });

    // ==================== Form Validation & Submission ====================

    const form = document.getElementById('expense-form');
    const amountInput = document.getElementById('amount');
    const typeInput = document.getElementById('type');
    const descriptionInput = document.getElementById('description');
    const reasonInput = document.getElementById('reason');
    const subcategoryInput = document.getElementById('subcategory');

    if (form) {
        // Prevent double submission
        form.addEventListener('submit', function(e) {
            // Check if form was already submitted
            if (this.dataset.submitted === 'true') {
                e.preventDefault();
                return;
            }

            // Validate required fields
            if (!amountInput.value || !typeInput.value || !descriptionInput.value ||
                !reasonInput.value || !subcategoryInput.value) {
                e.preventDefault();
                alert('אנא מלא את כל השדות הנדרשים.\n\nPlease fill in all required fields.');
                return;
            }

            // Mark form as submitted
            this.dataset.submitted = 'true';

            // Disable submit button
            const submitButton = this.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' +
                    (document.documentElement.lang === 'he' ? 'שולח...' : 'Submitting...');
            }

            // Show loading overlay
            showLoadingOverlay();
        });
    }

    function showLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-text">
                    ${document.documentElement.lang === 'he'
                        ? 'שולח הוצאה, אנא המתן...'
                        : 'Submitting expense, please wait...'}
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    // ==================== Currency Symbol Handler ====================

    const currencySelect = document.getElementById('currency');
    const currencySymbol = document.getElementById('currency-symbol');

    if (currencySelect && currencySymbol) {
        currencySelect.addEventListener('change', function() {
            const symbols = {
                'ILS': '₪',
                'USD': '$',
                'EUR': '€'
            };
            currencySymbol.textContent = symbols[this.value] || '₪';
        });
    }

    // ==================== Custom Select with Search ====================

    const customSelect = document.getElementById('custom-subcategory-select');
    if (customSelect) {
        const selectTrigger = customSelect.querySelector('.custom-select-trigger');
        const options = customSelect.querySelector('.custom-options');
        const originalSelect = document.getElementById('subcategory');
        const searchInput = document.getElementById('category-search');
        const noResultsElement = document.querySelector('.no-results');
        const allOptions = document.querySelectorAll('.custom-option');

        // Toggle dropdown
        customSelect.addEventListener('click', function(e) {
            if (e.target === searchInput || e.target.closest('.category-search-container')) {
                e.stopPropagation();
                return;
            }

            e.stopPropagation();
            options.classList.toggle('open');

            if (options.classList.contains('open')) {
                setTimeout(() => searchInput?.focus(), 100);
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function() {
            options.classList.remove('open');
            if (searchInput) {
                searchInput.value = '';
                filterOptions('');
            }
        });

        // Filter options
        if (searchInput) {
            searchInput.addEventListener('click', (e) => e.stopPropagation());
            searchInput.addEventListener('keyup', function() {
                filterOptions(this.value.toLowerCase());
            });
        }

        function filterOptions(searchTerm) {
            let visibleCount = 0;

            allOptions.forEach(option => {
                const dept = option.getAttribute('data-dept')?.toLowerCase() || '';
                const cat = option.getAttribute('data-cat')?.toLowerCase() || '';
                const subcat = option.getAttribute('data-subcat')?.toLowerCase() || '';
                const fullText = `${dept} ${cat} ${subcat}`;

                if (fullText.includes(searchTerm)) {
                    option.style.display = '';
                    visibleCount++;
                } else {
                    option.style.display = 'none';
                }
            });

            if (noResultsElement) {
                noResultsElement.style.display = visibleCount === 0 ? 'block' : 'none';
            }
        }

        // Select option
        allOptions.forEach(option => {
            option.addEventListener('click', function() {
                const value = this.getAttribute('data-value');
                originalSelect.value = value;
                selectTrigger.innerHTML = this.innerHTML;

                const event = new Event('change', { bubbles: true });
                originalSelect.dispatchEvent(event);

                if (searchInput) {
                    searchInput.value = '';
                    filterOptions('');
                }
            });
        });
    }

    // ==================== Payment Method Handler ====================

    const paymentMethodSelect = document.getElementById('payment_method');
    const creditCardGroup = document.getElementById('credit_card_group');
    const creditCardSelect = document.getElementById('credit_card_id');

    function updatePaymentMethodFields() {
        if (!paymentMethodSelect || !creditCardGroup || !creditCardSelect) return;

        if (paymentMethodSelect.value === 'credit') {
            creditCardSelect.setAttribute('required', '');
            creditCardGroup.style.display = 'block';
        } else {
            creditCardSelect.removeAttribute('required');
            creditCardGroup.style.display = 'none';
        }
    }

    if (paymentMethodSelect) {
        paymentMethodSelect.addEventListener('change', updatePaymentMethodFields);
        updatePaymentMethodFields(); // Initialize on page load
    }

    // ==================== Supplier Search ====================

    const supplierSearchInput = document.getElementById('supplier_search');
    const supplierSearchResults = document.getElementById('supplier_search_results');
    const supplierSelect = document.getElementById('supplier_id');
    let searchDebounceTimeout;

    if (supplierSearchInput && supplierSearchResults) {
        supplierSearchInput.addEventListener('input', function(e) {
            clearTimeout(searchDebounceTimeout);
            const searchQuery = e.target.value.trim();

            if (!searchQuery) {
                supplierSearchResults.style.display = 'none';
                return;
            }

            searchDebounceTimeout = setTimeout(() => {
                performSupplierSearch(searchQuery);
            }, 300);
        });

        // Hide results when clicking outside
        document.addEventListener('click', function(e) {
            if (!supplierSearchResults.contains(e.target) && e.target !== supplierSearchInput) {
                supplierSearchResults.style.display = 'none';
            }
        });
    }

    async function performSupplierSearch(query) {
        supplierSearchResults.innerHTML = `
            <div class="result-item searching">
                <i class="fas fa-spinner fa-spin"></i> ${document.documentElement.lang === 'he' ? 'מחפש...' : 'Searching...'}
            </div>
        `;
        supplierSearchResults.style.display = 'block';

        try {
            const params = new URLSearchParams({ search_query: query });
            const response = await fetch(`/api/expense/search_suppliers?${params}`);

            const contentType = response.headers.get('content-type');
            if (!contentType?.includes('application/json')) {
                throw new Error('Server returned non-JSON response');
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Search failed');
            }

            displaySupplierResults(data);

        } catch (error) {
            console.error('Supplier search error:', error);
            supplierSearchResults.innerHTML = `
                <div class="result-item error">
                    <i class="fas fa-exclamation-circle"></i> ${error.message}
                </div>
            `;
        }
    }

    function displaySupplierResults(suppliers) {
        if (!Array.isArray(suppliers) || suppliers.length === 0) {
            supplierSearchResults.innerHTML = `
                <div class="result-item no-results">
                    <i class="fas fa-info-circle"></i> ${document.documentElement.lang === 'he' ? 'לא נמצאו ספקים' : 'No suppliers found'}
                </div>
            `;
            return;
        }

        supplierSearchResults.innerHTML = '';

        suppliers.forEach(supplier => {
            const div = document.createElement('div');
            div.className = 'result-item';
            div.innerHTML = `
                <div class="supplier-name">${supplier.name}</div>
                ${supplier.tax_id ? `<div class="tax-id"><i class="fas fa-id-card"></i> ${supplier.tax_id}</div>` : ''}
            `;

            div.addEventListener('click', () => {
                // Add option if it doesn't exist
                if (!supplierSelect.querySelector(`option[value="${supplier.id}"]`)) {
                    const option = new Option(
                        supplier.tax_id ? `${supplier.name} (${supplier.tax_id})` : supplier.name,
                        supplier.id
                    );
                    supplierSelect.add(option);
                }

                supplierSelect.value = supplier.id;
                supplierSearchInput.value = '';
                supplierSearchResults.style.display = 'none';
            });

            supplierSearchResults.appendChild(div);
        });
    }
});

// ==================== Global Functions for Modal ====================

function openAddSupplierModal() {
    document.getElementById('addSupplierModal').style.display = 'block';
}

function closeAddSupplierModal() {
    document.getElementById('addSupplierModal').style.display = 'none';
    document.getElementById('addSupplierForm').reset();
}

async function submitSupplier(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    try {
        const response = await fetch('/add_supplier', {
            method: 'POST',
            body: formData,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to add supplier');
        }

        if (data.success) {
            // Add supplier to dropdown
            const supplierSelect = document.getElementById('supplier_id');
            const option = new Option(data.supplier.name, data.supplier.id);
            supplierSelect.add(option);
            supplierSelect.value = data.supplier.id;

            // Show success message
            showAlert(form, 'success', document.documentElement.lang === 'he'
                ? 'הספק נוסף בהצלחה!'
                : 'Supplier added successfully!');

            closeAddSupplierModal();
        } else {
            throw new Error(data.message || 'Failed to add supplier');
        }
    } catch (error) {
        console.error('Error adding supplier:', error);
        showAlert(form, 'error', error.message);
    }
}

function showAlert(container, type, message) {
    const alert = document.createElement('div');
    alert.className = `alert ${type}`;
    alert.textContent = message;
    container.insertBefore(alert, container.firstChild);

    setTimeout(() => alert.remove(), 3000);
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('addSupplierModal');
    if (event.target === modal) {
        closeAddSupplierModal();
    }
};
