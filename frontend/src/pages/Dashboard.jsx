import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
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


  return (
    <div className="dashboard-container">
      <Header user={user} setUser={setUser} currentPage="dashboard" />

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="welcome-section">
          <h2>👋 Welcome back, {user?.first_name || 'User'}!</h2>
          <p className="welcome-text">
            Here's your expense overview for this month
          </p>
        </div>

        {/* Quick Stats */}
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading dashboard data...</p>
          </div>
        ) : (
          <>
            <div className="stats-grid">
              <div className="stat-card card">
                <div className="stat-icon" style={{ background: '#dbeafe' }}>
                  📝
                </div>
                <div className="stat-content">
                  <h3>Pending Expenses</h3>
                  <p className="stat-value">{summary?.pending || 0}</p>
                  <p className="stat-label">Awaiting approval</p>
                </div>
              </div>

              <div className="stat-card card">
                <div className="stat-icon" style={{ background: '#dcfce7' }}>
                  ✅
                </div>
                <div className="stat-content">
                  <h3>Approved</h3>
                  <p className="stat-value">{summary?.approved || 0}</p>
                  <p className="stat-label">Total approved</p>
                </div>
              </div>

              <div className="stat-card card">
                <div className="stat-icon" style={{ background: '#fef3c7' }}>
                  💰
                </div>
                <div className="stat-content">
                  <h3>Total Amount</h3>
                  <p className="stat-value">
                    {summary?.currency === 'USD' ? '$' : '₪'}
                    {summary?.total_amount?.toLocaleString() || '0'}
                  </p>
                  <p className="stat-label">This month</p>
                </div>
              </div>

              <div className="stat-card card">
                <div className="stat-icon" style={{ background: '#e0e7ff' }}>
                  📊
                </div>
                <div className="stat-content">
                  <h3>Budget Usage</h3>
                  <p className="stat-value">{budget?.usage_percent?.toFixed(1) || '0'}%</p>
                  <p className="stat-label">
                    {budget?.currency === 'USD' ? '$' : '₪'}
                    {budget?.spent?.toLocaleString() || '0'} of{' '}
                    {budget?.currency === 'USD' ? '$' : '₪'}
                    {budget?.total?.toLocaleString() || '0'}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="quick-actions">
              <h3>Quick Actions</h3>
              <div className="actions-grid">
                <button className="action-card card" onClick={() => navigate('/submit-expense')}>
                  <div className="action-icon">
                    <i className="fas fa-plus-circle"></i>
                  </div>
                  <div className="action-content">
                    <h4>Submit Expense</h4>
                    <p>Create a new expense report</p>
                  </div>
                </button>

                <button className="action-card card" onClick={() => navigate('/my-expenses')}>
                  <div className="action-icon">
                    <i className="fas fa-list"></i>
                  </div>
                  <div className="action-content">
                    <h4>My Expenses</h4>
                    <p>View and manage all expenses</p>
                  </div>
                </button>

                <button className="action-card card" onClick={() => navigate('/reports')}>
                  <div className="action-icon">
                    <i className="fas fa-chart-bar"></i>
                  </div>
                  <div className="action-content">
                    <h4>Reports</h4>
                    <p>Generate & export reports</p>
                  </div>
                </button>

                {(user?.is_manager || user?.is_admin) && (
                  <button className="action-card card" onClick={() => navigate('/approvals')}>
                    <div className="action-icon">
                      <i className="fas fa-clipboard-check"></i>
                    </div>
                    <div className="action-content">
                      <h4>Approvals</h4>
                      <p>Review pending expenses</p>
                    </div>
                  </button>
                )}

                {user?.is_admin && (
                  <>
                    <button className="action-card card" onClick={() => navigate('/admin/departments')}>
                      <div className="action-icon">
                        <i className="fas fa-sitemap"></i>
                      </div>
                      <div className="action-content">
                        <h4>Organization</h4>
                        <p>Manage departments & categories</p>
                      </div>
                    </button>
                    <button className="action-card card" onClick={() => navigate('/admin/users')}>
                      <div className="action-icon">
                        <i className="fas fa-users"></i>
                      </div>
                      <div className="action-content">
                        <h4>Users</h4>
                        <p>Manage user accounts</p>
                      </div>
                    </button>
                    <button className="action-card card" onClick={() => navigate('/admin')}>
                      <div className="action-icon">
                        <i className="fas fa-chart-line"></i>
                      </div>
                      <div className="action-content">
                        <h4>Analytics</h4>
                        <p>View expense reports</p>
                      </div>
                    </button>
                    <button className="action-card card" onClick={() => navigate('/admin/suppliers')}>
                      <div className="action-icon">
                        <i className="fas fa-building"></i>
                      </div>
                      <div className="action-content">
                        <h4>Suppliers</h4>
                        <p>Manage vendors</p>
                      </div>
                    </button>
                    <button className="action-card card" onClick={() => navigate('/admin/credit-cards')}>
                      <div className="action-icon">
                        <i className="fas fa-credit-card"></i>
                      </div>
                      <div className="action-content">
                        <h4>Credit Cards</h4>
                        <p>Manage company cards</p>
                      </div>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Recent Expenses */}
            {recentExpenses.length > 0 && (
              <div className="recent-expenses card">
                <h3>📋 Recent Expenses</h3>
                <div className="expenses-list">
                  {recentExpenses.map(expense => (
                    <div key={expense.id} className="expense-item">
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
                        <span className={`expense-status status-${expense.status}`}>
                          {expense.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Tips Section */}
        <div className="tips-section card">
          <h3>💡 Quick Tips</h3>
          <div className="tips-grid">
            <div className="tip-item">
              <i className="fas fa-keyboard"></i>
              <div>
                <strong>Keyboard Shortcuts</strong>
                <p>Press <kbd>N</kbd> to quickly submit a new expense</p>
              </div>
            </div>
            <div className="tip-item">
              <i className="fas fa-camera"></i>
              <div>
                <strong>Receipt Upload</strong>
                <p>Attach receipts to expenses for faster approval</p>
              </div>
            </div>
            <div className="tip-item">
              <i className="fas fa-bell"></i>
              <div>
                <strong>Stay Updated</strong>
                <p>Check the Approvals tab for pending items</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Dashboard
