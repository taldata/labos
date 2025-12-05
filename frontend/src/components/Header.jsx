import { useNavigate } from 'react-router-dom'
import './Header.css'

function Header({ user, setUser, currentPage = 'dashboard' }) {
  const navigate = useNavigate()

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
      await fetch('/api/v1/auth/set-version-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ version: 'legacy' })
      })
      window.location.href = '/'
    } catch (error) {
      console.error('Failed to switch version:', error)
      window.location.href = '/'
    }
  }

  const getRoleBadge = () => {
    if (user?.is_admin) return '👑 Admin'
    if (user?.is_manager) return '👔 Manager'
    if (user?.is_accounting) return '📊 Accounting'
    return '👤 Employee'
  }

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="logo-section">
          <h1 onClick={() => navigate('/dashboard')} className="logo-link">
            Labos
          </h1>
          <span className="version-badge">Modern UI</span>
        </div>
        {currentPage !== 'dashboard' && (
          <nav className="header-nav">
            <button 
              className={`nav-link ${currentPage === 'dashboard' ? 'active' : ''}`}
              onClick={() => navigate('/dashboard')}
            >
              <i className="fas fa-home"></i> Dashboard
            </button>
            <button 
              className={`nav-link ${currentPage === 'my-expenses' ? 'active' : ''}`}
              onClick={() => navigate('/my-expenses')}
            >
              <i className="fas fa-list"></i> My Expenses
            </button>
            {(user?.is_manager || user?.is_admin) && (
              <button 
                className={`nav-link ${currentPage === 'approvals' ? 'active' : ''}`}
                onClick={() => navigate('/approvals')}
              >
                <i className="fas fa-clipboard-check"></i> Approvals
              </button>
            )}
            {user?.is_admin && (
              <>
                <button 
                  className={`nav-link ${currentPage === 'admin' ? 'active' : ''}`}
                  onClick={() => navigate('/admin')}
                >
                  <i className="fas fa-chart-line"></i> Analytics
                </button>
                <button 
                  className={`nav-link ${currentPage === 'departments' ? 'active' : ''}`}
                  onClick={() => navigate('/admin/departments')}
                >
                  <i className="fas fa-sitemap"></i> Organization
                </button>
                <button 
                  className={`nav-link ${currentPage === 'users' ? 'active' : ''}`}
                  onClick={() => navigate('/admin/users')}
                >
                  <i className="fas fa-users"></i> Users
                </button>
              </>
            )}
          </nav>
        )}
      </div>
      <div className="header-right">
        <div className="user-info">
          <span className="user-name">{user?.first_name} {user?.last_name}</span>
          <span className="user-role">{getRoleBadge()}</span>
        </div>
        <button className="btn-primary" onClick={() => navigate('/submit-expense')}>
          <i className="fas fa-plus"></i> Submit Expense
        </button>
        <button className="btn-secondary" onClick={switchToLegacy}>
          <i className="fas fa-exchange-alt"></i> Legacy
        </button>
        <button className="btn-danger" onClick={handleLogout}>
          <i className="fas fa-sign-out-alt"></i> Logout
        </button>
      </div>
    </header>
  )
}

export default Header

