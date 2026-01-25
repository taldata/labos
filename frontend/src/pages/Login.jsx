import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Input } from '../components/ui'
import logger from '../utils/logger'
import './Login.css'

// Check if we're in development mode
const isDev = import.meta.env.DEV || window.location.hostname === 'localhost'

function Login({ setUser }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDevLogin, setShowDevLogin] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()
  const isMountedRef = useRef(true)

  const checkAuth = useCallback(async (signal) => {
    try {
      const response = await fetch('/api/v1/auth/me', {
        credentials: 'include',
        signal
      })
      if (response.ok) {
        const data = await response.json()
        if (data.user && isMountedRef.current) {
          setUser(data.user)
          navigate('/dashboard')
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') return
      logger.error('Auth check failed', { error: error.message })
    }
  }, [navigate, setUser])

  useEffect(() => {
    isMountedRef.current = true
    const abortController = new AbortController()
    checkAuth(abortController.signal)
    
    return () => {
      isMountedRef.current = false
      abortController.abort()
    }
  }, [checkAuth])


  const handleAzureLogin = async () => {
    setLoading(true)
    setError('')

    try {
      window.location.href = '/api/v1/auth/login/azure'
    } catch (err) {
      setError('Failed to initiate Microsoft login')
      setLoading(false)
    }
  }

  const handleDevLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (response.ok && data.user) {
        setUser(data.user)
        navigate('/dashboard')
      } else {
        setError(data.error || 'Login failed')
      }
    } catch (err) {
      setError('Failed to login. Please try again.')
      logger.error('Dev login failed', { error: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <Card className="login-card">
        <Card.Body>
          <div className="login-header">
            <img
              src="/static/images/labos-logo.svg"
              alt="Labos"
              className="login-logo-image"
            />
            <p className="tagline">Expense Management System</p>
          </div>

          {error && (
            <div className="error-message">
              <i className="fas fa-exclamation-circle"></i>
              {error}
            </div>
          )}

          {/* Microsoft SSO Login */}
          <div className="azure-login-section">
            <p className="login-description">
              Sign in with your Microsoft account to access the expense management system.
            </p>

            <Button
              variant="primary"
              fullWidth
              onClick={handleAzureLogin}
              loading={loading && !showDevLogin}
              className="azure-btn"
            >
              {loading && !showDevLogin ? (
                'Signing in...'
              ) : (
                <>
                  <svg className="microsoft-icon" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                  </svg>
                  Sign in with Microsoft
                </>
              )}
            </Button>
          </div>

          {/* Dev Login Section */}
          {isDev && (
            <div className="dev-login-section">
              <div className="dev-divider">
                <span>or</span>
              </div>

              {!showDevLogin ? (
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => setShowDevLogin(true)}
                  className="dev-toggle-btn"
                >
                  <i className="fas fa-code"></i>
                  Dev Login
                </Button>
              ) : (
                <form onSubmit={handleDevLogin} className="dev-login-form">
                  <Input
                    label="Username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    required
                  />
                  <Input
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password (use 'dev' in dev mode)"
                    required
                  />
                  <div className="dev-login-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowDevLogin(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      loading={loading}
                    >
                      Login
                    </Button>
                  </div>
                  <p className="dev-hint">
                    <i className="fas fa-info-circle"></i>
                    Use password "dev" for any user in development mode
                  </p>
                </form>
              )}
            </div>
          )}

        </Card.Body>
      </Card>

      <p className="copyright">Modern UI Version {isDev && '(Dev Mode)'}</p>
    </div>
  )
}

export default Login
