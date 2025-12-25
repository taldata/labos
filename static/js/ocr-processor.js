/**
 * OCR Processor Module
 * Handles document OCR processing with Azure Form Recognizer
 * Provides a clean, modular interface for document analysis
 *
 * @version 2.0.0
 * @author Claude Code
 */

class OCRProcessor {
    constructor(config = {}) {
        this.config = {
            containerSelector: config.containerSelector || '#ocr-preview',
            formSelector: config.formSelector || '#expense-form',
            amountInputSelector: config.amountInputSelector || '#amount',
            dateInputSelector: config.dateInputSelector || '#invoice_date',
            locale: config.locale || 'he-IL',
            currency: config.currency || 'ILS',
            ...config
        };

        this.state = {
            currentData: null,
            currentType: null,
            isProcessing: false
        };

        this.endpoints = {
            invoice: '/api/expense/process-expense',
            receipt: '/api/expense/process-receipt',
            quote: '/api/expense/process-quote'
        };

        this.messages = {
            he: {
                processing: 'מעבד מסמך...',
                extracting: 'חולץ נתונים מהמסמך. זה עלול לקחת מספר שניות.',
                success: 'נתונים חולצו בהצלחה',
                noData: 'לא נמצאו נתונים במסמך',
                noDataHint: 'אנא ודא שהמסמך ברור וקריא, או הזן את הנתונים ידנית.',
                fileUploaded: 'הקובץ נבחר ויועלה בעת שליחת הטופס.',
                ocrNotAvailable: 'OCR לא זמין',
                ocrNotConfigured: 'שירות ה-OCR לא מוגדר. המסמך נבחר אך הנתונים לא יחולצו אוטומטית.',
                error: 'שגיאה בעיבוד המסמך',
                errorHint: 'אנא נסה שוב או הזן את הנתונים ידנית.',
                amount: 'סכום',
                date: 'תאריך',
                applyData: 'החל נתונים',
                dismiss: 'סגור',
                dataApplied: 'הנתונים הוחלו בהצלחה!'
            },
            en: {
                processing: 'Processing document...',
                extracting: 'Extracting data from your document. This may take a few seconds.',
                success: 'Data extracted successfully',
                noData: 'No data found in document',
                noDataHint: 'Please verify the document is clear and readable, or enter the data manually.',
                fileUploaded: 'Your file will be uploaded when you submit the form.',
                ocrNotAvailable: 'OCR Not Available',
                ocrNotConfigured: 'OCR service not configured. Document selected but data will not be extracted automatically.',
                error: 'Error processing document',
                errorHint: 'Please try again or enter the data manually.',
                amount: 'Amount',
                date: 'Date',
                applyData: 'Apply Data',
                dismiss: 'Dismiss',
                dataApplied: 'Data applied successfully!'
            }
        };

        this.init();
    }

    init() {
        this.container = document.querySelector(this.config.containerSelector);
        if (!this.container) {
            this.container = this.createContainer();
        }
    }

    createContainer() {
        const container = document.createElement('div');
        container.id = 'ocr-preview';
        container.className = 'ocr-preview-container';
        container.style.display = 'none';

        const form = document.querySelector(this.config.formSelector);
        const formActions = form?.querySelector('.form-actions');

        if (formActions) {
            form.insertBefore(container, formActions);
        } else if (form) {
            form.appendChild(container);
        }

        return container;
    }

    getMessage(key) {
        const lang = this.config.locale.startsWith('he') ? 'he' : 'en';
        return this.messages[lang][key] || this.messages.en[key] || key;
    }

    async processDocument(file, documentType) {
        if (!file) {
            console.warn('OCR: No file provided');
            return;
        }

        // Validate file size (16MB limit)
        const maxSize = 16 * 1024 * 1024;
        if (file.size > maxSize) {
            this.showError(documentType, 'File size exceeds 16MB limit. Please choose a smaller file.');
            return;
        }

        this.state.isProcessing = true;
        this.state.currentType = documentType;

        const formData = new FormData();
        formData.append('document', file);

        const endpoint = this.endpoints[documentType.toLowerCase()];
        if (!endpoint) {
            console.error('OCR: Unknown document type:', documentType);
            return;
        }

        this.showLoading(documentType);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Failed to process ${documentType.toLowerCase()}`);
            }

            this.handleResponse(data, documentType);

        } catch (error) {
            console.error('OCR: Processing error:', error);
            this.showError(documentType, error.message);
        } finally {
            this.state.isProcessing = false;
        }
    }

    handleResponse(response, documentType) {
        // Handle OCR service not configured
        if (response.warning === 'OCR service not configured') {
            this.showWarning(documentType, response.message);
            return;
        }

        const extractedData = response.extracted_data || {};
        const hasAmount = extractedData.amount !== null && extractedData.amount !== undefined;
        const hasDate = extractedData.purchase_date !== null && extractedData.purchase_date !== undefined;

        if (!hasAmount && !hasDate) {
            this.showInfo(documentType);
            return;
        }

        this.state.currentData = extractedData;
        this.showSuccess(documentType, extractedData);
    }

    showLoading(documentType) {
        this.container.innerHTML = `
            <div class="ocr-preview loading" role="alert" aria-live="polite">
                <div class="ocr-header">
                    <div class="ocr-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                    </div>
                    <h4>${this.getMessage('processing')}</h4>
                    <span class="ocr-document-badge">${documentType}</span>
                </div>
                <div class="ocr-message">
                    <p class="ocr-hint">
                        <i class="fas fa-info-circle"></i>
                        ${this.getMessage('extracting')}
                    </p>
                </div>
                <div class="ocr-progress">
                    <div class="ocr-progress-bar"></div>
                </div>
            </div>
        `;
        this.container.style.display = 'block';
    }

    showSuccess(documentType, data) {
        const hasAmount = data.amount !== null && data.amount !== undefined;
        const hasDate = data.purchase_date !== null && data.purchase_date !== undefined;

        this.container.innerHTML = `
            <div class="ocr-preview success" role="alert" aria-live="polite">
                <div class="ocr-header">
                    <i class="fas fa-check-circle"></i>
                    <h4>${this.getMessage('success')}</h4>
                    <span class="ocr-document-badge">${documentType}</span>
                </div>
                <div class="ocr-data">
                    ${hasAmount ? `
                        <div class="ocr-field">
                            <span class="ocr-field-label">
                                <i class="fas fa-dollar-sign"></i>
                                ${this.getMessage('amount')}
                            </span>
                            <span class="ocr-field-value">${this.formatAmount(data.amount)}</span>
                        </div>
                    ` : ''}
                    ${hasDate ? `
                        <div class="ocr-field">
                            <span class="ocr-field-label">
                                <i class="fas fa-calendar"></i>
                                ${this.getMessage('date')}
                            </span>
                            <span class="ocr-field-value">${this.formatDate(data.purchase_date)}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="ocr-message">
                    <p class="ocr-hint">
                        <i class="fas fa-lightbulb"></i>
                        ${this.config.locale.startsWith('he')
                            ? 'בדוק את הנתונים המחולצים והחל אותם לטופס אם הם נכונים.'
                            : 'Review the extracted data and apply it to your form if it looks correct.'
                        }
                    </p>
                </div>
                <div class="ocr-actions">
                    <button type="button" class="button primary" data-action="apply">
                        <i class="fas fa-check"></i> ${this.getMessage('applyData')}
                    </button>
                    <button type="button" class="button secondary" data-action="dismiss">
                        <i class="fas fa-times"></i> ${this.getMessage('dismiss')}
                    </button>
                </div>
            </div>
        `;

        this.attachEventListeners();
        this.container.style.display = 'block';
    }

    showWarning(documentType, message) {
        this.container.innerHTML = `
            <div class="ocr-preview warning" role="alert" aria-live="polite">
                <div class="ocr-header">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h4>${this.getMessage('ocrNotAvailable')}</h4>
                    <span class="ocr-document-badge">${documentType}</span>
                </div>
                <div class="ocr-message">
                    <p>${message || this.getMessage('ocrNotConfigured')}</p>
                    <p class="ocr-hint">
                        <i class="fas fa-info-circle"></i>
                        ${this.getMessage('fileUploaded')}
                    </p>
                </div>
                <div class="ocr-actions">
                    <button type="button" class="button secondary" data-action="dismiss">
                        <i class="fas fa-times"></i> ${this.getMessage('dismiss')}
                    </button>
                </div>
            </div>
        `;

        this.attachEventListeners();
        this.container.style.display = 'block';
    }

    showInfo(documentType) {
        this.container.innerHTML = `
            <div class="ocr-preview info" role="alert" aria-live="polite">
                <div class="ocr-header">
                    <i class="fas fa-info-circle"></i>
                    <h4>${this.getMessage('noData')} - ${documentType}</h4>
                    <span class="ocr-document-badge">${documentType}</span>
                </div>
                <div class="ocr-message">
                    <p>${this.config.locale.startsWith('he')
                        ? 'לא ניתן היה לחלץ סכום או תאריך מהמסמך שהועלה.'
                        : 'Could not extract amount or date from the uploaded document.'
                    }</p>
                    <p class="ocr-hint">
                        <i class="fas fa-lightbulb"></i>
                        ${this.getMessage('noDataHint')}
                    </p>
                    <p class="ocr-hint">
                        <i class="fas fa-check"></i>
                        ${this.getMessage('fileUploaded')}
                    </p>
                </div>
                <div class="ocr-actions">
                    <button type="button" class="button secondary" data-action="dismiss">
                        <i class="fas fa-times"></i> ${this.getMessage('dismiss')}
                    </button>
                </div>
            </div>
        `;

        this.attachEventListeners();
        this.container.style.display = 'block';
    }

    showError(documentType, errorMessage) {
        this.container.innerHTML = `
            <div class="ocr-preview error" role="alert" aria-live="assertive">
                <div class="ocr-header">
                    <i class="fas fa-exclamation-circle"></i>
                    <h4>${this.getMessage('error')} - ${documentType}</h4>
                    <span class="ocr-document-badge">${documentType}</span>
                </div>
                <div class="ocr-message">
                    <p class="error-text">${errorMessage}</p>
                    <p class="ocr-hint">
                        <i class="fas fa-redo"></i>
                        ${this.getMessage('errorHint')}
                    </p>
                </div>
                <div class="ocr-actions">
                    <button type="button" class="button secondary" data-action="dismiss">
                        <i class="fas fa-times"></i> ${this.getMessage('dismiss')}
                    </button>
                </div>
            </div>
        `;

        this.attachEventListeners();
        this.container.style.display = 'block';
    }

    attachEventListeners() {
        const applyBtn = this.container.querySelector('[data-action="apply"]');
        const dismissBtn = this.container.querySelector('[data-action="dismiss"]');

        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.applyData());
        }

        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => this.dismiss());
        }
    }

    applyData() {
        if (!this.state.currentData) return;

        const amountInput = document.querySelector(this.config.amountInputSelector);
        const dateInput = document.querySelector(this.config.dateInputSelector);

        let fieldsUpdated = false;

        // Apply amount if available and field is empty or user confirms override
        if (this.state.currentData.amount && amountInput) {
            if (!amountInput.value || confirm(this.config.locale.startsWith('he')
                ? 'להחליף את הסכום הקיים?'
                : 'Replace existing amount?')) {
                amountInput.value = this.state.currentData.amount;
                this.animateFieldUpdate(amountInput);
                fieldsUpdated = true;
            }
        }

        // Apply date if available and field is empty or user confirms override
        if (this.state.currentData.purchase_date && dateInput) {
            if (!dateInput.value || confirm(this.config.locale.startsWith('he')
                ? 'להחליף את התאריך הקיים?'
                : 'Replace existing date?')) {
                const formattedDate = this.formatDateForInput(this.state.currentData.purchase_date);
                dateInput.value = formattedDate;
                this.animateFieldUpdate(dateInput);
                fieldsUpdated = true;
            }
        }

        if (fieldsUpdated) {
            this.showSuccessAlert();
        }

        this.dismiss();
    }

    animateFieldUpdate(element) {
        element.classList.add('field-updated');
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => element.classList.remove('field-updated'), 1200);
    }

    showSuccessAlert() {
        const alert = document.createElement('div');
        alert.className = 'ocr-success-alert';
        alert.innerHTML = `
            <i class="fas fa-check-circle"></i>
            ${this.getMessage('dataApplied')}
        `;

        this.container.insertAdjacentElement('afterend', alert);

        setTimeout(() => {
            alert.style.opacity = '0';
            setTimeout(() => alert.remove(), 300);
        }, 3000);
    }

    dismiss() {
        this.container.style.opacity = '0';
        setTimeout(() => {
            this.container.style.display = 'none';
            this.container.style.opacity = '1';
            this.state.currentData = null;
        }, 300);
    }

    formatAmount(amount) {
        if (amount === null || amount === undefined) return '';

        try {
            return new Intl.NumberFormat(this.config.locale, {
                style: 'currency',
                currency: this.config.currency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
        } catch (e) {
            console.error('OCR: Error formatting amount:', e);
            return `${amount.toFixed(2)} ${this.config.currency}`;
        }
    }

    formatDate(dateStr) {
        if (!dateStr) return '';

        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;

            return date.toLocaleDateString(this.config.locale, {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            console.error('OCR: Error formatting date:', e);
            return dateStr;
        }
    }

    formatDateForInput(dateStr) {
        if (!dateStr) return '';

        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '';

            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (e) {
            console.error('OCR: Error formatting date for input:', e);
            return '';
        }
    }

    // Public API for external use
    getState() {
        return { ...this.state };
    }

    getCurrentData() {
        return this.state.currentData;
    }

    reset() {
        this.state = {
            currentData: null,
            currentType: null,
            isProcessing: false
        };
        this.dismiss();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OCRProcessor;
}
