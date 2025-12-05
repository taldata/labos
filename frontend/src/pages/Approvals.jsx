import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import './Approvals.css'

function Approvals({ user, setUser }) {
  const navigate = useNavigate()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedExpense, setSelectedExpense] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [modalAction, setModalAction] = useState(null) // 'approve' or 'reject'
  const [rejectionReason, setRejectionReason] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchPendingApprovals()
  }, [])

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await fetch('/api/v1/expenses/pending-approval', {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setExpenses(data.expenses)
      } else if (response.status === 403) {
        setError('You do not have permission to view approvals')
      } else {
        setError('Failed to load pending approvals')
      }
    } catch (err) {
      setError('An error occurred while fetching pending approvals')
      console.error('Fetch error:', err)
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
        // Remove approved expense from list
        setExpenses(prev => prev.filter(exp => exp.id !== selectedExpense.id))
        closeModal()
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
        // Remove rejected expense from list
        setExpenses(prev => prev.filter(exp => exp.id !== selectedExpense.id))
        closeModal()
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
      month: 'short',
      day: 'numeric'
    })
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
        <div className="unauthorized-message card">
          <i className="fas fa-lock"></i>
          <h2>Access Denied</h2>
          <p>You need manager or admin privileges to access this page.</p>
          <button className="btn-primary" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="approvals-container">
      <Header user={user} setUser={setUser} currentPage="approvals" />

      <div className="approvals-content">
        <div className="page-title-section">
          <div>
            <h1>Pending Approvals</h1>
            <p className="subtitle">{expenses.length} expenses awaiting approval</p>
          </div>
        </div>

      {/* Error Alert */}
      {error && (
        <div className="error-alert card">
          <i className="fas fa-exclamation-circle"></i>
          {error}
        </div>
      )}

      {/* Expenses List */}
      <div className="approvals-list">
        {loading ? (
          <div className="loading-state card">
            <div className="spinner"></div>
            <p>Loading pending approvals...</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="empty-state card">
            <i className="fas fa-check-circle"></i>
            <h3>All caught up!</h3>
            <p>No expenses are pending approval at this time.</p>
            <button className="btn-primary" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </button>
          </div>
        ) : (
          <div className="expenses-grid">
            {expenses.map(expense => (
              <div key={expense.id} className="expense-card card">
                <div className="expense-card-header">
                  <div className="expense-amount">
                    {formatCurrency(expense.amount, expense.currency)}
                  </div>
                  <div className="expense-date">
                    {formatDate(expense.date)}
                  </div>
                </div>

                <div className="expense-card-body">
                  <div className="expense-submitter">
                    <i className="fas fa-user"></i>
                    <span>{expense.user.name}</span>
                  </div>

                  <div className="expense-details">
                    <div className="detail-row">
                      <span className="detail-label">Description:</span>
                      <span className="detail-value">{expense.description || 'No description'}</span>
                    </div>

                    {expense.category && (
                      <div className="detail-row">
                        <span className="detail-label">Category:</span>
                        <span className="detail-value">
                          {expense.category} {expense.subcategory && `/ ${expense.subcategory}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="expense-card-actions">
                  <button
                    className="btn-success"
                    onClick={() => openModal(expense, 'approve')}
                  >
                    <i className="fas fa-check"></i> Approve
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => openModal(expense, 'reject')}
                  >
                    <i className="fas fa-times"></i> Reject
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => navigate(`/expenses/${expense.id}`)}
                  >
                    <i className="fas fa-eye"></i> View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showModal && selectedExpense && (
        <div className="modal-overlay" onClick={closeModal}>
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
              <button className="close-btn" onClick={closeModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="modal-body">
              <div className="expense-summary">
                <div className="summary-row">
                  <span className="summary-label">Amount:</span>
                  <span className="summary-value">
                    {formatCurrency(selectedExpense.amount, selectedExpense.currency)}
                  </span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Employee:</span>
                  <span className="summary-value">{selectedExpense.user.name}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Date:</span>
                  <span className="summary-value">{formatDate(selectedExpense.date)}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Description:</span>
                  <span className="summary-value">{selectedExpense.description || '-'}</span>
                </div>
              </div>

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
                  ? 'Are you sure you want to approve this expense?'
                  : 'Are you sure you want to reject this expense?'}
              </p>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal} disabled={processing}>
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
    </div>
  )
}

export default Approvals
