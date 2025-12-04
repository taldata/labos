import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Login.css'

function Login({ setUser }) {
  const [loginMethod, setLoginMethod] = useState('username') // 'username' or 'azure'
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/v1/auth/me', {
          credentials: 'include'
        })
        if (response.ok) {
          const data = await response.json()
          if (data.user) {
            setUser(data.user)
            navigate('/dashboard')
          }
        }
      } catch (error) {
        // User not authenticated, stay on login page
        console.error('Auth check failed:', error)
      }
    }
    checkAuth()
  }, [navigate, setUser])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleUsernameLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        setUser(data.user)
        navigate('/dashboard')
      } else {
        setError(data.error || 'Login failed')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
      console.error('Login error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAzureLogin = async () => {
    setLoading(true)
    setError('')

    try {
      // Redirect to Azure AD login
      window.location.href = '/api/v1/auth/login/azure'
    } catch (err) {
      setError('Failed to initiate Azure login')
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card card">
        <div className="login-header">
          <h1>Labos Expense Management</h1>
          <p>Modern Version - Beta</p>
        </div>

        <div className="login-body">
          {/* Login Method Toggle */}
          <div className="login-method-toggle">
            <button
              className={`toggle-btn ${loginMethod === 'username' ? 'active' : ''}`}
              onClick={() => {
                setLoginMethod('username')
                setError('')
              }}
              type="button"
            >
              <i className="fas fa-user"></i>
              Username & Password
            </button>
            <button
              className={`toggle-btn ${loginMethod === 'azure' ? 'active' : ''}`}
              onClick={() => {
                setLoginMethod('azure')
                setError('')
              }}
              type="button"
            >
              <i className="fab fa-microsoft"></i>
              Microsoft Azure AD
            </button>
          </div>

          {error && (
            <div className="error-message">
              <i className="fas fa-exclamation-circle"></i>
              {error}
            </div>
          )}

          {/* Username/Password Login */}
          {loginMethod === 'username' && (
            <form onSubmit={handleUsernameLogin} className="username-login-form">
              <p className="login-description">
                Sign in with your username and password.
              </p>

              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Enter your username"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-primary login-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="spinner-small"></div>
                    Signing in...
                  </>
                ) : (
                  <>
                    <i className="fas fa-sign-in-alt"></i>
                    Sign In
                  </>
                )}
              </button>
            </form>
          )}

          {/* Azure AD Login */}
          {loginMethod === 'azure' && (
            <div className="azure-login-section">
              <p className="login-description">
                Sign in with your Microsoft account to access the modern expense management system.
              </p>

              <button
                className="btn-primary azure-login-btn"
                onClick={handleAzureLogin}
                disabled={loading}
                type="button"
              >
                {loading ? (
                  <>
                    <div className="spinner-small"></div>
                    Signing in...
                  </>
                ) : (
                  <>
                    <svg className="microsoft-icon" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                      <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                    </svg>
                    Sign in with Microsoft
                  </>
                )}
              </button>
            </div>
          )}

          <div className="login-footer">
            <a href="/" className="back-link">
              <i className="fas fa-arrow-left"></i> Back to legacy version
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
