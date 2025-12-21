import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { Card, Badge, Skeleton, Button } from '../components/ui'
import './Dashboard.css'

function Dashboard({ user, setUser }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [budget, setBudget] = useState(null)
  const [recentExpenses, setRecentExpenses] = useState([])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Fetch summary
      const summaryRes = await fetch('/api/v1/expenses/summary', {
        credentials: 'include'
      })
      if (summaryRes.ok) {
        const data = await summaryRes.json()
        setSummary(data.summary)
        setBudget(data.budget)
      }

      // Fetch recent expenses
      const recentRes = await fetch('/api/v1/expenses/recent?limit=5', {
        credentials: 'include'
      })
      if (recentRes.ok) {
        const data = await recentRes.json()
        setRecentExpenses(data.expenses)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
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

  return (
    <div className="dashboard-container">
      <Header user={user} setUser={setUser} currentPage="dashboard" />

      <main className="dashboard-main">
        <div className="welcome-section">
          <h2>Welcome back, {user?.first_name || user?.username || user?.email?.split('@')[0] || 'User'}!</h2>
          <p className="welcome-text">
            Here's your expense overview for this month
          </p>
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
                  <>
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
                  </>
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

                <Card hoverable clickable onClick={() => navigate('/reports')} className="action-card">
                  <Card.Body>
                    <div className="action-icon action-icon-reports">
                      <i className="fas fa-chart-bar"></i>
                    </div>
                    <div className="action-content">
                      <h4>Reports</h4>
                      <p>Generate & export reports</p>
                    </div>
                  </Card.Body>
                </Card>

                {(user?.is_manager || user?.is_admin) && (
                  <Card hoverable clickable onClick={() => navigate('/approvals')} className="action-card">
                    <Card.Body>
                      <div className="action-icon action-icon-approvals">
                        <i className="fas fa-clipboard-check"></i>
                      </div>
                      <div className="action-content">
                        <h4>Approvals</h4>
                        <p>Review pending expenses</p>
                      </div>
                    </Card.Body>
                  </Card>
                )}

                {user?.is_admin && (
                  <>
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
                  </>
                )}
              </div>
            </div>

            {/* Recent Expenses */}
            {recentExpenses.length > 0 && (
              <Card className="recent-expenses">
                <Card.Header>
                  <h3><i className="fas fa-receipt"></i> Recent Expenses</h3>
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
                          {new Date(expense.date).toLocaleDateString()}
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
