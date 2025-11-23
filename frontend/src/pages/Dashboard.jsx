import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
      setUser(null)
      navigate('/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const switchToLegacy = async () => {
    try {
      // Save preference to database
      await fetch('/api/v1/auth/set-version-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ version: 'legacy' })
      })

      // Redirect to legacy version
      window.location.href = '/'
    } catch (error) {
      console.error('Failed to switch version:', error)
      // Still redirect even if preference save fails
      window.location.href = '/'
    }
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1>Labos</h1>
          <span className="version-badge">Modern UI</span>
        </div>
        <div className="header-right">
          <div className="user-info">
            <span className="user-name">{user?.first_name} {user?.last_name}</span>
            <span className="user-role">
              {user?.is_admin && '👑 Admin'}
              {user?.is_manager && !user?.is_admin && '👔 Manager'}
              {user?.is_accounting && !user?.is_admin && '📊 Accounting'}
              {!user?.is_admin && !user?.is_manager && !user?.is_accounting && '👤 Employee'}
            </span>
          </div>
          <button className="btn-primary" onClick={() => navigate('/submit-expense')}>
            <i className="fas fa-plus"></i> Submit Expense
          </button>
          <button className="btn-secondary" onClick={switchToLegacy}>
            Switch to Legacy
          </button>
          <button className="btn-danger" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="welcome-section">
          <h2>Welcome to the Modern Expense Management System</h2>
          <p className="welcome-text">
            This is the new modern interface powered by React. Features will be migrated gradually.
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

        {/* Feature Notice */}
        <div className="feature-notice card">
          <h3>🚧 Gradual Migration in Progress</h3>
          <p>
            We're building a modern, faster, and more intuitive interface. Features from the legacy
            system will be migrated incrementally. For now, you can switch back to the legacy version
            to access all features.
          </p>

          <div className="migration-status">
            <h4>Migration Progress:</h4>
            <div className="progress-container">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: '50%' }}></div>
              </div>
              <span className="progress-label">50% Complete</span>
            </div>

            <div className="feature-list">
              <div className="feature-item completed">
                <span className="feature-icon">✅</span>
                <span className="feature-name">Authentication & Security</span>
                <span className="feature-badge">Live</span>
              </div>
              <div className="feature-item completed">
                <span className="feature-icon">✅</span>
                <span className="feature-name">Dashboard & Statistics</span>
                <span className="feature-badge">Live</span>
              </div>
              <div className="feature-item completed">
                <span className="feature-icon">✅</span>
                <span className="feature-name">Budget Tracking</span>
                <span className="feature-badge">Live</span>
              </div>
              <div className="feature-item completed">
                <span className="feature-icon">✅</span>
                <span className="feature-name">Expense Submission</span>
                <span className="feature-badge">Live</span>
              </div>
              <div className="feature-item in-progress">
                <span className="feature-icon">🔨</span>
                <span className="feature-name">Expense History & Filtering</span>
                <span className="feature-badge">Next</span>
              </div>
              <div className="feature-item pending">
                <span className="feature-icon">⏳</span>
                <span className="feature-name">Manager Approval Workflow</span>
                <span className="feature-badge">Planned</span>
              </div>
              <div className="feature-item pending">
                <span className="feature-icon">⏳</span>
                <span className="feature-name">Admin Panel & Reporting</span>
                <span className="feature-badge">Planned</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Dashboard
