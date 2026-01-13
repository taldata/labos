import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button } from '../components/ui'
import './Login.css'

function Login({ setUser }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

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
              loading={loading}
              className="azure-btn"
            >
              {loading ? (
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
