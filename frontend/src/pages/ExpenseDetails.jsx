import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import { Card, Button, Badge, Modal, Skeleton, Textarea, useToast } from '../components/ui'
import BudgetImpactWidget from '../components/BudgetImpactWidget'
import './ExpenseDetails.css'

function ExpenseDetails({ user, setUser }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const { success, error: showError } = useToast()
  const [expense, setExpense] = useState(null)
  const [loading, setLoading] = useState(true)
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

      const response = await fetch(`/api/v1/expenses/${id}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setExpense(data.expense)
      } else if (response.status === 404) {
        showError('Expense not found')
        navigate('/my-expenses')
      } else if (response.status === 403) {
        showError('You do not have permission to view this expense')
        navigate('/my-expenses')
      } else {
        showError('Failed to load expense details')
      }
    } catch (err) {
      showError('An error occurred while fetching expense details')
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
        success('Expense approved successfully!')
        closeApprovalModal()
      } else {
        const data = await response.json()
        showError(data.error || 'Failed to approve expense')
      }
    } catch (err) {
      showError('An error occurred while approving the expense')
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
        success('Expense rejected')
        closeApprovalModal()
      } else {
        const data = await response.json()
        showError(data.error || 'Failed to reject expense')
      }
    } catch (err) {
      showError('An error occurred while rejecting the expense')
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

  const getStatusVariant = (status) => {
    const variants = {
      pending: 'warning',
      approved: 'success',
      rejected: 'danger',
      paid: 'info'
    }
    return variants[status] || 'default'
  }

  const canManageExpense = () => {
    return (user?.is_manager || user?.is_admin) && expense?.status === 'pending'
  }

  if (loading) {
    return (
      <div className="expense-details-container">
        <Header user={user} setUser={setUser} />
        <div className="expense-details-content">
          <Card>
            <Card.Body>
              <Skeleton variant="title" width="60%" />
              <Skeleton variant="text" count={8} />
            </Card.Body>
          </Card>
        </div>
      </div>
    )
  }

  if (!expense) {
    return (
      <div className="expense-details-container">
        <Header user={user} setUser={setUser} />
        <div className="expense-details-content">
          <Card>
            <Card.Body>
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <i className="fas fa-exclamation-triangle" style={{ fontSize: '3rem', color: 'var(--danger-color)' }}></i>
                <h2>Expense not found</h2>
                <Button variant="primary" onClick={() => navigate(-1)} style={{ marginTop: '1rem' }}>
                  Go Back
                </Button>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="expense-details-container">
      <Header user={user} setUser={setUser} />

      <div className="expense-details-content">
        {/* Page Title Section */}
        <div className="page-title-section">
          <div>
            <Button variant="ghost" icon="fas fa-arrow-left" onClick={() => navigate(-1)}>
              Back
            </Button>
            <h1>Expense Details</h1>
            <p className="subtitle">ID: #{expense.id}</p>
          </div>
          <Badge variant={getStatusVariant(expense.status)}>{expense.status}</Badge>
        </div>
        {/* Amount Card */}
        <Card className="amount-card">
          <Card.Body>
            <div className="amount-label">Total Amount</div>
            <div className="amount-value">
              {formatCurrency(expense.amount, expense.currency)}
            </div>
            <div className="amount-meta">
              <span><i className="fas fa-calendar"></i> {formatDate(expense.date)}</span>
              <span><i className="fas fa-clock"></i> Submitted {formatDate(expense.created_at)}</span>
            </div>
          </Card.Body>
        </Card>

        {/* Details Grid */}
        <div className="details-grid">
          {/* Submitter Information */}
          <Card className="detail-card">
            <Card.Header>
              <i className="fas fa-user"></i> Submitter
            </Card.Header>
            <Card.Body>
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
            </Card.Body>
          </Card>

          {/* Expense Information */}
          <Card className="detail-card">
            <Card.Header>
              <i className="fas fa-info-circle"></i> Expense Information
            </Card.Header>
            <Card.Body>
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
            </Card.Body>
          </Card>

          {/* Supplier Information */}
          {expense.supplier && (
            <Card className="detail-card">
              <Card.Header>
                <i className="fas fa-building"></i> Supplier
              </Card.Header>
              <Card.Body>
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
              </Card.Body>
            </Card>
          )}
        </div>

        {/* Budget Impact Widget */}
        {expense.budget_impact && (
          <BudgetImpactWidget
            budgetData={expense.budget_impact}
            expenseAmount={expense.amount}
            compact={false}
          />
        )}

        {/* Description & Reason */}
        {(expense.description || expense.reason) && (
          <Card className="description-card">
            <Card.Header>
              <i className="fas fa-align-left"></i> Description & Reason
            </Card.Header>
            <Card.Body>
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
            </Card.Body>
          </Card>
        )}

        {/* Attachments */}
        {(expense.invoice_filename || expense.receipt_filename || expense.quote_filename) && (
          <Card className="attachments-card">
            <Card.Header>
              <i className="fas fa-paperclip"></i> Attachments
            </Card.Header>
            <Card.Body>
              <div className="attachments-grid">
                {expense.invoice_filename && (
                  <div className="attachment-item">
                    <i className="fas fa-file-invoice"></i>
                    <div className="attachment-info">
                      <span className="attachment-name">Invoice</span>
                      <span className="attachment-filename">{expense.invoice_filename}</span>
                    </div>
                    <Button
                      variant="secondary"
                      size="small"
                      icon="fas fa-download"
                      onClick={() => window.open(`/download/${expense.invoice_filename}`, '_blank')}
                    >
                      View
                    </Button>
                  </div>
                )}
                {expense.receipt_filename && (
                  <div className="attachment-item">
                    <i className="fas fa-receipt"></i>
                    <div className="attachment-info">
                      <span className="attachment-name">Receipt</span>
                      <span className="attachment-filename">{expense.receipt_filename}</span>
                    </div>
                    <Button
                      variant="secondary"
                      size="small"
                      icon="fas fa-download"
                      onClick={() => window.open(`/download/${expense.receipt_filename}`, '_blank')}
                    >
                      View
                    </Button>
                  </div>
                )}
                {expense.quote_filename && (
                  <div className="attachment-item">
                    <i className="fas fa-file-alt"></i>
                    <div className="attachment-info">
                      <span className="attachment-name">Quote</span>
                      <span className="attachment-filename">{expense.quote_filename}</span>
                    </div>
                    <Button
                      variant="secondary"
                      size="small"
                      icon="fas fa-download"
                      onClick={() => window.open(`/download/${expense.quote_filename}`, '_blank')}
                    >
                      View
                    </Button>
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        )}

        {/* Accounting Notes */}
        {expense.accounting_notes && (
          <Card className="notes-card">
            <Card.Header>
              <i className="fas fa-sticky-note"></i> Accounting Notes
            </Card.Header>
            <Card.Body>
              <p>{expense.accounting_notes}</p>
            </Card.Body>
          </Card>
        )}

        {/* Manager Actions */}
        {canManageExpense() && (
          <Card className="actions-card">
            <Card.Header>
              <i className="fas fa-tasks"></i> Manager Actions
            </Card.Header>
            <Card.Body>
              <div className="action-buttons">
                <Button variant="success" icon="fas fa-check" onClick={() => openApprovalModal('approve')}>
                  Approve Expense
                </Button>
                <Button variant="danger" icon="fas fa-times" onClick={() => openApprovalModal('reject')}>
                  Reject Expense
                </Button>
              </div>
            </Card.Body>
          </Card>
        )}
      </div>

      {/* Approval Modal */}
      <Modal
        isOpen={showApprovalModal}
        onClose={closeApprovalModal}
        title={modalAction === 'approve' ? 'Approve Expense' : 'Reject Expense'}
        size="medium"
      >
        <div className="approval-modal-content">
          <div className="expense-summary-card">
            <div className="summary-header">
              <span className="summary-amount">
                {formatCurrency(expense.amount, expense.currency)}
              </span>
              <span className="summary-date">{formatDate(expense.date)}</span>
            </div>
            <div className="summary-details">
              <div className="summary-row">
                <span className="summary-label">Employee</span>
                <span className="summary-value">{expense.submitter.name}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Description</span>
                <span className="summary-value">{expense.description || '-'}</span>
              </div>
              {expense.category && (
                <div className="summary-row">
                  <span className="summary-label">Category</span>
                  <span className="summary-value">
                    {expense.category.name}
                    {expense.subcategory && ` / ${expense.subcategory.name}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Budget Impact in Modal */}
          {expense.budget_impact && modalAction === 'approve' && (
            <div className="modal-budget-section">
              <h4 className="budget-section-title">Budget Impact Analysis</h4>
              <BudgetImpactWidget
                budgetData={expense.budget_impact}
                expenseAmount={expense.amount}
                compact={false}
              />
            </div>
          )}

          {modalAction === 'reject' && (
            <Textarea
              label="Reason for rejection (optional)"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Provide a reason for rejecting this expense..."
              rows={3}
            />
          )}

          <p className="confirmation-message">
            {modalAction === 'approve'
              ? 'Are you sure you want to approve this expense?'
              : 'Are you sure you want to reject this expense?'}
          </p>

          <div className="modal-actions">
            <Button variant="secondary" onClick={closeApprovalModal} disabled={processing}>
              Cancel
            </Button>
            {modalAction === 'approve' ? (
              <Button
                variant="success"
                icon="fas fa-check"
                onClick={handleApprove}
                loading={processing}
              >
                Confirm Approval
              </Button>
            ) : (
              <Button
                variant="danger"
                icon="fas fa-times"
                onClick={handleReject}
                loading={processing}
              >
                Confirm Rejection
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ExpenseDetails
