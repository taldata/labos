// React hooks not currently needed
import { useNavigate, useLocation } from 'react-router-dom'
import logger from '../utils/logger'
import './Sidebar.css'

function Sidebar({ user, setUser, isOpen, onToggle }) {
  const navigate = useNavigate()
  const location = useLocation()
  // Pending count removed - all expenses are auto-approved

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
      setUser(null)
      navigate('/login')
    } catch (error) {
      logger.error('Logout failed', { error: error.message })
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
      logger.error('Failed to switch version', { error: error.message })
      window.location.href = '/'
    }
  }

  const isActive = (path) => location.pathname === path

  const navItems = [
    { path: '/dashboard', icon: 'fa-home', label: 'Dashboard' },
    { path: '/my-expenses', icon: 'fa-list', label: 'My Expenses' },
    { path: '/submit-expense', icon: 'fa-plus-circle', label: 'New Expense', highlight: true },
  ]

  const managedDepartments = user?.managed_departments || []

  const managerItems = [
    // Approvals tab hidden - all expenses are auto-approved
    { path: '/admin/departments', icon: 'fa-sitemap', label: 'My Departments' },
    { path: '/manager/expense-history', icon: 'fa-history', label: 'Department Expenses' },
  ]

  const hrItems = [
    { path: '/hr', icon: 'fa-heart', label: 'HR Welfare' },
  ]

  const adminItems = [
    { path: '/admin', icon: 'fa-chart-line', label: 'Analytics' },
    { path: '/admin/expense-history', icon: 'fa-history', label: 'Expense History' },
    { path: '/admin/departments', icon: 'fa-sitemap', label: 'Organization' },
    { path: '/admin/users', icon: 'fa-users', label: 'Users' },
    { path: '/admin/suppliers', icon: 'fa-building', label: 'Suppliers' },
    { path: '/admin/credit-cards', icon: 'fa-credit-card', label: 'Credit Cards' },
    { path: '/admin/accounting', icon: 'fa-calculator', label: 'Accounting' },
    { path: '/hr', icon: 'fa-heart', label: 'HR Welfare' },
  ]

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && <div className="sidebar-overlay" onClick={onToggle}></div>}

      <aside className={`sidebar ${isOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
        {/* Logo Section */}
        <div className="sidebar-header">
          {isOpen ? (
            <>
              <div className="sidebar-logo" onClick={() => navigate('/dashboard')}>
                <img
                  src="/static/images/labos-logo.svg"
                  alt="Labos"
                  className="sidebar-logo-image"
                />
              </div>
              <button className="sidebar-toggle" onClick={onToggle} title="Collapse menu">
                <i className="fas fa-chevron-left"></i>
              </button>
            </>
          ) : (
            <button className="sidebar-toggle expand-btn" onClick={onToggle} title="Expand menu">
              <i className="fas fa-chevron-right"></i>
            </button>
          )}
        </div>

        {/* Main Navigation */}
        <nav className="sidebar-nav">
          <div className="nav-section">
            {navItems.map(item => (
              <button
                key={item.path}
                className={`nav-item ${isActive(item.path) ? 'active' : ''} ${item.highlight ? 'highlight' : ''}`}
                onClick={() => navigate(item.path)}
                title={!isOpen ? item.label : ''}
              >
                <i className={`fas ${item.icon}`}></i>
                {isOpen && <span>{item.label}</span>}
              </button>
            ))}
          </div>

          {/* Manager Section - Only for managers who are not admins */}
          {(user?.is_manager && !user?.is_admin) && (
            <div className="nav-section">
              {isOpen && <div className="nav-section-title">Management</div>}
              {managedDepartments.length > 0 && (
                <div className="dept-list">
                  {managedDepartments.map(dept => (
                    <button
                      key={dept.id}
                      className="nav-item dept-item"
                      onClick={() => navigate('/admin/departments')}
                      title={!isOpen ? dept.name : ''}
                    >
                      <i className="fas fa-building"></i>
                      {isOpen && <span>{dept.name}</span>}
                    </button>
                  ))}
                </div>
              )}
              {managerItems.map(item => (
                <button
                  key={item.path}
                  className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                  onClick={() => navigate(item.path)}
                  title={!isOpen ? item.label : ''}
                >
                  <i className={`fas ${item.icon}`}></i>
                  {isOpen && <span>{item.label}</span>}
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </button>
              ))}
            </div>
          )}

          {/* HR Section - Only for HR users who are not admins */}
          {(user?.is_hr && !user?.is_admin) && (
            <div className="nav-section">
              {isOpen && <div className="nav-section-title">HR</div>}
              {hrItems.map(item => (
                <button
                  key={item.path}
                  className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                  onClick={() => navigate(item.path)}
                  title={!isOpen ? item.label : ''}
                >
                  <i className={`fas ${item.icon}`}></i>
                  {isOpen && <span>{item.label}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Admin Section */}
          {user?.is_admin && (
            <div className="nav-section">
              {isOpen && <div className="nav-section-title">Admin</div>}
              {adminItems.map(item => (
                <button
                  key={item.path}
                  className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                  onClick={() => item.external ? window.location.href = item.path : navigate(item.path)}
                  title={!isOpen ? item.label : ''}
                >
                  <i className={`fas ${item.icon}`}></i>
                  {isOpen && <span>{item.label}</span>}
                </button>
              ))}
            </div>
          )}
        </nav>

        {/* User Section at Bottom */}
        <div className="sidebar-footer">
          <div className="user-section">
            <div className="user-avatar" style={user?.profile_pic ? { padding: 0, overflow: 'hidden' } : {}}>
              {user?.profile_pic ? (
                <img
                  src={user.profile_pic}
                  alt={`${user.first_name} ${user.last_name}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span>{user?.first_name?.[0]}{user?.last_name?.[0]}</span>
              )}
            </div>
            {isOpen && (
              <div className="user-info">
                <div className="user-name">{user?.first_name} {user?.last_name}</div>
                <div className="user-role">
                  {{ admin: 'Admin', manager: 'Manager', hr: 'HR', accounting: 'Accounting' }[user?.role] || 'Employee'}
                </div>
              </div>
            )}
          </div>
          <button
            className="nav-item"
            onClick={switchToLegacy}
            title={!isOpen ? 'Switch to Legacy UI' : ''}
          >
            <i className="fas fa-exchange-alt"></i>
            {isOpen && <span>Switch to Legacy</span>}
          </button>
          <button
            className="nav-item logout-btn"
            onClick={handleLogout}
            title={!isOpen ? 'Logout' : ''}
          >
            <i className="fas fa-sign-out-alt"></i>
            {isOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
