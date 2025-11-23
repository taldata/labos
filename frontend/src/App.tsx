import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuthStore } from './hooks/useAuthStore'

// Pages (to be created)
import LoginPage from './pages/LoginPage'
import EmployeeDashboard from './pages/EmployeeDashboard'
import ManagerDashboard from './pages/ManagerDashboard'
import AdminDashboard from './pages/AdminDashboard'
import AccountingDashboard from './pages/AccountingDashboard'
import SubmitExpense from './pages/SubmitExpense'
import ExpenseHistory from './pages/ExpenseHistory'
import ManageDepartments from './pages/ManageDepartments'
import ManageUsers from './pages/ManageUsers'
import ManageSuppliers from './pages/ManageSuppliers'
import Layout from './components/Layout'

function App() {
  const { user, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" replace />} />

        {!user ? (
          <Route path="*" element={<Navigate to="/login" replace />} />
        ) : (
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Employee Routes */}
            <Route path="/dashboard" element={<EmployeeDashboard />} />
            <Route path="/submit-expense" element={<SubmitExpense />} />
            <Route path="/expense/edit/:id" element={<SubmitExpense />} />
            <Route path="/history" element={<ExpenseHistory />} />

            {/* Manager Routes */}
            {user.is_manager && (
              <>
                <Route path="/manager/dashboard" element={<ManagerDashboard />} />
                <Route path="/manager/departments" element={<ManageDepartments />} />
              </>
            )}

            {/* Admin Routes */}
            {user.is_admin && (
              <>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<ManageUsers />} />
                <Route path="/admin/suppliers" element={<ManageSuppliers />} />
              </>
            )}

            {/* Accounting Routes */}
            {user.is_accounting && (
              <>
                <Route path="/accounting/dashboard" element={<AccountingDashboard />} />
              </>
            )}

            {/* 404 */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        )}
      </Routes>
    </>
  )
}

export default App
