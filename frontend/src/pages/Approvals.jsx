import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Badge, Modal, Skeleton, EmptyState, Textarea, useToast, PageHeader } from '../components/ui'
import BudgetImpactWidget from '../components/BudgetImpactWidget'
import logger from '../utils/logger'
import './Approvals.css'

function Approvals({ user, setUser }) {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedExpense, setSelectedExpense] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [modalAction, setModalAction] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchPendingApprovals()
  }, [])

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true)

      const response = await fetch('/api/v1/expenses/pending-approval', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setExpenses(data.expenses)
      } else if (response.status === 403) {
        showError('You do not have permission to view approvals')
      } else {
        showError('Failed to load pending approvals')
      }
    } catch (err) {
      showError('An error occurred while fetching pending approvals')
      logger.error('Fetch error', { error: err.message })
    } finally {
      setLoading(false)
    }
  }

  const openModal = (expense, action) => {
    setSelectedExpense(expense)
    setModalAction(action)
    setRejectionReason('')
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedExpense(null)
    setModalAction(null)
    setRejectionReason('')
  }

  const handleApprove = async () => {
    if (!selectedExpense) return

    try {
      setProcessing(true)
      const response = await fetch(`/api/v1/expenses/${selectedExpense.id}/approve`, {
        method: 'PUT',
        credentials: 'include'
      })

      if (response.ok) {
        setExpenses(prev => prev.filter(exp => exp.id !== selectedExpense.id))
        success('Expense approved successfully!')
        closeModal()
      } else {
        const data = await response.json()
        showError(data.error || 'Failed to approve expense')
      }
    } catch (err) {
      showError('An error occurred while approving the expense')
      logger.error('Approve error', { error: err.message })
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedExpense) return

    try {
      setProcessing(true)
      const response = await fetch(`/api/v1/expenses/${selectedExpense.id}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ reason: rejectionReason })
      })

      if (response.ok) {
        setExpenses(prev => prev.filter(exp => exp.id !== selectedExpense.id))
        success('Expense rejected')
        closeModal()
      } else {
        const data = await response.json()
        showError(data.error || 'Failed to reject expense')
      }
    } catch (err) {
      showError('An error occurred while rejecting the expense')
      logger.error('Reject error', { error: err.message })
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

  if (!user?.is_manager && !user?.is_admin) {
    return (
      <div className="approvals-container">
        <div className="approvals-content">
          <Card className="unauthorized-card">
            <Card.Body>
              <EmptyState
                icon="fas fa-lock"
                title="Access Denied"
                description="You need manager or admin privileges to access this page."
                actionLabel="Back to Dashboard"
                onAction={() => navigate('/dashboard')}
              />
            </Card.Body>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="approvals-container">

      <div className="approvals-content">
        <PageHeader
          title="Pending Approvals"
          subtitle={`${expenses.length} expenses awaiting approval`}
          icon="fas fa-clipboard-check"
          variant="orange"
          actions={
            <Button variant="secondary" icon="fas fa-sync-alt" onClick={fetchPendingApprovals} disabled={loading}>
              Refresh
            </Button>
          }
        />

        {/* Expenses List */}
        <div className="approvals-list">
          {loading ? (
            <div className="loading-grid">
              {[1, 2, 3].map(i => (
                <Card key={i} className="expense-card">
                  <Card.Body>
                    <Skeleton variant="title" width="50%" />
                    <Skeleton variant="text" count={3} />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                      <Skeleton variant="button" width="80px" />
                      <Skeleton variant="button" width="80px" />
                    </div>
                  </Card.Body>
                </Card>
              ))}
            </div>
          ) : expenses.length === 0 ? (
            <Card>
              <Card.Body>
                <EmptyState
                  icon="fas fa-check-circle"
                  title="All caught up!"
                  description="No expenses are pending approval at this time."
                  actionLabel="Back to Dashboard"
                  onAction={() => navigate('/dashboard')}
                />
              </Card.Body>
            </Card>
          ) : (
            <div className="expenses-grid">
              {expenses.map(expense => (
                <Card key={expense.id} className="expense-card" hoverable>
                  <Card.Body>
                    <div className="expense-card-header">
                      <div className="expense-amount">
                        {formatCurrency(expense.amount, expense.currency)}
                      </div>
                      <Badge variant="warning" size="small">Pending</Badge>
                    </div>

                    <div className="expense-submitter">
                      <div className="submitter-avatar">
                        {expense.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div className="submitter-info">
                        <span className="submitter-name">{expense.user?.name || 'Unknown'}</span>
                        <span className="submitter-date">{formatDate(expense.date)}</span>
                      </div>
                    </div>

                    <div className="expense-details">
                      <p className="expense-description">{expense.description || 'No description'}</p>
                      {expense.category && (
                        <div className="expense-category">
                          <Badge variant="default" size="small">{expense.category}</Badge>
                          {expense.subcategory && (
                            <span className="subcategory">{expense.subcategory}</span>
                          )}
                        </div>
                      )}
                      {expense.reason && (
                        <p className="expense-reason">
                          <strong>Reason:</strong> {expense.reason}
                        </p>
                      )}
                    </div>

                    {/* Budget Impact Widget */}
                    {expense.budget_impact && (
                      <BudgetImpactWidget
                        budgetData={expense.budget_impact}
                        expenseAmount={expense.amount}
                        compact={true}
                      />
                    )}

                    <div className="expense-card-actions">
                      <Button
                        variant="success"
                        size="small"
                        icon="fas fa-check"
                        onClick={() => openModal(expense, 'approve')}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="small"
                        icon="fas fa-times"
                        onClick={() => openModal(expense, 'reject')}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="ghost"
                        size="small"
                        icon="fas fa-eye"
                        onClick={() => navigate(`/expenses/${expense.id}`)}
                      >
                        View
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Confirmation Modal */}
        <Modal
          isOpen={showModal && selectedExpense}
          onClose={closeModal}
          title={modalAction === 'approve' ? 'Approve Expense' : 'Reject Expense'}
          size="medium"
        >
          {selectedExpense && (
            <div className="approval-modal-content">
              <div className="expense-summary-card">
                <div className="summary-header">
                  <span className="summary-amount">
                    {formatCurrency(selectedExpense.amount, selectedExpense.currency)}
                  </span>
                  <span className="summary-date">{formatDate(selectedExpense.date)}</span>
                </div>
                <div className="summary-details">
                  <div className="summary-row">
                    <span className="summary-label">Employee</span>
                    <span className="summary-value">{selectedExpense.user.name}</span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Description</span>
                    <span className="summary-value">{selectedExpense.description || '-'}</span>
                  </div>
                  {selectedExpense.category && (
                    <div className="summary-row">
                      <span className="summary-label">Category</span>
                      <span className="summary-value">
                        {selectedExpense.category}
                        {selectedExpense.subcategory && ` / ${selectedExpense.subcategory}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Budget Impact in Modal */}
              {selectedExpense.budget_impact && modalAction === 'approve' && (
                <div className="modal-budget-section">
                  <h4 className="budget-section-title">Budget Impact Analysis</h4>
                  <BudgetImpactWidget
                    budgetData={selectedExpense.budget_impact}
                    expenseAmount={selectedExpense.amount}
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
                <Button variant="secondary" onClick={closeModal} disabled={processing}>
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
          )}
        </Modal>
      </div>
    </div>
  )
}

export default Approvals
