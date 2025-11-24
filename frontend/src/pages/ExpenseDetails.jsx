import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './ExpenseDetails.css'

function ExpenseDetails({ user }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const [expense, setExpense] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [modalAction, setModalAction] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchExpenseDetails()
  }, [id])

  const fetchExpenseDetails = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch(`/api/v1/expenses/${id}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setExpense(data.expense)
      } else if (response.status === 404) {
        setError('Expense not found')
      } else if (response.status === 403) {
        setError('You do not have permission to view this expense')
      } else {
        setError('Failed to load expense details')
      }
    } catch (err) {
      setError('An error occurred while fetching expense details')
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const openApprovalModal = (action) => {
    setModalAction(action)
    setRejectionReason('')
    setShowApprovalModal(true)
  }

  const closeApprovalModal = () => {
    setShowApprovalModal(false)
    setModalAction(null)
    setRejectionReason('')
  }

  const handleApprove = async () => {
    try {
      setProcessing(true)
      const response = await fetch(`/api/v1/expenses/${id}/approve`, {
        method: 'PUT',
        credentials: 'include'
      })

      if (response.ok) {
        await fetchExpenseDetails() // Refresh expense data
        closeApprovalModal()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to approve expense')
      }
    } catch (err) {
      setError('An error occurred while approving the expense')
      console.error('Approve error:', err)
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    try {
      setProcessing(true)
      const response = await fetch(`/api/v1/expenses/${id}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ reason: rejectionReason })
      })

      if (response.ok) {
        await fetchExpenseDetails() // Refresh expense data
        closeApprovalModal()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to reject expense')
      }
    } catch (err) {
      setError('An error occurred while rejecting the expense')
      console.error('Reject error:', err)
    } finally {
      setProcessing(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'ILS'
    }).format(amount)
  }

  const getStatusBadge = (status) => {
    const statusStyles = {
      pending: 'status-badge status-pending',
      approved: 'status-badge status-approved',
      rejected: 'status-badge status-rejected',
      paid: 'status-badge status-paid'
    }
    return statusStyles[status] || 'status-badge'
  }

  const canManageExpense = () => {
    return (user?.is_manager || user?.is_admin) && expense?.status === 'pending'
  }

  if (loading) {
    return (
      <div className="expense-details-container">
        <div className="loading-state card">
          <div className="spinner"></div>
          <p>Loading expense details...</p>
        </div>
      </div>
    )
  }

  if (error || !expense) {
    return (
      <div className="expense-details-container">
        <div className="error-state card">
          <i className="fas fa-exclamation-triangle"></i>
          <h2>{error || 'Expense not found'}</h2>
          <button className="btn-primary" onClick={() => navigate(-1)}>
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="expense-details-container">
      {/* Header */}
      <header className="page-header">
        <div className="header-left">
          <button className="back-button" onClick={() => navigate(-1)}>
            <i className="fas fa-arrow-left"></i>
          </button>
          <div>
            <h1>Expense Details</h1>
            <p className="subtitle">#{expense.id}</p>
          </div>
        </div>
        <div className="header-right">
          <span className={getStatusBadge(expense.status)}>
            {expense.status}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <div className="expense-details-content">
        {/* Amount Card */}
        <div className="amount-card card">
          <div className="amount-label">Total Amount</div>
          <div className="amount-value">
            {formatCurrency(expense.amount, expense.currency)}
          </div>
          <div className="amount-meta">
            <span><i className="fas fa-calendar"></i> {formatDate(expense.date)}</span>
            <span><i className="fas fa-clock"></i> Submitted {formatDate(expense.created_at)}</span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="details-grid">
          {/* Submitter Information */}
          <div className="detail-card card">
            <h3><i className="fas fa-user"></i> Submitter</h3>
            <div className="detail-content">
              <div className="detail-row">
                <span className="detail-label">Name:</span>
                <span className="detail-value">{expense.submitter.name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Email:</span>
                <span className="detail-value">{expense.submitter.email}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Username:</span>
                <span className="detail-value">{expense.submitter.username}</span>
              </div>
            </div>
          </div>

          {/* Expense Information */}
          <div className="detail-card card">
            <h3><i className="fas fa-info-circle"></i> Expense Information</h3>
            <div className="detail-content">
              <div className="detail-row">
                <span className="detail-label">Type:</span>
                <span className="detail-value">{expense.type || '-'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Category:</span>
                <span className="detail-value">
                  {expense.category?.name || '-'}
                  {expense.subcategory && ` / ${expense.subcategory.name}`}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Payment Method:</span>
                <span className="detail-value">{expense.payment_method || '-'}</span>
              </div>
              {expense.credit_card && (
                <div className="detail-row">
                  <span className="detail-label">Credit Card:</span>
                  <span className="detail-value">
                    **** {expense.credit_card.last_four_digits}
                    {expense.credit_card.description && ` (${expense.credit_card.description})`}
                  </span>
                </div>
              )}
              {expense.payment_due_date && (
                <div className="detail-row">
                  <span className="detail-label">Payment Due:</span>
                  <span className="detail-value">{expense.payment_due_date}</span>
                </div>
              )}
            </div>
          </div>

          {/* Supplier Information */}
          {expense.supplier && (
            <div className="detail-card card">
              <h3><i className="fas fa-building"></i> Supplier</h3>
              <div className="detail-content">
                <div className="detail-row">
                  <span className="detail-label">Name:</span>
                  <span className="detail-value">{expense.supplier.name}</span>
                </div>
                {expense.supplier.email && (
                  <div className="detail-row">
                    <span className="detail-label">Email:</span>
                    <span className="detail-value">{expense.supplier.email}</span>
                  </div>
                )}
                {expense.supplier.phone && (
                  <div className="detail-row">
                    <span className="detail-label">Phone:</span>
                    <span className="detail-value">{expense.supplier.phone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Budget Information */}
          {(expense.category?.budget || expense.subcategory?.budget) && (
            <div className="detail-card card">
              <h3><i className="fas fa-chart-pie"></i> Budget</h3>
              <div className="detail-content">
                {expense.category?.budget && (
                  <div className="detail-row">
                    <span className="detail-label">Category Budget:</span>
                    <span className="detail-value">
                      {formatCurrency(expense.category.budget, expense.currency)}
                    </span>
                  </div>
                )}
                {expense.subcategory?.budget && (
                  <div className="detail-row">
                    <span className="detail-label">Subcategory Budget:</span>
                    <span className="detail-value">
                      {formatCurrency(expense.subcategory.budget, expense.currency)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Description & Reason */}
        {(expense.description || expense.reason) && (
          <div className="description-card card">
            <h3><i className="fas fa-align-left"></i> Description & Reason</h3>
            <div className="description-content">
              {expense.description && (
                <div className="description-section">
                  <h4>Description</h4>
                  <p>{expense.description}</p>
                </div>
              )}
              {expense.reason && (
                <div className="description-section">
                  <h4>Business Reason</h4>
                  <p>{expense.reason}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Attachments */}
        {(expense.invoice_filename || expense.receipt_filename || expense.quote_filename) && (
          <div className="attachments-card card">
            <h3><i className="fas fa-paperclip"></i> Attachments</h3>
            <div className="attachments-grid">
              {expense.invoice_filename && (
                <div className="attachment-item">
                  <i className="fas fa-file-invoice"></i>
                  <div className="attachment-info">
                    <span className="attachment-name">Invoice</span>
                    <span className="attachment-filename">{expense.invoice_filename}</span>
                  </div>
                  <a href={`/uploads/${expense.invoice_filename}`} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                    <i className="fas fa-download"></i> View
                  </a>
                </div>
              )}
              {expense.receipt_filename && (
                <div className="attachment-item">
                  <i className="fas fa-receipt"></i>
                  <div className="attachment-info">
                    <span className="attachment-name">Receipt</span>
                    <span className="attachment-filename">{expense.receipt_filename}</span>
                  </div>
                  <a href={`/uploads/${expense.receipt_filename}`} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                    <i className="fas fa-download"></i> View
                  </a>
                </div>
              )}
              {expense.quote_filename && (
                <div className="attachment-item">
                  <i className="fas fa-file-alt"></i>
                  <div className="attachment-info">
                    <span className="attachment-name">Quote</span>
                    <span className="attachment-filename">{expense.quote_filename}</span>
                  </div>
                  <a href={`/uploads/${expense.quote_filename}`} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                    <i className="fas fa-download"></i> View
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Accounting Notes */}
        {expense.accounting_notes && (
          <div className="notes-card card">
            <h3><i className="fas fa-sticky-note"></i> Accounting Notes</h3>
            <p>{expense.accounting_notes}</p>
          </div>
        )}

        {/* Manager Actions */}
        {canManageExpense() && (
          <div className="actions-card card">
            <h3><i className="fas fa-tasks"></i> Manager Actions</h3>
            <div className="action-buttons">
              <button className="btn-success" onClick={() => openApprovalModal('approve')}>
                <i className="fas fa-check"></i> Approve Expense
              </button>
              <button className="btn-danger" onClick={() => openApprovalModal('reject')}>
                <i className="fas fa-times"></i> Reject Expense
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="modal-overlay" onClick={closeApprovalModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {modalAction === 'approve' ? (
                  <>
                    <i className="fas fa-check-circle" style={{ color: 'var(--success-color)' }}></i>
                    Approve Expense
                  </>
                ) : (
                  <>
                    <i className="fas fa-times-circle" style={{ color: 'var(--danger-color)' }}></i>
                    Reject Expense
                  </>
                )}
              </h2>
              <button className="close-btn" onClick={closeApprovalModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="modal-body">
              {modalAction === 'reject' && (
                <div className="rejection-reason-section">
                  <label htmlFor="rejection-reason">Reason for rejection (optional):</label>
                  <textarea
                    id="rejection-reason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Provide a reason for rejecting this expense..."
                    rows="4"
                  />
                </div>
              )}

              <p className="confirmation-text">
                {modalAction === 'approve'
                  ? `Are you sure you want to approve this ${formatCurrency(expense.amount, expense.currency)} expense?`
                  : `Are you sure you want to reject this ${formatCurrency(expense.amount, expense.currency)} expense?`}
              </p>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeApprovalModal} disabled={processing}>
                Cancel
              </button>
              {modalAction === 'approve' ? (
                <button className="btn-success" onClick={handleApprove} disabled={processing}>
                  {processing ? (
                    <>
                      <div className="spinner-small"></div>
                      Approving...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check"></i>
                      Confirm Approval
                    </>
                  )}
                </button>
              ) : (
                <button className="btn-danger" onClick={handleReject} disabled={processing}>
                  {processing ? (
                    <>
                      <div className="spinner-small"></div>
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-times"></i>
                      Confirm Rejection
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExpenseDetails
