import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Input, Badge, useToast, PageHeader } from '../components/ui'
import './Settings.css'

function Settings({ user, setUser }) {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()

  // Profile form
  const [profileData, setProfileData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || ''
  })
  const [profileLoading, setProfileLoading] = useState(false)

  // Password form
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [passwordLoading, setPasswordLoading] = useState(false)

  // Version preference
  const [versionLoading, setVersionLoading] = useState(false)

  const handleProfileChange = (e) => {
    const { name, value } = e.target
    setProfileData(prev => ({ ...prev, [name]: value }))
  }

  const handlePasswordChange = (e) => {
    const { name, value } = e.target
    setPasswordData(prev => ({ ...prev, [name]: value }))
  }

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setProfileLoading(true)

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
        success('Profile updated successfully!')
      } else {
        const data = await res.json()
        showError(data.error || 'Failed to update profile')
      }
    } catch (err) {
      showError('An error occurred while updating profile')
    } finally {
      setProfileLoading(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()

    if (passwordData.new_password !== passwordData.confirm_password) {
      showError('New passwords do not match')
      return
    }

    setPasswordLoading(true)

    try {
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(passwordData)
      })

      if (res.ok) {
        success('Password changed successfully!')
        setPasswordData({
          current_password: '',
          new_password: '',
          confirm_password: ''
        })
      } else {
        const data = await res.json()
        showError(data.error || 'Failed to change password')
      }
    } catch (err) {
      showError('An error occurred while changing password')
    } finally {
      setPasswordLoading(false)
    }
  }

  const switchToLegacy = async () => {
    setVersionLoading(true)
    try {
      const response = await fetch('/api/v1/auth/set-version-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ version: 'legacy' })
      })
      if (response.ok) {
        window.location.href = '/'
      } else {
        showError('Failed to switch version')
        setVersionLoading(false)
      }
    } catch (err) {
      showError('Failed to switch version')
      setVersionLoading(false)
    }
  }

  const getRoleBadges = () => {
    const badges = []
    if (user?.is_admin) badges.push(<Badge key="admin" variant="danger" size="small">Administrator</Badge>)
    if (user?.is_manager) badges.push(<Badge key="manager" variant="warning" size="small">Manager</Badge>)
    if (user?.is_accounting) badges.push(<Badge key="accounting" variant="info" size="small">Accounting</Badge>)
    if (badges.length === 0) badges.push(<Badge key="employee" variant="default" size="small">Employee</Badge>)
    return badges
  }

  return (
    <div className="settings-container">

      <main className="settings-main">
        <PageHeader
          title="Settings"
          subtitle="Manage your account settings and preferences"
          icon="fas fa-cog"
          variant="teal"
        />

        <div className="settings-grid">
          {/* Profile Section */}
          <Card className="settings-section">
            <Card.Header>
              <div className="section-header-content">
                <div className="section-icon"><i className="fas fa-user"></i></div>
                <div>
                  <h2>Profile Information</h2>
                  <p>Update your personal details</p>
                </div>
              </div>
            </Card.Header>
            <Card.Body>
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
                <div className="form-row">
                  <Input
                    label="First Name"
                    name="first_name"
                    value={profileData.first_name}
                    onChange={handleProfileChange}
                    placeholder="Enter first name"
                  />
                  <Input
                    label="Last Name"
                    name="last_name"
                    value={profileData.last_name}
                    onChange={handleProfileChange}
                    placeholder="Enter last name"
                  />
                </div>

                <Input
                  label="Email Address"
                  type="email"
                  name="email"
                  value={profileData.email}
                  onChange={handleProfileChange}
                  placeholder="Enter email"
                  icon="fas fa-envelope"
                />

                <Input
                  label="Username"
                  value={user?.username || ''}
                  disabled
                  helperText="Username cannot be changed"
                  icon="fas fa-at"
                />

                <Button type="submit" variant="primary" loading={profileLoading}>
                  Save Changes
                </Button>
              </form>
            </Card.Body>
          </Card>

          {/* Password Section */}
          <Card className="settings-section">
            <Card.Header>
              <div className="section-header-content">
                <div className="section-icon"><i className="fas fa-lock"></i></div>
                <div>
                  <h2>Change Password</h2>
                  <p>Update your account password</p>
                </div>
              </div>
            </Card.Header>
            <Card.Body>
              <form onSubmit={handlePasswordSubmit} className="settings-form">
                <Input
                  type="password"
                  label="Current Password"
                  name="current_password"
                  value={passwordData.current_password}
                  onChange={handlePasswordChange}
                  placeholder="Enter current password"
                  required
                  icon="fas fa-key"
                />

                <Input
                  type="password"
                  label="New Password"
                  name="new_password"
                  value={passwordData.new_password}
                  onChange={handlePasswordChange}
                  placeholder="Enter new password"
                  required
                  helperText="Minimum 6 characters"
                />

                <Input
                  type="password"
                  label="Confirm New Password"
                  name="confirm_password"
                  value={passwordData.confirm_password}
                  onChange={handlePasswordChange}
                  placeholder="Confirm new password"
                  required
                />

                <Button type="submit" variant="primary" loading={passwordLoading}>
                  Change Password
                </Button>
              </form>
            </Card.Body>
          </Card>

          {/* Preferences Section */}
          <Card className="settings-section">
            <Card.Header>
              <div className="section-header-content">
                <div className="section-icon"><i className="fas fa-cog"></i></div>
                <div>
                  <h2>Preferences</h2>
                  <p>Customize your experience</p>
                </div>
              </div>
            </Card.Header>
            <Card.Body>
              <div className="preference-item">
                <div className="preference-info">
                  <h4>User Interface Version</h4>
                  <p>You are currently using the <strong>Modern UI</strong></p>
                </div>
                <Button
                  variant="secondary"
                  icon="fas fa-exchange-alt"
                  onClick={switchToLegacy}
                  loading={versionLoading}
                >
                  Switch to Legacy
                </Button>
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
                  <Badge variant="success" size="small">Active</Badge>
                </div>
              </div>
            </Card.Body>
          </Card>

          {/* Quick Links */}
          <Card className="settings-section">
            <Card.Header>
              <div className="section-header-content">
                <div className="section-icon"><i className="fas fa-link"></i></div>
                <div>
                  <h2>Quick Links</h2>
                  <p>Shortcuts to common actions</p>
                </div>
              </div>
            </Card.Header>
            <Card.Body>
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
            </Card.Body>
          </Card>
        </div>
      </main>
    </div>
  )
}

export default Settings
