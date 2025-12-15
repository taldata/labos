import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import { Card, Button, Input, Select, SearchableSelect, Textarea, FileUpload, useToast, Skeleton } from '../components/ui'
import './SubmitExpense.css'

function EditExpense({ user, setUser }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const { success: showSuccess, error: showError } = useToast()

  // Form data
  const [formData, setFormData] = useState({
    amount: '',
    currency: 'ILS',
    description: '',
    reason: '',
    status: 'pending',
    payment_status: '',
    date: '',
    category_id: '',
    subcategory_id: '',
    supplier_id: '',
    payment_method: 'credit',
    credit_card_id: '',
    payment_due_date: 'end_of_month'
  })

  // Original expense data
  const [expense, setExpense] = useState(null)

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

  // Files to delete
  const [deleteFiles, setDeleteFiles] = useState({
    invoice: false,
    receipt: false,
    quote: false
  })

  // UI state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/dashboard')
      return
    }
    fetchExpenseAndFormData()
  }, [id])

  const fetchExpenseAndFormData = async () => {
    try {
      setLoading(true)

      // Fetch expense details
      const expenseRes = await fetch(`/api/v1/expenses/${id}`, {
        credentials: 'include'
      })

      if (!expenseRes.ok) {
        showError('Failed to load expense')
        navigate('/admin/expense-history')
        return
      }

      const expenseData = await expenseRes.json()
      setExpense(expenseData)

      // Set form data from expense
      setFormData({
        amount: expenseData.amount || '',
        currency: expenseData.currency || 'ILS',
        description: expenseData.description || '',
        reason: expenseData.reason || '',
        status: expenseData.status || 'pending',
        payment_status: expenseData.payment_status || '',
        date: expenseData.date ? expenseData.date.split('T')[0] : '',
        category_id: expenseData.subcategory?.category_id || '',
        subcategory_id: expenseData.subcategory_id || '',
        supplier_id: expenseData.supplier_id || '',
        payment_method: expenseData.payment_method || 'credit',
        credit_card_id: expenseData.credit_card_id || '',
        payment_due_date: expenseData.payment_due_date || 'end_of_month'
      })

      // Fetch dropdown data
      const [catRes, supRes, cardRes] = await Promise.all([
        fetch('/api/v1/form-data/categories', { credentials: 'include' }),
        fetch('/api/v1/form-data/suppliers', { credentials: 'include' }),
        fetch('/api/v1/form-data/credit-cards', { credentials: 'include' })
      ])

      if (catRes.ok) {
        const data = await catRes.json()
        setCategories(data.categories)

        // If expense has a category, fetch its subcategories
        if (expenseData.subcategory?.category_id) {
          const subRes = await fetch(`/api/v1/form-data/subcategories?category_id=${expenseData.subcategory.category_id}`, {
            credentials: 'include'
          })
          if (subRes.ok) {
            const subData = await subRes.json()
            setSubcategories(subData.subcategories)
          }
        }
      }

      if (supRes.ok) {
        const data = await supRes.json()
        setSuppliers(data.suppliers)
      }

      if (cardRes.ok) {
        const data = await cardRes.json()
        setCreditCards(data.credit_cards)
      }
    } catch (err) {
      console.error('Failed to fetch data:', err)
      showError('Failed to load expense data')
    } finally {
      setLoading(false)
    }
  }

  const handleCategoryChange = async (categoryId) => {
    setFormData(prev => ({ ...prev, category_id: categoryId, subcategory_id: '' }))

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
      // Clear delete flag if new file is selected
      setDeleteFiles(prev => ({
        ...prev,
        [name]: false
      }))
    }
  }

  const handleDeleteFile = (fileType) => {
    setDeleteFiles(prev => ({
      ...prev,
      [fileType]: true
    }))
    setFiles(prev => ({
      ...prev,
      [fileType]: null
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      // Validate required fields
      if (!formData.amount || !formData.subcategory_id || !formData.date) {
        showError('Please fill in all required fields')
        setSaving(false)
        return
      }

      // Create FormData for file upload
      const submitData = new FormData()

      // Add form fields
      Object.keys(formData).forEach(key => {
        if (formData[key] !== '' && formData[key] !== null) {
          submitData.append(key, formData[key])
        }
      })

      // Add files
      if (files.invoice) submitData.append('invoice', files.invoice)
      if (files.receipt) submitData.append('receipt', files.receipt)
      if (files.quote) submitData.append('quote', files.quote)

      // Add delete flags
      if (deleteFiles.invoice) submitData.append('delete_invoice', 'true')
      if (deleteFiles.receipt) submitData.append('delete_receipt', 'true')
      if (deleteFiles.quote) submitData.append('delete_quote', 'true')

      const response = await fetch(`/api/v1/admin/expenses/${id}`, {
        method: 'PUT',
        credentials: 'include',
        body: submitData
      })

      const data = await response.json()

      if (response.ok) {
        showSuccess('Expense updated successfully!')
        setTimeout(() => {
          navigate('/admin/expense-history')
        }, 1500)
      } else {
        showError(data.error || 'Failed to update expense')
      }
    } catch (err) {
      showError('An error occurred while updating the expense')
      console.error('Update error:', err)
    } finally {
      setSaving(false)
    }
  }

  if (!user?.is_admin) return null

  if (loading) {
    return (
      <div className="submit-expense-container">
        <Header user={user} setUser={setUser} />
        <div className="submit-expense-content">
          <div className="page-title-section">
            <Skeleton height="40px" width="200px" />
          </div>
          <Card className="form-section">
            <Card.Body>
              <Skeleton height="200px" />
            </Card.Body>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="submit-expense-container">
      <Header user={user} setUser={setUser} currentPage="admin" />

      <div className="submit-expense-content">
        {/* Page Title Section */}
        <div className="page-title-section">
          <div>
            <Button variant="ghost" icon="fas fa-arrow-left" onClick={() => navigate('/admin/expense-history')}>
              Back
            </Button>
            <h1>Edit Expense #{id}</h1>
            <p className="subtitle">
              Submitted by {expense?.user?.name || 'Unknown'} on {expense?.date ? new Date(expense.date).toLocaleDateString() : '-'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="expense-form">
          {/* Status Section */}
          <Card className="form-section">
            <Card.Header>
              <i className="fas fa-flag"></i> Status
            </Card.Header>
            <Card.Body>
              <div className="form-row">
                <Select
                  label="Approval Status"
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </Select>

                <Select
                  label="Payment Status"
                  name="payment_status"
                  value={formData.payment_status}
                  onChange={handleInputChange}
                >
                  <option value="">Not Set</option>
                  <option value="pending_attention">Pending Attention</option>
                  <option value="pending_payment">Pending Payment</option>
                  <option value="paid">Paid</option>
                </Select>
              </div>
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
                  value={formData.category_id}
                  onChange={(e) => handleCategoryChange(e.target.value)}
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
            </Card.Body>
          </Card>

          {/* Payment Information */}
          <Card className="form-section">
            <Card.Header>
              <i className="fas fa-credit-card"></i> Payment Information
            </Card.Header>
            <Card.Body>
              <div className="form-row">
                <SearchableSelect
                  label="Supplier"
                  name="supplier_id"
                  value={formData.supplier_id}
                  onChange={handleInputChange}
                  options={suppliers}
                  placeholder="Select a supplier"
                  searchPlaceholder="Search suppliers..."
                  displayKey="name"
                  valueKey="id"
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
              {/* Existing Files */}
              {(expense?.invoice_filename || expense?.receipt_filename || expense?.quote_filename) && (
                <div className="existing-files">
                  <h4>Current Files</h4>
                  <div className="existing-files-list">
                    {expense?.invoice_filename && !deleteFiles.invoice && (
                      <div className="existing-file-item">
                        <i className="fas fa-file-invoice"></i>
                        <span>Invoice: {expense.invoice_filename}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="small"
                          icon="fas fa-eye"
                          onClick={() => window.open(`/download/${expense.invoice_filename}`, '_blank')}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="small"
                          icon="fas fa-trash"
                          onClick={() => handleDeleteFile('invoice')}
                          className="btn-delete"
                        />
                      </div>
                    )}
                    {expense?.receipt_filename && !deleteFiles.receipt && (
                      <div className="existing-file-item">
                        <i className="fas fa-receipt"></i>
                        <span>Receipt: {expense.receipt_filename}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="small"
                          icon="fas fa-eye"
                          onClick={() => window.open(`/download/${expense.receipt_filename}`, '_blank')}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="small"
                          icon="fas fa-trash"
                          onClick={() => handleDeleteFile('receipt')}
                          className="btn-delete"
                        />
                      </div>
                    )}
                    {expense?.quote_filename && !deleteFiles.quote && (
                      <div className="existing-file-item">
                        <i className="fas fa-file-alt"></i>
                        <span>Quote: {expense.quote_filename}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="small"
                          icon="fas fa-eye"
                          onClick={() => window.open(`/download/${expense.quote_filename}`, '_blank')}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="small"
                          icon="fas fa-trash"
                          onClick={() => handleDeleteFile('quote')}
                          className="btn-delete"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <h4>Upload New Files</h4>
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
              onClick={() => navigate('/admin/expense-history')}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditExpense
