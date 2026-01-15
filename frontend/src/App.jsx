import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ToastProvider } from './components/ui'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SubmitExpense from './pages/SubmitExpense'
import MyExpenses from './pages/MyExpenses'
import Approvals from './pages/Approvals'
import ExpenseDetails from './pages/ExpenseDetails'
import DepartmentManager from './pages/DepartmentManager'
import AdminDashboard from './pages/AdminDashboard'
import UserManagement from './pages/UserManagement'
import Settings from './pages/Settings'
import SupplierManagement from './pages/SupplierManagement'
import CreditCardManagement from './pages/CreditCardManagement'

import ExpenseHistory from './pages/ExpenseHistory'
import './App.css'

// Wrapper component for authenticated routes with sidebar
function AuthenticatedRoute({ user, setUser, children }) {
  if (!user) return <Navigate to="/login" />
  return (
    <AppLayout user={user} setUser={setUser}>
      {children}
    </AppLayout>
  )
}

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
    <ToastProvider>
      <Router basename="/modern">
        <Routes>
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route
          path="/dashboard"
          element={<AuthenticatedRoute user={user} setUser={setUser}><Dashboard user={user} setUser={setUser} /></AuthenticatedRoute>}
        />
        <Route
          path="/submit-expense"
          element={<AuthenticatedRoute user={user} setUser={setUser}><SubmitExpense user={user} setUser={setUser} /></AuthenticatedRoute>}
        />
        <Route
          path="/my-expenses"
          element={<AuthenticatedRoute user={user} setUser={setUser}><MyExpenses user={user} setUser={setUser} /></AuthenticatedRoute>}
        />
        <Route
          path="/approvals"
          element={<AuthenticatedRoute user={user} setUser={setUser}><Approvals user={user} setUser={setUser} /></AuthenticatedRoute>}
        />
        <Route
          path="/expenses/:id"
          element={<AuthenticatedRoute user={user} setUser={setUser}><ExpenseDetails user={user} setUser={setUser} /></AuthenticatedRoute>}
        />
        <Route
          path="/admin/departments"
          element={<AuthenticatedRoute user={user} setUser={setUser}><DepartmentManager user={user} setUser={setUser} /></AuthenticatedRoute>}
        />
        <Route
          path="/admin/users"
          element={<AuthenticatedRoute user={user} setUser={setUser}><UserManagement user={user} setUser={setUser} /></AuthenticatedRoute>}
        />
        <Route
          path="/admin"
          element={<AuthenticatedRoute user={user} setUser={setUser}><AdminDashboard user={user} setUser={setUser} /></AuthenticatedRoute>}
        />
        <Route
          path="/settings"
          element={<AuthenticatedRoute user={user} setUser={setUser}><Settings user={user} setUser={setUser} /></AuthenticatedRoute>}
        />
        <Route
          path="/admin/suppliers"
          element={<AuthenticatedRoute user={user} setUser={setUser}><SupplierManagement user={user} setUser={setUser} /></AuthenticatedRoute>}
        />
        <Route
          path="/admin/credit-cards"
          element={<AuthenticatedRoute user={user} setUser={setUser}><CreditCardManagement user={user} setUser={setUser} /></AuthenticatedRoute>}
        />

        <Route
          path="/admin/expense-history"
          element={<AuthenticatedRoute user={user} setUser={setUser}><ExpenseHistory user={user} setUser={setUser} /></AuthenticatedRoute>}
        />
        <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
        </Routes>
      </Router>
    </ToastProvider>
  )
}

export default App

