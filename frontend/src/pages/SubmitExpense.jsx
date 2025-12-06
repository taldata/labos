import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { Card, Button, Input, Select, Textarea, FileUpload, useToast } from '../components/ui'
import './SubmitExpense.css'

function SubmitExpense({ user, setUser }) {
  const navigate = useNavigate()
  const { success: showSuccess, error: showError } = useToast()

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
    setLoading(true)

    try {
      // Validate required fields
      if (!formData.amount || !formData.subcategory_id || !formData.date) {
        showError('Please fill in all required fields')
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
        showSuccess('Expense submitted successfully!')
        setTimeout(() => {
          navigate('/dashboard')
        }, 1500)
      } else {
        showError(data.error || 'Failed to submit expense')
      }
    } catch (err) {
      showError('An error occurred while submitting the expense')
      console.error('Submission error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="submit-expense-container">
      <Header user={user} setUser={setUser} />

      <div className="submit-expense-content">
        {/* Page Title Section */}
        <div className="page-title-section">
          <div>
            <Button variant="ghost" icon="fas fa-arrow-left" onClick={() => navigate('/dashboard')}>
              Back
            </Button>
            <h1>Submit New Expense</h1>
            <p className="subtitle">Fill in the details to submit an expense for approval</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="expense-form">
          {/* Basic Information */}
          <Card className="form-section">
            <Card.Header>
              <i className="fas fa-info-circle"></i> Basic Information
            </Card.Header>
            <Card.Body>
              <div className="form-row">
                <Input
                  type="number"
                  label="Amount *"
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

                <Input
                  type="date"
                  label="Date *"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <Input
                type="text"
                label="Description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Brief description of the expense"
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
                <Select
                  label="Category *"
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
                </Select>

                <Select
                  label="Subcategory *"
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
                </Select>
              </div>

              <Select
                label="Expense Type *"
                name="expense_type"
                value={formData.expense_type}
                onChange={handleInputChange}
                required
              >
                <option value="needs_approval">Needs Approval</option>
                <option value="future_approval">Future Approval</option>
                <option value="auto_approved">Auto Approved</option>
              </Select>
            </Card.Body>
          </Card>

          {/* Payment Information */}
          <Card className="form-section">
            <Card.Header>
              <i className="fas fa-credit-card"></i> Payment Information
            </Card.Header>
            <Card.Body>
              <div className="form-row">
                <Select
                  label="Supplier"
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
                </Select>

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

          {/* File Uploads */}
          <Card className="form-section">
            <Card.Header>
              <i className="fas fa-paperclip"></i> Attachments
            </Card.Header>
            <Card.Body>
              <div className="form-row">
                <FileUpload
                  label="Invoice"
                  name="invoice"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                  file={files.invoice}
                />

                <FileUpload
                  label="Receipt"
                  name="receipt"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                  file={files.receipt}
                />

                <FileUpload
                  label="Quote"
                  name="quote"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                  file={files.quote}
                />
              </div>
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
    </div>
  )
}

export default SubmitExpense
