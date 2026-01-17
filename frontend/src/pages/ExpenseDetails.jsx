import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, Button, Badge, Modal, Skeleton, Textarea, useToast, FilePreviewButton } from '../components/ui'
import BudgetImpactWidget from '../components/BudgetImpactWidget'
import logger from '../utils/logger'
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
      logger.error('Fetch error', { expenseId: id, error: err.message })
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
      logger.error('Approve error', { expenseId: id, error: err.message })
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
      logger.error('Reject error', { expenseId: id, error: err.message })
    } finally {
      setProcessing(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
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
      <div className="expense-details-content">
        {/* Enhanced Header Section */}
        <div className="page-header">
          <div className="header-top">
            <Button variant="ghost" icon="fas fa-arrow-left" onClick={() => navigate(-1)} className="back-button">
              Back
            </Button>
            <Badge variant={getStatusVariant(expense.status)} className="status-badge-large">
              <i className={`fas fa-${expense.status === 'approved' ? 'check-circle' : expense.status === 'rejected' ? 'times-circle' : expense.status === 'paid' ? 'money-check-alt' : 'clock'}`}></i>
              {expense.status}
            </Badge>
          </div>
          <div className="header-content">
            <div className="header-info">
              <h1 className="page-title">Expense Report</h1>
              <p className="expense-id">Reference: #{expense.id.toString().padStart(6, '0')}</p>
            </div>
          </div>
        </div>

        {/* Modern Amount Card with Gradient */}
        <div className="amount-card-modern">
          <div className="amount-card-gradient"></div>
          <div className="amount-card-content">
            <div className="amount-section">
              <div className="amount-label">Total Amount</div>
              <div className="amount-value">
                {formatCurrency(expense.amount, expense.currency)}
              </div>
            </div>
            <div className="amount-divider"></div>
            <div className="amount-meta-section">
              <div className="meta-item">
                <i className="fas fa-calendar-alt"></i>
                <div className="meta-content">
                  <span className="meta-label">Expense Date</span>
                  <span className="meta-value">{formatDate(expense.date)}</span>
                </div>
              </div>
              <div className="meta-item">
                <i className="fas fa-paper-plane"></i>
                <div className="meta-content">
                  <span className="meta-label">Submitted</span>
                  <span className="meta-value">{formatDate(expense.created_at)}</span>
                </div>
              </div>
              <div className="meta-item">
                <i className="fas fa-user-circle"></i>
                <div className="meta-content">
                  <span className="meta-label">Submitted by</span>
                  <span className="meta-value">{expense.submitter.name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Details Section */}
        <div className="details-section">
          <h2 className="section-title">
            <i className="fas fa-info-circle"></i>
            Expense Information
          </h2>

          <div className="details-grid-modern">
            {/* Submitter Card */}
            <Card className="info-card submitter-card" variant="elevated">
              <Card.Body>
                <div className="info-card-header">
                  <div className="info-icon-wrapper submitter-icon">
                    <i className="fas fa-user"></i>
                  </div>
                  <h3 className="info-card-title">Submitted By</h3>
                </div>
                <div className="info-card-content">
                  <div className="info-item">
                    <i className="fas fa-id-badge"></i>
                    <span className="info-value">{expense.submitter.name}</span>
                  </div>
                  <div className="info-item">
                    <i className="fas fa-envelope"></i>
                    <span className="info-value">{expense.submitter.email}</span>
                  </div>
                  <div className="info-item">
                    <i className="fas fa-at"></i>
                    <span className="info-value">{expense.submitter.username}</span>
                  </div>
                </div>
              </Card.Body>
            </Card>

            {/* Expense Details Card */}
            <Card className="info-card expense-info-card" variant="elevated">
              <Card.Body>
                <div className="info-card-header">
                  <div className="info-icon-wrapper expense-icon">
                    <i className="fas fa-receipt"></i>
                  </div>
                  <h3 className="info-card-title">Expense Details</h3>
                </div>
                <div className="info-card-content">
                  <div className="info-item">
                    <i className="fas fa-tag"></i>
                    <div className="info-value-group">
                      <span className="info-label">Type</span>
                      <span className="info-value">{expense.type || '-'}</span>
                    </div>
                  </div>
                  <div className="info-item">
                    <i className="fas fa-layer-group"></i>
                    <div className="info-value-group">
                      <span className="info-label">Category</span>
                      <span className="info-value">
                        {expense.category?.name || '-'}
                        {expense.subcategory && ` / ${expense.subcategory.name}`}
                      </span>
                    </div>
                  </div>
                  <div className="info-item">
                    <i className="fas fa-credit-card"></i>
                    <div className="info-value-group">
                      <span className="info-label">Payment Method</span>
                      <span className="info-value">{expense.payment_method || '-'}</span>
                    </div>
                  </div>
                  {expense.credit_card && (
                    <div className="info-item">
                      <i className="fas fa-wallet"></i>
                      <div className="info-value-group">
                        <span className="info-label">Card</span>
                        <span className="info-value">
                          **** {expense.credit_card.last_four_digits}
                          {expense.credit_card.description && ` (${expense.credit_card.description})`}
                        </span>
                      </div>
                    </div>
                  )}
                  {expense.payment_due_date && (
                    <div className="info-item">
                      <i className="fas fa-calendar-check"></i>
                      <div className="info-value-group">
                        <span className="info-label">Payment Due</span>
                        <span className="info-value">{expense.payment_due_date}</span>
                      </div>
                    </div>
                  )}
                </div>
              </Card.Body>
            </Card>

            {/* Supplier Card */}
            {expense.supplier && (
              <Card className="info-card supplier-card" variant="elevated">
                <Card.Body>
                  <div className="info-card-header">
                    <div className="info-icon-wrapper supplier-icon">
                      <i className="fas fa-building"></i>
                    </div>
                    <h3 className="info-card-title">Supplier Information</h3>
                  </div>
                  <div className="info-card-content">
                    <div className="info-item">
                      <i className="fas fa-store"></i>
                      <span className="info-value">{expense.supplier.name}</span>
                    </div>
                    {expense.supplier.email && (
                      <div className="info-item">
                        <i className="fas fa-envelope"></i>
                        <span className="info-value">{expense.supplier.email}</span>
                      </div>
                    )}
                    {expense.supplier.phone && (
                      <div className="info-item">
                        <i className="fas fa-phone"></i>
                        <span className="info-value">{expense.supplier.phone}</span>
                      </div>
                    )}
                  </div>
                </Card.Body>
              </Card>
            )}
          </div>
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
          <div className="description-section-wrapper">
            <h2 className="section-title">
              <i className="fas fa-align-left"></i>
              Description & Justification
            </h2>
            <Card className="description-card-modern" variant="elevated">
              <Card.Body>
                {expense.description && (
                  <div className="description-block">
                    <div className="description-header">
                      <i className="fas fa-file-alt"></i>
                      <h4>Description</h4>
                    </div>
                    <p className="description-text">{expense.description}</p>
                  </div>
                )}
                {expense.reason && (
                  <div className="description-block">
                    <div className="description-header">
                      <i className="fas fa-lightbulb"></i>
                      <h4>Business Justification</h4>
                    </div>
                    <p className="description-text">{expense.reason}</p>
                  </div>
                )}
              </Card.Body>
            </Card>
          </div>
        )}

        {/* Attachments */}
        {(expense.invoice_filename || expense.receipt_filename || expense.quote_filename) && (
          <div className="attachments-section-wrapper">
            <h2 className="section-title">
              <i className="fas fa-paperclip"></i>
              Attachments
            </h2>
            <div className="attachments-grid-modern">
              {expense.invoice_filename && (
                <Card className="attachment-card invoice-attachment" variant="elevated">
                  <Card.Body>
                    <div className="attachment-header">
                      <div className="attachment-icon-circle invoice">
                        <i className="fas fa-file-invoice"></i>
                      </div>
                      <div className="attachment-title-section">
                        <h4 className="attachment-type">Invoice</h4>
                        <p className="attachment-filename-small">{expense.invoice_filename}</p>
                      </div>
                    </div>
                    <FilePreviewButton
                      fileUrl={`/download/${expense.invoice_filename}`}
                      fileName={expense.invoice_filename}
                      icon="fas fa-eye"
                      title="Preview invoice"
                      className="attachment-preview-button"
                    >
                      <i className="fas fa-eye"></i>
                      Preview
                    </FilePreviewButton>
                  </Card.Body>
                </Card>
              )}
              {expense.receipt_filename && (
                <Card className="attachment-card receipt-attachment" variant="elevated">
                  <Card.Body>
                    <div className="attachment-header">
                      <div className="attachment-icon-circle receipt">
                        <i className="fas fa-receipt"></i>
                      </div>
                      <div className="attachment-title-section">
                        <h4 className="attachment-type">Receipt</h4>
                        <p className="attachment-filename-small">{expense.receipt_filename}</p>
                      </div>
                    </div>
                    <FilePreviewButton
                      fileUrl={`/download/${expense.receipt_filename}`}
                      fileName={expense.receipt_filename}
                      icon="fas fa-eye"
                      title="Preview receipt"
                      className="attachment-preview-button"
                    >
                      <i className="fas fa-eye"></i>
                      Preview
                    </FilePreviewButton>
                  </Card.Body>
                </Card>
              )}
              {expense.quote_filename && (
                <Card className="attachment-card quote-attachment" variant="elevated">
                  <Card.Body>
                    <div className="attachment-header">
                      <div className="attachment-icon-circle quote">
                        <i className="fas fa-file-alt"></i>
                      </div>
                      <div className="attachment-title-section">
                        <h4 className="attachment-type">Quote</h4>
                        <p className="attachment-filename-small">{expense.quote_filename}</p>
                      </div>
                    </div>
                    <FilePreviewButton
                      fileUrl={`/download/${expense.quote_filename}`}
                      fileName={expense.quote_filename}
                      icon="fas fa-eye"
                      title="Preview quote"
                      className="attachment-preview-button"
                    >
                      <i className="fas fa-eye"></i>
                      Preview
                    </FilePreviewButton>
                  </Card.Body>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Accounting Notes */}
        {expense.accounting_notes && (
          <div className="notes-section-wrapper">
            <h2 className="section-title">
              <i className="fas fa-clipboard-list"></i>
              Accounting Notes
            </h2>
            <Card className="notes-card-modern" variant="elevated">
              <Card.Body>
                <div className="notes-content">
                  <i className="fas fa-sticky-note"></i>
                  <p>{expense.accounting_notes}</p>
                </div>
              </Card.Body>
            </Card>
          </div>
        )}

        {/* Manager Actions */}
        {canManageExpense() && (
          <div className="actions-section-wrapper">
            <Card className="actions-card-modern" variant="elevated">
              <Card.Body>
                <div className="actions-header">
                  <div className="actions-icon-wrapper">
                    <i className="fas fa-tasks"></i>
                  </div>
                  <div className="actions-text">
                    <h3>Manager Actions Required</h3>
                    <p>Review and approve or reject this expense</p>
                  </div>
                </div>
                <div className="action-buttons-modern">
                  <Button
                    variant="success"
                    icon="fas fa-check-circle"
                    onClick={() => openApprovalModal('approve')}
                    size="large"
                    className="approve-button"
                  >
                    Approve Expense
                  </Button>
                  <Button
                    variant="danger"
                    icon="fas fa-times-circle"
                    onClick={() => openApprovalModal('reject')}
                    size="large"
                    className="reject-button"
                  >
                    Reject Expense
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </div>
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
