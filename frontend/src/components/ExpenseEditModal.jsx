import React, { useState, useEffect } from 'react'
import { Modal, Button, Input, Select, TomSelectInput, useToast } from './ui'
import './ExpenseEditModal.css'

// ============================================================================
// Component: ExpenseEditModal
// ============================================================================
function ExpenseEditModal({ isOpen, onClose, expense, onSuccess, subcategories, suppliers, creditCards, isManagerView = false }) {
    const { success, error: showError } = useToast()
    const [formData, setFormData] = useState({})
    const [editFiles, setEditFiles] = useState({ quote: null, invoice: null, receipt: null })
    const [deleteFiles, setDeleteFiles] = useState({ quote: false, invoice: false, receipt: false })
    const [ilsPreview, setIlsPreview] = useState(null)
    const [budgetYears, setBudgetYears] = useState([])
    const [selectedBudgetYear, setSelectedBudgetYear] = useState('')
    const [filteredSubcategories, setFilteredSubcategories] = useState([])
    const [loadingSubcategories, setLoadingSubcategories] = useState(false)

    // Fetch budget years when modal opens
    useEffect(() => {
        if (isOpen) {
            fetch('/api/v1/organization/years', { credentials: 'include' })
                .then(res => res.ok ? res.json() : Promise.reject())
                .then(data => {
                    const years = data.years || data || []
                    setBudgetYears(years)
                })
                .catch(() => setBudgetYears([]))
        }
    }, [isOpen])

    useEffect(() => {
        if (expense) {
            const yearValue = expense.budget_year?.year || ''
            setSelectedBudgetYear(yearValue ? String(yearValue) : '')
            setFormData({
                status: expense.status || '',
                payment_status: expense.payment_status || '',
                amount: expense.amount || '',
                currency: expense.currency || 'ILS',
                description: expense.description || '',
                reason: expense.reason || '',
                type: expense.type || 'needs_approval',
                subcategory_id: expense.subcategory?.id || '',
                supplier_id: expense.supplier?.id || '',
                credit_card_id: expense.credit_card_id || '',
                payment_method: expense.payment_method || '',
                invoice_date: expense.invoice_date ? expense.invoice_date.split('T')[0] : '',
                rejection_reason: expense.rejection_reason || ''
            })
            setEditFiles({ quote: null, invoice: null, receipt: null })
            setDeleteFiles({ quote: false, invoice: false, receipt: false })
            setIlsPreview(null)
        }
    }, [expense])

    // Fetch subcategories when budget year changes
    useEffect(() => {
        if (!selectedBudgetYear) {
            setFilteredSubcategories(subcategories)
            return
        }

        const fetchSubcategories = async () => {
            setLoadingSubcategories(true)
            try {
                const res = await fetch(
                    `/api/v1/form-data/categories?budget_year=${selectedBudgetYear}&all=true&include_subcategories=true`,
                    { credentials: 'include' }
                )
                if (res.ok) {
                    const data = await res.json()
                    const flatSubs = []
                    for (const cat of (data.categories || [])) {
                        for (const sub of (cat.subcategories || [])) {
                            flatSubs.push({
                                id: sub.id,
                                name: sub.name,
                                category_name: cat.name,
                                department_name: cat.department_name
                            })
                        }
                    }
                    setFilteredSubcategories(flatSubs)
                } else {
                    setFilteredSubcategories(subcategories)
                }
            } catch {
                setFilteredSubcategories(subcategories)
            } finally {
                setLoadingSubcategories(false)
            }
        }

        fetchSubcategories()
    }, [selectedBudgetYear, subcategories])

    const handleBudgetYearChange = (newYear) => {
        setSelectedBudgetYear(newYear)
        setFormData(prev => ({ ...prev, subcategory_id: '' }))
    }

    // Fetch ILS preview when amount/currency changes in edit modal
    useEffect(() => {
        if (!formData.currency || formData.currency === 'ILS' || !formData.amount) {
            setIlsPreview(null)
            return
        }
        const fetchPreview = async () => {
            try {
                const dateParam = expense?.date ? `&date=${expense.date.split('T')[0]}` : ''
                const res = await fetch(
                    `/api/v1/exchange-rate?currency=${formData.currency}&amount=${formData.amount}${dateParam}`,
                    { credentials: 'include' }
                )
                if (res.ok) {
                    const data = await res.json()
                    setIlsPreview(data)
                }
            } catch (err) { /* ignore */ }
        }
        const timer = setTimeout(fetchPreview, 500)
        return () => clearTimeout(timer)
    }, [formData.amount, formData.currency])

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleFileChange = (e, fileType) => {
        const file = e.target.files[0]
        if (file) {
            setEditFiles(prev => ({ ...prev, [fileType]: file }))
            setDeleteFiles(prev => ({ ...prev, [fileType]: false }))
        }
    }

    const handleDeleteFile = (fileType) => {
        setDeleteFiles(prev => ({ ...prev, [fileType]: true }))
        setEditFiles(prev => ({ ...prev, [fileType]: null }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        // Validate required fields
        if (!formData.description || !formData.supplier_id) {
            showError('Description and Supplier are required fields')
            return
        }

        try {
            const formDataToSend = new FormData()

            Object.entries(formData).forEach(([key, value]) => {
                if (value !== null && value !== undefined && value !== '') {
                    formDataToSend.append(key, value)
                }
            })

            if (editFiles.quote) formDataToSend.append('quote', editFiles.quote)
            if (editFiles.invoice) formDataToSend.append('invoice', editFiles.invoice)
            if (editFiles.receipt) formDataToSend.append('receipt', editFiles.receipt)

            if (deleteFiles.quote) formDataToSend.append('delete_quote', 'true')
            if (deleteFiles.invoice) formDataToSend.append('delete_invoice', 'true')
            if (deleteFiles.receipt) formDataToSend.append('delete_receipt', 'true')

            const res = await fetch(`/api/v1/admin/expenses/${expense.id}`, {
                method: 'PUT',
                credentials: 'include',
                body: formDataToSend
            })

            if (res.ok) {
                success('Expense updated successfully')
                onSuccess()
                onClose()
            } else {
                const data = await res.json()
                showError(data.error || 'Failed to update expense')
            }
        } catch (err) {
            showError('An error occurred')
        }
    }

    const formatCurrency = (amount, currency) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'ILS'
        }).format(amount)
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Expense" size="large">
            <form onSubmit={handleSubmit} className="eh-edit-form">
                {expense && (
                    <div className="eh-edit-form__summary">
                        <p><strong>Employee:</strong> {expense.user?.name}</p>
                        <p><strong>Original Amount:</strong> {formatCurrency(expense.amount, expense.currency)}</p>
                    </div>
                )}

                {/* Basic Information */}
                <div className="eh-edit-form__section">
                    <h4 className="eh-edit-form__section-title">
                        <i className="fas fa-info-circle" /> Basic Information
                    </h4>
                    <div className="eh-edit-form__row">
                        <Input
                            type="number"
                            label="Amount"
                            name="amount"
                            value={formData.amount}
                            onChange={(e) => handleInputChange('amount', e.target.value)}
                            step="0.01"
                            min="0"
                        />
                        <Select
                            label="Currency"
                            name="currency"
                            value={formData.currency}
                            onChange={(e) => handleInputChange('currency', e.target.value)}
                        >
                            <option value="ILS">ILS (₪)</option>
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                        </Select>
                    </div>
                    {formData.currency !== 'ILS' && ilsPreview && (
                        <div style={{
                            padding: '0.5rem 0.75rem', backgroundColor: '#f0f7ff', borderRadius: '6px',
                            fontSize: '0.85rem', color: '#1565c0', marginBottom: '0.5rem'
                        }}>
                            <i className="fas fa-exchange-alt" style={{ marginRight: '0.5rem' }} />
                            ≈ ₪{ilsPreview.amount_ils?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            {ilsPreview.rate && <span style={{ opacity: 0.7, marginLeft: '0.5rem' }}>(rate: {ilsPreview.rate})</span>}
                        </div>
                    )}
                    <Input
                        label="Description"
                        name="description"
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        required
                    />
                    <Input
                        label="Business Reason"
                        name="reason"
                        value={formData.reason}
                        onChange={(e) => handleInputChange('reason', e.target.value)}
                    />
                    <div className="eh-edit-form__row">
                        <Select
                            label="Type"
                            name="type"
                            value={formData.type}
                            onChange={(e) => handleInputChange('type', e.target.value)}
                        >
                            <option value="needs_approval">Needs Approval</option>
                            <option value="pre_approved">Pre-approved</option>
                            <option value="reimbursement">Reimbursement</option>
                        </Select>
                        <Select
                            label="Budget Year"
                            name="budget_year"
                            value={selectedBudgetYear}
                            onChange={(e) => handleBudgetYearChange(e.target.value)}
                        >
                            <option value="">All Years</option>
                            {budgetYears.map(by => (
                                <option key={by.id} value={by.year}>
                                    {by.name || by.year}{by.is_current ? ' (Current)' : ''}
                                </option>
                            ))}
                        </Select>
                    </div>
                    <TomSelectInput
                        label="Subcategory"
                        name="subcategory_id"
                        value={formData.subcategory_id}
                        onChange={(e) => handleInputChange('subcategory_id', e.target.value)}
                        options={filteredSubcategories.map(sub => ({
                            id: sub.id,
                            name: `${sub.department_name} > ${sub.category_name} > ${sub.name}`
                        }))}
                        displayKey="name"
                        valueKey="id"
                        placeholder={loadingSubcategories ? "Loading..." : "Select Subcategory"}
                        allowClear={true}
                    />
                </div>

                {/* Status & Payment - admin only */}
                {!isManagerView && (
                    <div className="eh-edit-form__section">
                        <h4 className="eh-edit-form__section-title">
                            <i className="fas fa-check-circle" /> Status & Payment
                        </h4>
                        <div className="eh-edit-form__row">
                            <Select
                                label="Status"
                                name="status"
                                value={formData.status}
                                onChange={(e) => handleInputChange('status', e.target.value)}
                            >
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                            </Select>
                            <Select
                                label="Payment Status"
                                name="payment_status"
                                value={formData.payment_status}
                                onChange={(e) => handleInputChange('payment_status', e.target.value)}
                            >
                                <option value="">Not Set</option>
                                <option value="pending_attention">Pending Attention</option>
                                <option value="pending_payment">Pending Payment</option>
                                <option value="paid">Paid</option>
                            </Select>
                        </div>
                        {formData.status === 'rejected' && (
                            <Input
                                label="Rejection Reason"
                                name="rejection_reason"
                                value={formData.rejection_reason}
                                onChange={(e) => handleInputChange('rejection_reason', e.target.value)}
                                placeholder="Enter reason for rejection..."
                            />
                        )}
                        <div className="eh-edit-form__row">
                            <Select
                                label="Payment Method"
                                name="payment_method"
                                value={formData.payment_method}
                                onChange={(e) => handleInputChange('payment_method', e.target.value)}
                            >
                                <option value="">Select Method</option>
                                <option value="credit">Credit Card</option>
                                <option value="bank_transfer">Bank Transfer</option>
                                <option value="standing_order">Standing Order</option>
                                <option value="check">Check</option>
                            </Select>
                            {formData.payment_method === 'credit' && (
                                <Select
                                    label="Credit Card"
                                    name="credit_card_id"
                                    value={formData.credit_card_id}
                                    onChange={(e) => handleInputChange('credit_card_id', e.target.value)}
                                >
                                    <option value="">Select Card</option>
                                    {creditCards.map(card => (
                                        <option key={card.id} value={card.id}>
                                            {card.name} (*{card.last_four_digits})
                                        </option>
                                    ))}
                                </Select>
                            )}
                        </div>
                    </div>
                )}

                {/* Supplier & Date */}
                <div className="eh-edit-form__section">
                    <h4 className="eh-edit-form__section-title">
                        <i className="fas fa-store" /> Supplier & Date
                    </h4>
                    <div className="eh-edit-form__row">
                        <TomSelectInput
                            label="Supplier"
                            name="supplier_id"
                            value={formData.supplier_id}
                            onChange={(e) => handleInputChange('supplier_id', e.target.value)}
                            options={suppliers}
                            displayKey="name"
                            valueKey="id"
                            placeholder="Select Supplier"
                            allowClear={false}
                            required
                        />
                        <Input
                            type="date"
                            label="Invoice Date"
                            name="invoice_date"
                            value={formData.invoice_date}
                            onChange={(e) => handleInputChange('invoice_date', e.target.value)}
                        />
                    </div>
                </div>

                {/* Attachments */}
                <div className="eh-edit-form__section">
                    <h4 className="eh-edit-form__section-title">
                        <i className="fas fa-paperclip" /> Attachments
                    </h4>
                    <div className="eh-edit-form__files">
                        {['quote', 'invoice', 'receipt'].map(fileType => (
                            <div key={fileType} className="eh-file-upload">
                                <label className="eh-file-upload__label">
                                    {fileType.charAt(0).toUpperCase() + fileType.slice(1)}
                                </label>
                                {expense?.[`${fileType}_filename`] && !deleteFiles[fileType] && !editFiles[fileType] ? (
                                    <div className="eh-file-upload__existing">
                                        <a href={`/download/${expense[`${fileType}_filename`]}`} target="_blank" rel="noopener noreferrer">
                                            <i className={`fas ${fileType === 'invoice' ? 'fa-file-invoice-dollar' : fileType === 'receipt' ? 'fa-receipt' : 'fa-file-alt'}`} />
                                            View {fileType.charAt(0).toUpperCase() + fileType.slice(1)}
                                        </a>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="small"
                                            icon="fas fa-trash"
                                            onClick={() => handleDeleteFile(fileType)}
                                            title={`Delete ${fileType}`}
                                        />
                                    </div>
                                ) : deleteFiles[fileType] ? (
                                    <div className="eh-file-upload__deleted">
                                        <span><i className="fas fa-times-circle" /> Will be deleted</span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="small"
                                            onClick={() => setDeleteFiles(prev => ({ ...prev, [fileType]: false }))}
                                        >
                                            Undo
                                        </Button>
                                    </div>
                                ) : null}
                                <input
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg"
                                    onChange={(e) => handleFileChange(e, fileType)}
                                    className="eh-file-upload__input"
                                />
                                {editFiles[fileType] && (
                                    <span className="eh-file-upload__new">
                                        <i className="fas fa-check" /> {editFiles[fileType].name}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="eh-edit-form__actions">
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary">
                        Save Changes
                    </Button>
                </div>
            </form>
        </Modal>
    )
}

export default ExpenseEditModal
