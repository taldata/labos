import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { ToastProvider } from './components/ui'
import ErrorBoundary from './components/ErrorBoundary'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import logger from './utils/logger'
import './App.css'

// Lazy load pages for better performance
const Dashboard = lazy(() => import('./pages/Dashboard'))
const SubmitExpense = lazy(() => import('./pages/SubmitExpense'))
const MyExpenses = lazy(() => import('./pages/MyExpenses'))
const ExpenseDetails = lazy(() => import('./pages/ExpenseDetails'))
const DepartmentManager = lazy(() => import('./pages/DepartmentManager'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const UserManagement = lazy(() => import('./pages/UserManagement'))
const Settings = lazy(() => import('./pages/Settings'))
const SupplierManagement = lazy(() => import('./pages/SupplierManagement'))
const CreditCardManagement = lazy(() => import('./pages/CreditCardManagement'))
const ExpenseHistory = lazy(() => import('./pages/ExpenseHistory'))
const AccountingDashboard = lazy(() => import('./pages/AccountingDashboard'))
const HRDashboard = lazy(() => import('./pages/HRDashboard'))
const NotFound = lazy(() => import('./pages/NotFound'))

// Loading fallback component
function PageLoader() {
  return (
    <div className="page-loader">
      <div className="spinner"></div>
      <p>Loading...</p>
    </div>
  )
}

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

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/auth/me', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      }
    } catch (error) {
      logger.error('Auth check failed', { error: error.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Check if user is authenticated
    checkAuth()
  }, [checkAuth])

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <Router basename="/modern">
          <Suspense fallback={<PageLoader />}>
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
                path="/manager/expense-history"
                element={<AuthenticatedRoute user={user} setUser={setUser}><ExpenseHistory user={user} setUser={setUser} isManagerView={true} /></AuthenticatedRoute>}
              />
              <Route
                path="/admin/accounting"
                element={<AuthenticatedRoute user={user} setUser={setUser}><AccountingDashboard user={user} setUser={setUser} /></AuthenticatedRoute>}
              />
              <Route
                path="/hr"
                element={<AuthenticatedRoute user={user} setUser={setUser}><HRDashboard user={user} setUser={setUser} /></AuthenticatedRoute>}
              />
              <Route
                path="/admin/expense-history"
                element={<AuthenticatedRoute user={user} setUser={setUser}><ExpenseHistory user={user} setUser={setUser} /></AuthenticatedRoute>}
              />
              <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App

