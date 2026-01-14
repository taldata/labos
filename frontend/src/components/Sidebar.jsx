import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './Sidebar.css'

function Sidebar({ user, setUser, isOpen, onToggle }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (user?.is_manager || user?.is_admin) {
      fetchPendingCount()
    }
  }, [user])

  const fetchPendingCount = async () => {
    try {
      const res = await fetch('/api/v1/expenses/pending-count', {
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        setPendingCount(data.count || 0)
      }
    } catch (err) {
      console.error('Failed to fetch pending count')
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

  const isActive = (path) => location.pathname === path

  const navItems = [
    { path: '/dashboard', icon: 'fa-home', label: 'Dashboard' },
    { path: '/my-expenses', icon: 'fa-list', label: 'My Expenses' },
    { path: '/submit-expense', icon: 'fa-plus-circle', label: 'New Expense', highlight: true },
  ]

  const managerItems = [
    { 
      path: '/approvals', 
      icon: 'fa-clipboard-check', 
      label: 'Approvals',
      badge: pendingCount > 0 ? pendingCount : null 
    },
    { path: '/reports', icon: 'fa-chart-bar', label: 'Reports' },
  ]

  const adminItems = [
    { path: '/admin', icon: 'fa-chart-line', label: 'Analytics' },
    { path: '/admin/expense-history', icon: 'fa-history', label: 'Expense History' },
    { path: '/admin/departments', icon: 'fa-sitemap', label: 'Organization' },
    { path: '/admin/users', icon: 'fa-users', label: 'Users' },
    { path: '/admin/suppliers', icon: 'fa-building', label: 'Suppliers' },
    { path: '/admin/credit-cards', icon: 'fa-credit-card', label: 'Credit Cards' },
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
                  src="https://budget-management-app-noxf.onrender.com/static/images/labos-logo.svg"
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

          {/* Manager Section */}
          {(user?.is_manager || user?.is_admin) && (
            <div className="nav-section">
              {isOpen && <div className="nav-section-title">Management</div>}
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

          {/* Admin Section */}
          {user?.is_admin && (
            <div className="nav-section">
              {isOpen && <div className="nav-section-title">Admin</div>}
              {adminItems.map(item => (
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
        </nav>

        {/* User Section at Bottom */}
        <div className="sidebar-footer">
          <div className="user-section">
            <div className="user-avatar">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            {isOpen && (
              <div className="user-info">
                <div className="user-name">{user?.first_name} {user?.last_name}</div>
                <div className="user-role">
                  {user?.is_admin ? 'Admin' : user?.is_manager ? 'Manager' : 'Employee'}
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
