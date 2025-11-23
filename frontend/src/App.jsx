import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SubmitExpense from './pages/SubmitExpense'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is authenticated
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/v1/auth/me', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route
          path="/dashboard"
          element={user ? <Dashboard user={user} setUser={setUser} /> : <Navigate to="/login" />}
        />
        <Route
          path="/submit-expense"
          element={user ? <SubmitExpense user={user} /> : <Navigate to="/login" />}
        />
        <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
      </Routes>
    </Router>
  )
}

export default App
