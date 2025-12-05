import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import './Settings.css'

function Settings({ user, setUser }) {
  const navigate = useNavigate()
  
  // Profile form
  const [profileData, setProfileData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || ''
  })
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')

  // Password form
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // Version preference
  const [versionLoading, setVersionLoading] = useState(false)

  const handleProfileChange = (e) => {
    const { name, value } = e.target
    setProfileData(prev => ({ ...prev, [name]: value }))
    setProfileSuccess('')
    setProfileError('')
  }

  const handlePasswordChange = (e) => {
    const { name, value } = e.target
    setPasswordData(prev => ({ ...prev, [name]: value }))
    setPasswordSuccess('')
    setPasswordError('')
  }

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setProfileLoading(true)
    setProfileError('')
    setProfileSuccess('')

    try {
      const res = await fetch('/api/v1/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(profileData)
      })

      if (res.ok) {
        const data = await res.json()
        setUser(prev => ({ ...prev, ...data.user }))
        setProfileSuccess('Profile updated successfully!')
      } else {
        const data = await res.json()
        setProfileError(data.error || 'Failed to update profile')
      }
    } catch (err) {
      setProfileError('An error occurred')
    } finally {
      setProfileLoading(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPasswordLoading(true)
    setPasswordError('')
    setPasswordSuccess('')

    try {
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(passwordData)
      })

      if (res.ok) {
        setPasswordSuccess('Password changed successfully!')
        setPasswordData({
          current_password: '',
          new_password: '',
          confirm_password: ''
        })
      } else {
        const data = await res.json()
        setPasswordError(data.error || 'Failed to change password')
      }
    } catch (err) {
      setPasswordError('An error occurred')
    } finally {
      setPasswordLoading(false)
    }
  }

  const switchToLegacy = async () => {
    setVersionLoading(true)
    try {
      await fetch('/api/v1/auth/set-version-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ version: 'legacy' })
      })
      window.location.href = '/'
    } catch (err) {
      console.error('Failed to switch version')
    } finally {
      setVersionLoading(false)
    }
  }

  const getRoleBadges = () => {
    const badges = []
    if (user?.is_admin) badges.push(<span key="admin" className="role-badge admin">Administrator</span>)
    if (user?.is_manager) badges.push(<span key="manager" className="role-badge manager">Manager</span>)
    if (user?.is_accounting) badges.push(<span key="accounting" className="role-badge accounting">Accounting</span>)
    if (badges.length === 0) badges.push(<span key="employee" className="role-badge employee">Employee</span>)
    return badges
  }

  return (
    <div className="settings-container">
      <Header user={user} setUser={setUser} currentPage="settings" />

      <main className="settings-main">
        <div className="page-header">
          <h1>Settings</h1>
          <p className="subtitle">Manage your account settings and preferences</p>
        </div>

        <div className="settings-grid">
          {/* Profile Section */}
          <section className="settings-section card">
            <div className="section-header">
              <div className="section-icon"><i className="fas fa-user"></i></div>
              <div>
                <h2>Profile Information</h2>
                <p>Update your personal details</p>
              </div>
            </div>

            <div className="profile-overview">
              <div className="avatar-large">
                {(user?.first_name?.[0] || user?.username?.[0] || '?').toUpperCase()}
              </div>
              <div className="profile-details">
                <h3>{user?.first_name} {user?.last_name}</h3>
                <p className="username">@{user?.username}</p>
                <div className="roles">{getRoleBadges()}</div>
              </div>
            </div>

            <form onSubmit={handleProfileSubmit} className="settings-form">
              {profileSuccess && <div className="alert success">{profileSuccess}</div>}
              {profileError && <div className="alert error">{profileError}</div>}
              
              <div className="form-row">
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    name="first_name"
                    value={profileData.first_name}
                    onChange={handleProfileChange}
                    placeholder="Enter first name"
                  />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    name="last_name"
                    value={profileData.last_name}
                    onChange={handleProfileChange}
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={profileData.email}
                  onChange={handleProfileChange}
                  placeholder="Enter email"
                />
              </div>

              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={user?.username || ''}
                  disabled
                  className="disabled"
                />
                <span className="helper-text">Username cannot be changed</span>
              </div>

              <button type="submit" className="btn-primary" disabled={profileLoading}>
                {profileLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </section>

          {/* Password Section */}
          <section className="settings-section card">
            <div className="section-header">
              <div className="section-icon"><i className="fas fa-lock"></i></div>
              <div>
                <h2>Change Password</h2>
                <p>Update your account password</p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="settings-form">
              {passwordSuccess && <div className="alert success">{passwordSuccess}</div>}
              {passwordError && <div className="alert error">{passwordError}</div>}

              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  name="current_password"
                  value={passwordData.current_password}
                  onChange={handlePasswordChange}
                  placeholder="Enter current password"
                  required
                />
              </div>

              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  name="new_password"
                  value={passwordData.new_password}
                  onChange={handlePasswordChange}
                  placeholder="Enter new password"
                  minLength={6}
                  required
                />
              </div>

              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  name="confirm_password"
                  value={passwordData.confirm_password}
                  onChange={handlePasswordChange}
                  placeholder="Confirm new password"
                  minLength={6}
                  required
                />
              </div>

              <button type="submit" className="btn-primary" disabled={passwordLoading}>
                {passwordLoading ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </section>

          {/* Preferences Section */}
          <section className="settings-section card">
            <div className="section-header">
              <div className="section-icon"><i className="fas fa-cog"></i></div>
              <div>
                <h2>Preferences</h2>
                <p>Customize your experience</p>
              </div>
            </div>

            <div className="preference-item">
              <div className="preference-info">
                <h4>User Interface Version</h4>
                <p>You are currently using the <strong>Modern UI</strong></p>
              </div>
              <button 
                className="btn-secondary"
                onClick={switchToLegacy}
                disabled={versionLoading}
              >
                <i className="fas fa-exchange-alt"></i>
                {versionLoading ? 'Switching...' : 'Switch to Legacy'}
              </button>
            </div>

            <div className="preference-item">
              <div className="preference-info">
                <h4>Department</h4>
                <p>{user?.department_name || 'No department assigned'}</p>
              </div>
            </div>

            <div className="preference-item">
              <div className="preference-info">
                <h4>Account Status</h4>
                <span className="status-badge active">Active</span>
              </div>
            </div>
          </section>

          {/* Quick Links */}
          <section className="settings-section card">
            <div className="section-header">
              <div className="section-icon"><i className="fas fa-link"></i></div>
              <div>
                <h2>Quick Links</h2>
                <p>Shortcuts to common actions</p>
              </div>
            </div>

            <div className="quick-links">
              <button className="quick-link" onClick={() => navigate('/submit-expense')}>
                <i className="fas fa-plus-circle"></i>
                <span>Submit Expense</span>
              </button>
              <button className="quick-link" onClick={() => navigate('/my-expenses')}>
                <i className="fas fa-list"></i>
                <span>View My Expenses</span>
              </button>
              {(user?.is_manager || user?.is_admin) && (
                <button className="quick-link" onClick={() => navigate('/approvals')}>
                  <i className="fas fa-clipboard-check"></i>
                  <span>Pending Approvals</span>
                </button>
              )}
              {user?.is_admin && (
                <button className="quick-link" onClick={() => navigate('/admin')}>
                  <i className="fas fa-chart-line"></i>
                  <span>Admin Dashboard</span>
                </button>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export default Settings
