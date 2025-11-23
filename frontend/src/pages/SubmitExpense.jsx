import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './SubmitExpense.css'

function SubmitExpense({ user }) {
  const navigate = useNavigate()

  // Form data
  const [formData, setFormData] = useState({
    amount: '',
    currency: 'ILS',
    description: '',
    reason: '',
    expense_type: 'needs_approval',
    date: new Date().toISOString().split('T')[0],
    subcategory_id: '',
    supplier_id: '',
    payment_method: 'credit',
    credit_card_id: '',
    payment_due_date: 'end_of_month'
  })

  // Dropdown options
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [creditCards, setCreditCards] = useState([])

  // Files
  const [files, setFiles] = useState({
    invoice: null,
    receipt: null,
    quote: null
  })

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

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
      console.error('Failed to fetch form data:', err)
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
      console.error('Failed to fetch subcategories:', err)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleFileChange = (e) => {
    const { name, files: fileList } = e.target
    if (fileList && fileList[0]) {
      setFiles(prev => ({
        ...prev,
        [name]: fileList[0]
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Validate required fields
      if (!formData.amount || !formData.subcategory_id || !formData.date) {
        setError('Please fill in all required fields')
        setLoading(false)
        return
      }

      // Create FormData for file upload
      const submitData = new FormData()

      // Add form fields
      Object.keys(formData).forEach(key => {
        if (formData[key]) {
          submitData.append(key, formData[key])
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
        setSuccess(true)
        setTimeout(() => {
          navigate('/dashboard')
        }, 2000)
      } else {
        setError(data.error || 'Failed to submit expense')
      }
    } catch (err) {
      setError('An error occurred while submitting the expense')
      console.error('Submission error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="submit-expense-container">
        <div className="success-message card">
          <div className="success-icon">✅</div>
          <h2>Expense Submitted Successfully!</h2>
          <p>Your expense has been submitted for approval.</p>
          <p className="redirect-message">Redirecting to dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="submit-expense-container">
      <div className="submit-expense-header">
        <button className="back-button" onClick={() => navigate('/dashboard')}>
          <i className="fas fa-arrow-left"></i> Back to Dashboard
        </button>
        <h1>Submit New Expense</h1>
      </div>

      <form onSubmit={handleSubmit} className="expense-form card">
        {error && (
          <div className="error-alert">
            <i className="fas fa-exclamation-circle"></i>
            {error}
          </div>
        )}

        {/* Basic Information */}
        <div className="form-section">
          <h3>Basic Information</h3>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="amount">Amount *</label>
              <input
                type="number"
                id="amount"
                name="amount"
                step="0.01"
                value={formData.amount}
                onChange={handleInputChange}
                required
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label htmlFor="currency">Currency</label>
              <select
                id="currency"
                name="currency"
                value={formData.currency}
                onChange={handleInputChange}
              >
                <option value="ILS">ILS (₪)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="date">Date *</label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <input
              type="text"
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Brief description of the expense"
            />
          </div>

          <div className="form-group">
            <label htmlFor="reason">Reason</label>
            <textarea
              id="reason"
              name="reason"
              value={formData.reason}
              onChange={handleInputChange}
              rows="3"
              placeholder="Detailed reason for this expense"
            ></textarea>
          </div>
        </div>

        {/* Category Selection */}
        <div className="form-section">
          <h3>Category</h3>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="category">Category *</label>
              <select
                id="category"
                onChange={(e) => {
                  const catId = e.target.value
                  handleCategoryChange(catId)
                  setFormData(prev => ({ ...prev, subcategory_id: '' }))
                }}
                required
              >
                <option value="">Select a category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="subcategory_id">Subcategory *</label>
              <select
                id="subcategory_id"
                name="subcategory_id"
                value={formData.subcategory_id}
                onChange={handleInputChange}
                required
                disabled={subcategories.length === 0}
              >
                <option value="">Select a subcategory</option>
                {subcategories.map(sub => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Expense Type */}
        <div className="form-section">
          <h3>Expense Type</h3>

          <div className="form-group">
            <label htmlFor="expense_type">Type *</label>
            <select
              id="expense_type"
              name="expense_type"
              value={formData.expense_type}
              onChange={handleInputChange}
              required
            >
              <option value="needs_approval">Needs Approval</option>
              <option value="future_approval">Future Approval</option>
              <option value="auto_approved">Auto Approved</option>
            </select>
          </div>
        </div>

        {/* Payment Information */}
        <div className="form-section">
          <h3>Payment Information</h3>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="supplier_id">Supplier</label>
              <select
                id="supplier_id"
                name="supplier_id"
                value={formData.supplier_id}
                onChange={handleInputChange}
              >
                <option value="">Select a supplier</option>
                {suppliers.map(sup => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="payment_method">Payment Method</label>
              <select
                id="payment_method"
                name="payment_method"
                value={formData.payment_method}
                onChange={handleInputChange}
              >
                <option value="credit">Credit Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
              </select>
            </div>
          </div>

          {formData.payment_method === 'credit' && (
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="credit_card_id">Credit Card</label>
                <select
                  id="credit_card_id"
                  name="credit_card_id"
                  value={formData.credit_card_id}
                  onChange={handleInputChange}
                >
                  <option value="">Select a credit card</option>
                  {creditCards.map(card => (
                    <option key={card.id} value={card.id}>
                      **** {card.last_four_digits} - {card.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="payment_due_date">Payment Due</label>
                <select
                  id="payment_due_date"
                  name="payment_due_date"
                  value={formData.payment_due_date}
                  onChange={handleInputChange}
                >
                  <option value="end_of_month">End of Month</option>
                  <option value="start_of_month">Start of Month</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* File Uploads */}
        <div className="form-section">
          <h3>Attachments</h3>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="invoice">Invoice</label>
              <input
                type="file"
                id="invoice"
                name="invoice"
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png"
              />
              {files.invoice && (
                <div className="file-preview">
                  <i className="fas fa-file"></i> {files.invoice.name}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="receipt">Receipt</label>
              <input
                type="file"
                id="receipt"
                name="receipt"
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png"
              />
              {files.receipt && (
                <div className="file-preview">
                  <i className="fas fa-file"></i> {files.receipt.name}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="quote">Quote</label>
              <input
                type="file"
                id="quote"
                name="quote"
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png"
              />
              {files.quote && (
                <div className="file-preview">
                  <i className="fas fa-file"></i> {files.quote.name}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/dashboard')}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="spinner-small"></div>
                Submitting...
              </>
            ) : (
              'Submit Expense'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default SubmitExpense
