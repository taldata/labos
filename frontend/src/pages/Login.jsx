import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Input, useToast } from '../components/ui'
import './Login.css'

function Login({ setUser }) {
  const [loginMethod, setLoginMethod] = useState('username')
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { error: showError } = useToast()

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
    setError('')
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
      window.location.href = '/api/v1/auth/login/azure'
    } catch (err) {
      showError('Failed to initiate Azure login')
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <Card className="login-card">
        <Card.Body>
          <div className="login-header">
            <div className="logo-icon">
              <i className="fas fa-receipt"></i>
            </div>
            <h1>Labos</h1>
            <p className="tagline">Expense Management System</p>
          </div>

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
              <span>Username</span>
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
              <span>Microsoft</span>
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
            <form onSubmit={handleUsernameLogin} className="login-form">
              {/* Dev Mode Hint */}
              {import.meta.env.DEV && (
                <div className="dev-hint">
                  <i className="fas fa-flask"></i>
                  <span>Dev Mode: Use password "dev" for any user</span>
                </div>
              )}

              <Input
                label="Username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Enter your username"
                required
                autoFocus
                icon="fas fa-user"
              />

              <Input
                type="password"
                label="Password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
                required
                icon="fas fa-lock"
              />

              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={loading}
                icon={loading ? null : "fas fa-sign-in-alt"}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          )}

          {/* Azure AD Login */}
          {loginMethod === 'azure' && (
            <div className="azure-login-section">
              <p className="login-description">
                Sign in with your Microsoft account to access the expense management system.
              </p>

              <Button
                variant="primary"
                fullWidth
                onClick={handleAzureLogin}
                loading={loading}
                className="azure-btn"
              >
                {loading ? (
                  'Signing in...'
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
              </Button>
            </div>
          )}

          <div className="login-footer">
            <a href="/" className="back-link">
              <i className="fas fa-arrow-left"></i>
              <span>Back to legacy version</span>
            </a>
          </div>
        </Card.Body>
      </Card>

      <p className="copyright">Modern UI Version</p>
    </div>
  )
}

export default Login
