import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Badge, Skeleton, Button } from '../components/ui'
import logger from '../utils/logger'
import './Dashboard.css'

function Dashboard({ user, setUser }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [budget, setBudget] = useState(null)
  const [recentExpenses, setRecentExpenses] = useState([])
  const isMountedRef = useRef(true)

  const fetchDashboardData = useCallback(async () => {
    const abortController = new AbortController()

    try {
      setLoading(true)

      // Fetch summary
      const summaryRes = await fetch('/api/v1/expenses/summary', {
        credentials: 'include',
        signal: abortController.signal
      })
      if (summaryRes.ok) {
        const data = await summaryRes.json()
        if (isMountedRef.current) {
          setSummary(data.summary)
          setBudget(data.budget)
        }
      }

      // Fetch recent expenses
      const recentRes = await fetch('/api/v1/expenses/recent?limit=5', {
        credentials: 'include',
        signal: abortController.signal
      })
      if (recentRes.ok) {
        const data = await recentRes.json()
        if (isMountedRef.current) {
          setRecentExpenses(data.expenses)
        }
      }
    } catch (error) {
      // Ignore abort errors
      if (error.name === 'AbortError') return
      logger.error('Failed to fetch dashboard data', { error: error.message })
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }

    return () => abortController.abort()
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    fetchDashboardData()

    return () => {
      isMountedRef.current = false
    }
  }, [fetchDashboardData])

  const getStatusVariant = (status) => {
    const variants = {
      pending: 'warning',
      approved: 'success',
      rejected: 'danger',
      paid: 'info'
    }
    return variants[status] || 'default'
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const getCurrentDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="dashboard-container">

      <main className="dashboard-main">
        <div className="welcome-banner">
          <div className="welcome-banner-content">
            <div className="welcome-text-container">
              <span className="welcome-date">{getCurrentDate()}</span>
              <h2 className="welcome-greeting">
                {getGreeting()}, <span className="welcome-name">{user?.first_name || user?.username || user?.email?.split('@')[0] || 'User'}</span>!
              </h2>
              <p className="welcome-subtitle">
                Here's your expense overview for this month
              </p>
            </div>
            <div className="welcome-decoration">
              <div className="welcome-icon-container">
                <i className="fas fa-chart-pie"></i>
              </div>
              <div className="welcome-ring welcome-ring-1"></div>
              <div className="welcome-ring welcome-ring-2"></div>
            </div>
          </div>
          <div className="welcome-wave"></div>
        </div>

        {loading ? (
          <div className="actions-grid">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="action-card">
                <Card.Body>
                  <div className="stat-card-loading">
                    <Skeleton variant="avatar" width="48px" height="48px" borderRadius="0.75rem" />
                    <div style={{ flex: 1 }}>
                      <Skeleton variant="text" width="60%" height="0.875rem" />
                      <Skeleton variant="title" width="40%" height="1.75rem" />
                    </div>
                  </div>
                </Card.Body>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {/* Quick Actions */}
            <div className="quick-actions">
              <h3>Quick Actions</h3>
              <div className="actions-grid">
                {/* Primary actions - always first row */}
                <Card hoverable clickable onClick={() => navigate('/submit-expense')} className="action-card">
                  <Card.Body>
                    <div className="action-icon action-icon-submit">
                      <i className="fas fa-plus-circle"></i>
                    </div>
                    <div className="action-content">
                      <h4>Submit Expense</h4>
                      <p>Create a new expense report</p>
                    </div>
                  </Card.Body>
                </Card>

                {/* Admin-only cards */}
                {user?.is_admin && (
                  <Card hoverable clickable onClick={() => navigate('/admin/departments')} className="action-card">
                    <Card.Body>
                      <div className="action-icon action-icon-org">
                        <i className="fas fa-sitemap"></i>
                      </div>
                      <div className="action-content">
                        <h4>Organization</h4>
                        <p>Manage departments & categories</p>
                      </div>
                    </Card.Body>
                  </Card>
                )}

                {user?.is_admin && (
                  <Card hoverable clickable onClick={() => navigate('/admin/suppliers')} className="action-card">
                    <Card.Body>
                      <div className="action-icon action-icon-suppliers">
                        <i className="fas fa-building"></i>
                      </div>
                      <div className="action-content">
                        <h4>Suppliers</h4>
                        <p>Manage vendors</p>
                      </div>
                    </Card.Body>
                  </Card>
                )}

                {user?.is_admin && (
                  <Card hoverable clickable onClick={() => navigate('/admin/expense-history')} className="action-card">
                    <Card.Body>
                      <div className="action-icon action-icon-history">
                        <i className="fas fa-history"></i>
                      </div>
                      <div className="action-content">
                        <h4>Expense History</h4>
                        <p>View all expenses</p>
                      </div>
                    </Card.Body>
                  </Card>
                )}

                {/* Additional actions */}
                <Card hoverable clickable onClick={() => navigate('/my-expenses')} className="action-card">
                  <Card.Body>
                    <div className="action-icon action-icon-list">
                      <i className="fas fa-list"></i>
                    </div>
                    <div className="action-content">
                      <h4>My Expenses</h4>
                      <p>View and manage all expenses</p>
                    </div>
                  </Card.Body>
                </Card>




                {user?.is_admin && (
                  <Card hoverable clickable onClick={() => navigate('/admin/users')} className="action-card">
                    <Card.Body>
                      <div className="action-icon action-icon-users">
                        <i className="fas fa-users"></i>
                      </div>
                      <div className="action-content">
                        <h4>Users</h4>
                        <p>Manage user accounts</p>
                      </div>
                    </Card.Body>
                  </Card>
                )}
                {user?.is_admin && (
                  <Card hoverable clickable onClick={() => navigate('/admin')} className="action-card">
                    <Card.Body>
                      <div className="action-icon action-icon-analytics">
                        <i className="fas fa-chart-line"></i>
                      </div>
                      <div className="action-content">
                        <h4>Analytics</h4>
                        <p>View expense reports</p>
                      </div>
                    </Card.Body>
                  </Card>
                )}
                {user?.is_admin && (
                  <Card hoverable clickable onClick={() => navigate('/admin/credit-cards')} className="action-card">
                    <Card.Body>
                      <div className="action-icon action-icon-cards">
                        <i className="fas fa-credit-card"></i>
                      </div>
                      <div className="action-content">
                        <h4>Credit Cards</h4>
                        <p>Manage company cards</p>
                      </div>
                    </Card.Body>
                  </Card>
                )}
              </div>
            </div>

            {/* Recent Expenses */}
            {recentExpenses.length > 0 && (
              <Card className="recent-expenses">
                <Card.Header>
                  <h3><i className="fas fa-receipt"></i> 5 Most Recent Expenses</h3>
                  <Button variant="ghost" size="small" onClick={() => navigate('/admin/expense-history')}>
                    View All <i className="fas fa-arrow-right"></i>
                  </Button>
                </Card.Header>
                <Card.Body className="expenses-list-body">
                  {recentExpenses.map(expense => (
                    <div
                      key={expense.id}
                      className="expense-item"
                      onClick={() => navigate(`/expenses/${expense.id}`)}
                    >
                      <div className="expense-info">
                        <div className="expense-desc">{expense.description || 'No description'}</div>
                        <div className="expense-meta">
                          {expense.category} • {expense.subcategory} •{' '}
                          {formatDate(expense.date)}
                        </div>
                      </div>
                      <div className="expense-right">
                        <div className="expense-amount">
                          {expense.currency === 'USD' ? '$' : '₪'}
                          {expense.amount.toLocaleString()}
                        </div>
                        <Badge variant={getStatusVariant(expense.status)} size="small">
                          {expense.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </Card.Body>
              </Card>
            )}
          </>
        )}

      </main>
    </div>
  )
}

export default Dashboard
