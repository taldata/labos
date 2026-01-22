import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Input, Select, SearchableSelect, TomSelectInput, Textarea, FileUpload, useToast, PageHeader, Modal } from '../components/ui'
import logger from '../utils/logger'
import './SubmitExpense.css'

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
    payment_due_date: 'end_of_month'
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

  // UI state
  const [loading, setLoading] = useState(false)

  // New supplier modal state
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false)
  const [newSupplierLoading, setNewSupplierLoading] = useState(false)
  const [newSupplierData, setNewSupplierData] = useState({
    name: '',
    email: '',
    phone: '',
    tax_id: '',
    address: ''
  })

  useEffect(() => {
    fetchFormData()
  }, [])

  const fetchFormData = async () => {
    try {
      // Fetch categories
      const catRes = await fetch('/api/v1/form-data/categories', {
        credentials: 'include'
      })
      if (catRes.ok) {
        const data = await catRes.json()
        setCategories(data.categories)
      }

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
        tax_id: '',
        address: ''
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

                <div className="date-input-wrapper">
                  <Input
                    type="text"
                    label="Date"
                    name="date"
                    value={formData.date}
                    onChange={handleDateChange}
                    required
                    placeholder="DD/MM/YYYY"
                    maxLength={10}
                    className={dateError ? 'input-error' : ''}
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
                  createNewOption={{ id: '__create_new__', name: 'Create New Supplier' }}
                />

                <Select
                  label="Payment Method"
                  name="payment_method"
                  value={formData.payment_method}
                  onChange={handleInputChange}
                >
                  <option value="credit">Credit Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
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
        size="medium"
      >
        <div className="new-supplier-form">
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
            label="Tax ID / Business Number"
            name="tax_id"
            value={newSupplierData.tax_id}
            onChange={handleNewSupplierInputChange}
            placeholder="Tax ID or business number"
          />
          
          <Input
            type="text"
            label="Address"
            name="address"
            value={newSupplierData.address}
            onChange={handleNewSupplierInputChange}
            placeholder="Supplier address"
          />
        </div>
      </Modal.Form>
    </div>
  )
}

export default SubmitExpense
