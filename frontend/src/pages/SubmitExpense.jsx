import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Input, Select, SearchableSelect, TomSelectInput, Textarea, FileUpload, useToast, PageHeader, Modal } from '../components/ui'
import logger from '../utils/logger'
import './SubmitExpense.css'

// Static option for creating new supplier - defined outside component to prevent re-renders
const CREATE_NEW_SUPPLIER_OPTION = { id: '__create_new__', name: 'Create New Supplier' }

// Helper functions for DD/MM/YYYY date format
const formatDateForDisplay = (isoDate) => {
  if (!isoDate) return ''
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

const formatDateForApi = (displayDate) => {
  if (!displayDate) return ''
  const parts = displayDate.split('/')
  if (parts.length !== 3) return ''
  const [day, month, year] = parts
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

const isValidDate = (displayDate) => {
  if (!displayDate) return false
  const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  const match = displayDate.match(regex)
  if (!match) return false

  const day = parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  const year = parseInt(match[3], 10)

  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false

  // Check for valid day in month
  const daysInMonth = new Date(year, month, 0).getDate()
  if (day > daysInMonth) return false

  return true
}

const applyDateMask = (value) => {
  // Remove non-digits
  const digits = value.replace(/\D/g, '')

  // Apply mask DD/MM/YYYY
  let masked = ''
  for (let i = 0; i < digits.length && i < 8; i++) {
    if (i === 2 || i === 4) masked += '/'
    masked += digits[i]
  }
  return masked
}

function SubmitExpense({ user, setUser }) {
  const navigate = useNavigate()
  const { success: showSuccess, error: showError } = useToast()

  // Get today's date in DD/MM/YYYY format
  const today = new Date()
  const todayFormatted = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`

  // Budget year state - default to current year
  const currentYear = today.getFullYear()
  const [budgetYear, setBudgetYear] = useState(currentYear)
  const [showYearWarningModal, setShowYearWarningModal] = useState(false)
  const [pendingYearChange, setPendingYearChange] = useState(null)

  // Form data - date stored in DD/MM/YYYY display format
  const [formData, setFormData] = useState({
    amount: '',
    currency: 'ILS',
    description: '',
    reason: '',
    expense_type: 'auto_approved',
    date: todayFormatted,
    subcategory_id: '',
    supplier_id: '',
    payment_method: 'credit',
    credit_card_id: '',
    payment_due_date: 'end_of_month',
    budget_year: currentYear
  })

  // Date validation error
  const [dateError, setDateError] = useState('')

  // Dropdown options
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [creditCards, setCreditCards] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('')

  // Files
  const [files, setFiles] = useState({
    invoice: null,
    receipt: null,
    quote: null
  })

  // OCR state
  const [ocrProcessing, setOcrProcessing] = useState(false)
  const [ocrData, setOcrData] = useState(null)
  const [ocrDataLoading, setOcrDataLoading] = useState(false)
  const [showOcrSuccess, setShowOcrSuccess] = useState(false)

  // ILS preview state
  const [ilsPreview, setIlsPreview] = useState(null)
  const [ilsPreviewLoading, setIlsPreviewLoading] = useState(false)

  // UI state
  const [loading, setLoading] = useState(false)
  const isSubmitting = useRef(false)

  // New supplier modal state
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false)
  const [newSupplierLoading, setNewSupplierLoading] = useState(false)
  const [newSupplierData, setNewSupplierData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    tax_id: '',
    bank_name: '',
    bank_account_number: '',
    bank_branch: '',
    bank_swift: '',
    iban: '',
    notes: ''
  })

  useEffect(() => {
    fetchFormData()
  }, [])

  // Re-fetch categories when budget year changes
  useEffect(() => {
    fetchCategories()
  }, [budgetYear])

  // Fetch ILS preview when currency, amount, or date change (for non-ILS currencies)
  useEffect(() => {
    if (formData.currency === 'ILS' || !formData.amount || !formData.date || !isValidDate(formData.date)) {
      setIlsPreview(null)
      return
    }

    const fetchPreview = async () => {
      setIlsPreviewLoading(true)
      try {
        const isoDate = formatDateForApi(formData.date)
        const res = await fetch(
          `/api/v1/exchange-rate?currency=${formData.currency}&date=${isoDate}&amount=${formData.amount}`,
          { credentials: 'include' }
        )
        if (res.ok) {
          const data = await res.json()
          setIlsPreview(data)
        }
      } catch (err) {
        logger.error('Failed to fetch exchange rate preview', { error: err.message })
      } finally {
        setIlsPreviewLoading(false)
      }
    }

    const timer = setTimeout(fetchPreview, 500)
    return () => clearTimeout(timer)
  }, [formData.currency, formData.amount, formData.date])

  const fetchCategories = async () => {
    try {
      // Fetch categories with budget year filter
      const catRes = await fetch(`/api/v1/form-data/categories?budget_year=${budgetYear}`, {
        credentials: 'include'
      })
      if (catRes.ok) {
        const data = await catRes.json()
        setCategories(data.categories)
        // Clear subcategory selection when budget year changes
        setSubcategories([])
        setSelectedCategory('')
        setFormData(prev => ({ ...prev, subcategory_id: '' }))
      }
    } catch (err) {
      logger.error('Failed to fetch categories', { error: err.message })
    }
  }

  const fetchFormData = async () => {
    try {
      // Fetch categories with budget year filter
      await fetchCategories()

      // Fetch suppliers
      const supRes = await fetch('/api/v1/form-data/suppliers', {
        credentials: 'include'
      })
      if (supRes.ok) {
        const data = await supRes.json()
        setSuppliers(data.suppliers)
      }

      // Fetch credit cards
      const cardRes = await fetch('/api/v1/form-data/credit-cards', {
        credentials: 'include'
      })
      if (cardRes.ok) {
        const data = await cardRes.json()
        setCreditCards(data.credit_cards)
      }
    } catch (err) {
      logger.error('Failed to fetch form data', { error: err.message })
    }
  }

  // Handle budget year change with warning
  const handleBudgetYearChange = (e) => {
    const newYear = parseInt(e.target.value)
    if (newYear !== budgetYear) {
      setPendingYearChange(newYear)
      setShowYearWarningModal(true)
    }
  }

  // Confirm budget year change
  const confirmBudgetYearChange = () => {
    if (pendingYearChange !== null) {
      setBudgetYear(pendingYearChange)
      setFormData(prev => ({ ...prev, budget_year: pendingYearChange }))
      setPendingYearChange(null)
      setShowYearWarningModal(false)
    }
  }

  // Cancel budget year change
  const cancelBudgetYearChange = () => {
    setPendingYearChange(null)
    setShowYearWarningModal(false)
  }

  const handleCategoryChange = async (categoryId) => {
    if (!categoryId) {
      setSubcategories([])
      return
    }

    try {
      const res = await fetch(`/api/v1/form-data/subcategories?category_id=${categoryId}`, {
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        setSubcategories(data.subcategories)
      }
    } catch (err) {
      logger.error('Failed to fetch subcategories', { categoryId, error: err.message })
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleDateChange = (e) => {
    const rawValue = e.target.value
    const maskedValue = applyDateMask(rawValue)

    setFormData(prev => ({
      ...prev,
      date: maskedValue
    }))

    // Validate and show error if incomplete or invalid
    if (maskedValue.length === 10) {
      if (!isValidDate(maskedValue)) {
        setDateError('תאריך לא תקין')
      } else {
        setDateError('')
      }
    } else if (maskedValue.length > 0) {
      setDateError('')
    }
  }

  const handleFileChange = async (name, fileList) => {
    if (fileList && fileList.length > 0) {
      const file = fileList[0]
      setFiles(prev => ({
        ...prev,
        [name]: file
      }))

      // Define OCR endpoints for each document type
      const ocrEndpoints = {
        invoice: '/api/expense/process-expense',
        receipt: '/api/expense/process-receipt',
        quote: '/api/expense/process-quote'
      }

      // Define Hebrew labels for each document type
      const documentLabels = {
        invoice: 'invoice',
        receipt: 'receipt',
        quote: 'quote'
      }

      // Process document through OCR to extract amount (for invoice, receipt, and quote)
      if (ocrEndpoints[name]) {
        setOcrProcessing(true)
        setOcrData(null)
        setShowOcrSuccess(false)
        try {
          const formData = new FormData()
          formData.append('document', file)

          const response = await fetch(ocrEndpoints[name], {
            method: 'POST',
            credentials: 'include',
            body: formData
          })

          if (response.ok) {
            const data = await response.json()
            // Extract the actual OCR data from the response - data is inside extracted_data
            const ocrResult = data.extracted_data || data
            setOcrData(ocrResult)

            // Show loading state while data is being applied
            setOcrDataLoading(true)

            // Small delay to show loading animation before populating form
            await new Promise(resolve => setTimeout(resolve, 800))

            // Auto-fill the form with extracted data
            if (ocrResult.amount) {
              setFormData(prev => ({
                ...prev,
                amount: ocrResult.amount
              }))
            }
            if (ocrResult.currency && ['ILS', 'USD', 'EUR'].includes(ocrResult.currency)) {
              setFormData(prev => ({
                ...prev,
                currency: ocrResult.currency
              }))
            }
            if (ocrResult.purchase_date) {
              // Convert ISO date to DD/MM/YYYY format for display
              const formattedDate = formatDateForDisplay(ocrResult.purchase_date)
              setFormData(prev => ({
                ...prev,
                date: formattedDate
              }))
              setDateError('')
            }

            // Hide loading state after data is applied
            setOcrDataLoading(false)

            if (ocrResult.amount || ocrResult.purchase_date) {
              showSuccess(`Data extracted from ${documentLabels[name]} successfully`)
              // Show the success banner and auto-hide after 5 seconds
              setShowOcrSuccess(true)
              setTimeout(() => {
                setShowOcrSuccess(false)
              }, 5000)
            } else {
              showSuccess(`The ${documentLabels[name]} was processed, but no data was found to extract`)
            }
          } else {
            const errorData = await response.json()
            logger.error('OCR processing failed', { error: errorData })
          }
        } catch (error) {
          logger.error(`Error processing ${name}`, { error: error.message })
        } finally {
          setOcrProcessing(false)
        }
      }
    } else {
      // Clear OCR data and states when file is removed
      setOcrData(null)
      setOcrProcessing(false)
      setOcrDataLoading(false)
      setShowOcrSuccess(false)
      setFiles(prev => ({
        ...prev,
        [name]: null
      }))
      // Clear the form fields that were populated by OCR
      setFormData(prev => ({
        ...prev,
        amount: '',
        date: todayFormatted
      }))
      setDateError('')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting.current) return
    isSubmitting.current = true
    setLoading(true)

    try {
      // Validate required fields
      if (!formData.amount || !formData.subcategory_id || !formData.date || !formData.description || !formData.supplier_id) {
        showError('Please fill in all required fields (Amount, Date, Description, Category, Subcategory, Supplier)')
        setLoading(false)
        return
      }

      // Validate credit card selection when payment method is credit
      if (formData.payment_method === 'credit' && !formData.credit_card_id) {
        showError('יש לבחור כרטיס אשראי')
        setLoading(false)
        return
      }

      // Validate date format
      if (!isValidDate(formData.date)) {
        showError('תאריך לא תקין (DD/MM/YYYY)')
        setDateError('תאריך לא תקין')
        setLoading(false)
        return
      }

      // Create FormData for file upload
      const submitData = new FormData()

      // Add form fields - convert date to ISO format for API
      Object.keys(formData).forEach(key => {
        if (formData[key]) {
          if (key === 'date') {
            // Convert DD/MM/YYYY to YYYY-MM-DD for API
            submitData.append(key, formatDateForApi(formData[key]))
          } else {
            submitData.append(key, formData[key])
          }
        }
      })

      // Add files
      if (files.invoice) submitData.append('invoice', files.invoice)
      if (files.receipt) submitData.append('receipt', files.receipt)
      if (files.quote) submitData.append('quote', files.quote)

      const response = await fetch('/api/v1/expenses/submit', {
        method: 'POST',
        credentials: 'include',
        body: submitData
      })

      const data = await response.json()

      if (response.ok) {
        showSuccess('Expense submitted successfully!')
        setTimeout(() => {
          navigate('/my-expenses', { state: { newExpenseId: data.expense_id } })
        }, 1500)
      } else {
        showError(data.error || 'Failed to submit expense')
      }
    } catch (err) {
      showError('An error occurred while submitting the expense')
      logger.error('Submission error', { error: err.message })
    } finally {
      isSubmitting.current = false
      setLoading(false)
    }
  }

  // Handle supplier selection - check for "create new" option
  const handleSupplierChange = (e) => {
    const value = e.target.value
    if (value === '__create_new__') {
      // Open the new supplier modal
      setShowNewSupplierModal(true)
      // Reset the form data
      setNewSupplierData({
        name: '',
        email: '',
        phone: '',
        address: '',
        tax_id: '',
        bank_name: '',
        bank_account_number: '',
        bank_branch: '',
        bank_swift: '',
        iban: '',
        notes: ''
      })
    } else {
      // Normal selection
      handleInputChange(e)
    }
  }

  // Handle new supplier form input
  const handleNewSupplierInputChange = (e) => {
    const { name, value } = e.target
    setNewSupplierData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Submit new supplier
  const handleCreateSupplier = async (e) => {
    e.preventDefault()
    
    if (!newSupplierData.name.trim()) {
      showError('Supplier name is required')
      return
    }

    setNewSupplierLoading(true)
    try {
      const response = await fetch('/api/v1/form-data/suppliers', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSupplierData)
      })

      const data = await response.json()

      if (response.ok) {
        showSuccess('Supplier created successfully!')
        
        // Add the new supplier to the list
        const newSupplier = data.supplier
        setSuppliers(prev => [...prev, newSupplier].sort((a, b) => a.name.localeCompare(b.name)))
        
        // Select the new supplier
        setFormData(prev => ({
          ...prev,
          supplier_id: newSupplier.id.toString()
        }))
        
        // Close the modal
        setShowNewSupplierModal(false)
      } else {
        showError(data.error || 'Failed to create supplier')
      }
    } catch (err) {
      showError('An error occurred while creating the supplier')
      logger.error('Create supplier error', { error: err.message })
    } finally {
      setNewSupplierLoading(false)
    }
  }

  return (
    <div className="submit-expense-container">

      <div className="submit-expense-content">
        {/* Page Header */}
        <PageHeader
          title="Submit New Expense"
          subtitle="Fill in the details to submit an expense for approval"
          icon="fas fa-plus-circle"
          variant="purple"
          actions={
            <Button variant="ghost" icon="fas fa-arrow-left" onClick={() => navigate('/dashboard')} style={{ color: 'white' }}>
              Back
            </Button>
          }
        />

        <form onSubmit={handleSubmit} className="expense-form">
          {/* File Uploads - First Section */}
          <Card className="form-section">
            <Card.Header>
              <i className="fas fa-paperclip"></i> Upload Invoice
            </Card.Header>
            <Card.Body>
              <p className="section-hint" style={{ marginBottom: '1rem', color: '#666', fontSize: '0.9rem' }}>
                Upload an invoice and the system will automatically extract the total amount including VAT
              </p>
              <div className="form-row file-upload-row">
                <FileUpload
                  label="Invoice"
                  name="invoice"
                  onChange={(files) => handleFileChange('invoice', files)}
                  accept=".pdf,.jpg,.jpeg,.png"
                  file={files.invoice}
                />

                <FileUpload
                  label="Receipt"
                  name="receipt"
                  onChange={(files) => handleFileChange('receipt', files)}
                  accept=".pdf,.jpg,.jpeg,.png"
                  file={files.receipt}
                />

                <FileUpload
                  label="Quote"
                  name="quote"
                  onChange={(files) => handleFileChange('quote', files)}
                  accept=".pdf,.jpg,.jpeg,.png"
                  file={files.quote}
                />
              </div>
              {ocrProcessing && (
                <div className="ocr-processing" style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f0f7ff', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <i className="fas fa-spinner fa-spin"></i>
                  <span>Processing document and extracting data...</span>
                </div>
              )}
              {ocrDataLoading && !ocrProcessing && (
                <div className="ocr-loading" style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fff3e0', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <i className="fas fa-sync fa-spin" style={{ color: '#ff9800' }}></i>
                  <span style={{ color: '#e65100' }}>Loading data into form...</span>
                </div>
              )}
              {showOcrSuccess && ocrData && !ocrProcessing && !ocrDataLoading && (
                <div className="ocr-result" style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#e8f5e9', borderRadius: '8px' }}>
                  <i className="fas fa-check-circle" style={{ color: '#4caf50', marginRight: '0.5rem' }}></i>
                  <span>Data extracted successfully: Amount {ocrData.amount} ₪</span>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Basic Information */}
          <Card className="form-section">
            <Card.Header>
              <i className="fas fa-info-circle"></i> Basic Information
            </Card.Header>
            <Card.Body>
              <div className="form-row">
                <Input
                  type="number"
                  label="Amount"
                  name="amount"
                  step="0.01"
                  value={formData.amount}
                  onChange={handleInputChange}
                  required
                  placeholder="0.00"
                />

                <Select
                  label="Currency"
                  name="currency"
                  value={formData.currency}
                  onChange={handleInputChange}
                >
                  <option value="ILS">ILS (₪)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </Select>

                {formData.currency !== 'ILS' && ilsPreview && (
                  <div className="ils-preview" style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.5rem 0.75rem', backgroundColor: '#f0f7ff', borderRadius: '6px',
                    fontSize: '0.85rem', color: '#1565c0', alignSelf: 'flex-end', marginBottom: '0.25rem'
                  }}>
                    <i className="fas fa-exchange-alt"></i>
                    <span>
                      {ilsPreviewLoading ? 'Loading...' : `≈ ₪${ilsPreview.amount_ils?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      {ilsPreview.rate && <span style={{ opacity: 0.7, marginLeft: '0.5rem' }}>(rate: {ilsPreview.rate})</span>}
                    </span>
                  </div>
                )}

                <div className="date-input-wrapper">
                  <Input
                    type="text"
                    label="Document Date"
                    name="date"
                    value={formData.date}
                    onChange={handleDateChange}
                    required
                    placeholder="DD/MM/YYYY"
                    maxLength={10}
                    className={dateError ? 'input-error' : ''}
                    helperText="תאריך החשבונית/קבלה (לא תאריך ההגשה)"
                  />
                  {dateError && <span className="date-error-text">{dateError}</span>}
                </div>
              </div>

              <Input
                type="text"
                label="Description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Brief description of the expense"
                required
              />

              <Textarea
                label="Reason"
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                rows={3}
                placeholder="Detailed reason for this expense"
              />
            </Card.Body>
          </Card>

          {/* Category Selection */}
          <Card className="form-section">
            <Card.Header>
              <i className="fas fa-tags"></i> Category
            </Card.Header>
            <Card.Body>
              {/* Budget Year Selection */}
              <div className="form-row budget-year-row">
                <Select
                  label="Budget Year"
                  name="budget_year"
                  value={budgetYear}
                  onChange={handleBudgetYearChange}
                >
                  {/* Show current year and previous 2 years */}
                  {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </Select>
                <div className="budget-year-hint">
                  <i className="fas fa-info-circle"></i>
                  <span>בחר את שנת התקציב שאליה שייכת ההוצאה. ברירת המחדל היא השנה הנוכחית.</span>
                </div>
              </div>

              <div className="form-row">
                <TomSelectInput
                  label="Category"
                  name="category_id"
                  value={selectedCategory}
                  options={categories}
                  displayKey="name"
                  valueKey="id"
                  placeholder="Select a category"
                  required
                  onChange={(e) => {
                    const catId = e.target.value
                    setSelectedCategory(catId)
                    handleCategoryChange(catId)
                    setFormData(prev => ({ ...prev, subcategory_id: '' }))
                  }}
                />

                <TomSelectInput
                  label="Subcategory"
                  name="subcategory_id"
                  value={formData.subcategory_id}
                  onChange={handleInputChange}
                  options={subcategories}
                  displayKey="name"
                  valueKey="id"
                  placeholder={selectedCategory ? "Select a subcategory" : "Select a category first"}
                  required
                  allowClear={false}
                  disabled={!selectedCategory}
                />
              </div>

{/* Expense Type dropdown hidden - all expenses are auto-approved */}
            </Card.Body>
          </Card>

          {/* Payment Information */}
          <Card className="form-section">
            <Card.Header>
              <i className="fas fa-credit-card"></i> Payment Information
            </Card.Header>
            <Card.Body>
              <div className="form-row">
                <TomSelectInput
                  label="Supplier"
                  name="supplier_id"
                  value={formData.supplier_id}
                  onChange={handleSupplierChange}
                  options={suppliers}
                  placeholder="Select a supplier"
                  displayKey="name"
                  valueKey="id"
                  required
                  createNewOption={CREATE_NEW_SUPPLIER_OPTION}
                />

                <Select
                  label="Payment Method"
                  name="payment_method"
                  value={formData.payment_method}
                  onChange={handleInputChange}
                >
                  <option value="credit">Credit Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="standing_order">Standing Order</option>
                  <option value="check">Check</option>
                </Select>
              </div>

              {formData.payment_method === 'credit' && (
                <div className="form-row">
                  <Select
                    label="Credit Card"
                    name="credit_card_id"
                    value={formData.credit_card_id}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select a credit card</option>
                    {creditCards.map(card => (
                      <option key={card.id} value={card.id}>
                        **** {card.last_four_digits} - {card.description}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {formData.payment_method === 'bank_transfer' && (
                <div className="form-row">
                  <Select
                    label="Payment Due"
                    name="payment_due_date"
                    value={formData.payment_due_date}
                    onChange={handleInputChange}
                  >
                    <option value="end_of_month">End of Month</option>
                    <option value="start_of_month">Start of Month</option>
                  </Select>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Submit Buttons */}
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/dashboard')}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
            >
              Submit Expense
            </Button>
          </div>
        </form>
      </div>

      {/* New Supplier Modal */}
      <Modal.Form
        isOpen={showNewSupplierModal}
        onClose={() => setShowNewSupplierModal(false)}
        onSubmit={handleCreateSupplier}
        title="Create New Supplier"
        submitText="Create Supplier"
        cancelText="Cancel"
        loading={newSupplierLoading}
        size="large"
      >
        <div className="new-supplier-form">
          <h4><i className="fas fa-info-circle"></i> Basic Information</h4>
          <Input
            type="text"
            label="Supplier Name"
            name="name"
            value={newSupplierData.name}
            onChange={handleNewSupplierInputChange}
            required
            placeholder="Enter supplier name"
          />

          <div className="form-row">
            <Input
              type="email"
              label="Email"
              name="email"
              value={newSupplierData.email}
              onChange={handleNewSupplierInputChange}
              placeholder="supplier@example.com"
            />

            <Input
              type="tel"
              label="Phone"
              name="phone"
              value={newSupplierData.phone}
              onChange={handleNewSupplierInputChange}
              placeholder="Phone number"
            />
          </div>

          <Input
            type="text"
            label="Address"
            name="address"
            value={newSupplierData.address}
            onChange={handleNewSupplierInputChange}
            placeholder="Supplier address"
          />

          <Input
            type="text"
            label="Tax ID / Business Number"
            name="tax_id"
            value={newSupplierData.tax_id}
            onChange={handleNewSupplierInputChange}
            placeholder="Tax ID or business number"
          />

          <h4><i className="fas fa-university"></i> Bank Details</h4>
          <div className="form-row">
            <Input
              type="text"
              label="Bank Name"
              name="bank_name"
              value={newSupplierData.bank_name}
              onChange={handleNewSupplierInputChange}
              placeholder="Bank name"
            />

            <Input
              type="text"
              label="Branch"
              name="bank_branch"
              value={newSupplierData.bank_branch}
              onChange={handleNewSupplierInputChange}
              placeholder="Branch number"
            />
          </div>

          <div className="form-row">
            <Input
              type="text"
              label="Account Number"
              name="bank_account_number"
              value={newSupplierData.bank_account_number}
              onChange={handleNewSupplierInputChange}
              placeholder="Account number"
            />

            <Input
              type="text"
              label="SWIFT Code"
              name="bank_swift"
              value={newSupplierData.bank_swift}
              onChange={handleNewSupplierInputChange}
              placeholder="SWIFT/BIC code"
            />
          </div>

          <Input
            type="text"
            label="IBAN"
            name="iban"
            value={newSupplierData.iban}
            onChange={handleNewSupplierInputChange}
            placeholder="International Bank Account Number"
            maxLength={34}
          />

          <h4><i className="fas fa-sticky-note"></i> Additional Information</h4>
          <Textarea
            label="Notes"
            name="notes"
            value={newSupplierData.notes}
            onChange={handleNewSupplierInputChange}
            rows={2}
            placeholder="Additional notes..."
          />
        </div>
      </Modal.Form>

      {/* Budget Year Change Warning Modal */}
      <Modal
        isOpen={showYearWarningModal}
        onClose={cancelBudgetYearChange}
        title="שינוי שנת תקציב"
        size="small"
      >
        <div className="year-warning-modal">
          <div className="year-warning-icon">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <p className="year-warning-text">
            האם אתה בטוח שברצונך לשנות את שנת התקציב מ-<strong>{budgetYear}</strong> ל-<strong>{pendingYearChange}</strong>?
          </p>
          <p className="year-warning-subtext">
            שינוי שנת התקציב יאפס את בחירת הקטגוריה ותת-הקטגוריה, והרשימות יעודכנו בהתאם לשנה החדשה.
          </p>
          <div className="year-warning-actions">
            <Button variant="secondary" onClick={cancelBudgetYearChange}>
              ביטול
            </Button>
            <Button variant="primary" onClick={confirmBudgetYearChange}>
              אישור שינוי
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default SubmitExpense
