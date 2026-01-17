
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button, Modal, useToast } from '../../components/ui'
import { useScrollToItem } from '../../hooks/useScrollToItem'
import logger from '../../utils/logger'
import ExpenseStats from './components/ExpenseStats'
import ExpenseFilters from './components/ExpenseFilters'
import ExpenseList from './components/ExpenseList'
import './styles.css'

function MyExpenses({ user, setUser }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { success, error: showError } = useToast()
  
  // Data State
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState([])
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalExpenses, setTotalExpenses] = useState(0)

  // Filters State
  const [filters, setFilters] = useState({
    status: '',
    category_id: '',
    search: '',
    start_date: '',
    end_date: '',
    sort_by: 'date',
    sort_order: 'desc'
  })
  const [showFilters, setShowFilters] = useState(false)

  // Delete State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [expenseToDelete, setExpenseToDelete] = useState(null)

  // Misc State
  const [newExpenseId, setNewExpenseId] = useState(location.state?.newExpenseId || null)
  const isMountedRef = useRef(true)

  // Auto-scroll hook
  const { getItemRef } = useScrollToItem(expenses, newExpenseId, () => setNewExpenseId(null))

  // Fetch Categories
  const fetchCategories = useCallback(async () => {
    const abortController = new AbortController()
    try {
      const response = await fetch('/api/v1/form-data/categories', {
        credentials: 'include',
        signal: abortController.signal
      })
      if (response.ok) {
        const data = await response.json()
        if (isMountedRef.current) {
          setCategories(data.categories)
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') return
      logger.error('Failed to fetch categories', { error: error.message })
    }
    return () => abortController.abort()
  }, [])

  // Fetch Expenses
  const fetchExpenses = useCallback(async () => {
    const abortController = new AbortController()
    try {
      setLoading(true)
      setError('')

      const params = new URLSearchParams({
        page: currentPage,
        per_page: 20,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== '')
        )
      })

      const response = await fetch(`/api/v1/expenses?${params}`, {
        credentials: 'include',
        signal: abortController.signal
      })

      if (response.ok) {
        const data = await response.json()
        if (isMountedRef.current) {
          setExpenses(data.expenses)
          setTotalPages(data.pagination.pages)
          setTotalExpenses(data.pagination.total)
        }
      } else {
        if (isMountedRef.current) {
          setError('Failed to load expenses')
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      if (isMountedRef.current) {
        setError('An error occurred while fetching expenses')
      }
      logger.error('Fetch error', { error: err.message })
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
    return () => abortController.abort()
  }, [currentPage, filters])

  // Initial Load
  useEffect(() => {
    isMountedRef.current = true
    const cleanupCategories = fetchCategories()
    return () => {
      cleanupCategories.then(fn => fn?.())
      isMountedRef.current = false
    }
  }, [fetchCategories])

  // Fetch on changes
  useEffect(() => {
    const cleanupExpenses = fetchExpenses()
    return () => {
      cleanupExpenses.then(fn => fn?.())
    }
  }, [fetchExpenses])

  // Handlers
  const handleClearFilters = () => {
    setFilters({
      status: '',
      category_id: '',
      search: '',
      start_date: '',
      end_date: '',
      sort_by: 'date',
      sort_order: 'desc'
    })
    setCurrentPage(1)
  }

  const handleDeleteClick = (e, expense) => {
    e.stopPropagation()
    setExpenseToDelete(expense)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    try {
      const res = await fetch(`/api/v1/admin/expenses/${expenseToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (res.ok) {
        success('Expense deleted successfully')
        setDeleteModalOpen(false)
        setExpenseToDelete(null)
        fetchExpenses()
      } else {
        const data = await res.json()
        showError(data.error || 'Failed to delete expense')
      }
    } catch (err) {
      showError('An error occurred')
    }
  }

  const activeFilterCount = [
    filters.status, 
    filters.category_id, 
    filters.search, 
    filters.start_date, 
    filters.end_date
  ].filter(Boolean).length

  const pagination = {
    current: currentPage,
    pages: totalPages,
    total: totalExpenses
  }

  return (
    <div className="me-container">
      {/* Header */}
      <header className="me-header">
        <div className="me-header__title">
          <h1>My Expenses</h1>
          <p className="me-header__subtitle">Manage and track your expense submissions</p>
        </div>
        <Button 
            variant="primary" 
            icon="fas fa-plus" 
            onClick={() => navigate('/submit-expense')}
            className="shadow-lg hover:shadow-xl transition-all"
        >
          New Expense
        </Button>
      </header>

      {/* Stats */}
      <ExpenseStats totalExpenses={totalExpenses} loading={loading} />

      {/* Filters */}
      <ExpenseFilters 
        filters={filters} 
        setFilters={setFilters} 
        categories={categories}
        onClearFilters={handleClearFilters}
        isOpen={showFilters}
        setIsOpen={setShowFilters}
        activeFilterCount={activeFilterCount}
      />

      {/* Main List */}
      <ExpenseList 
        expenses={expenses}
        loading={loading}
        error={error}
        user={user}
        onDelete={handleDeleteClick}
        onView={(id) => navigate(`/expenses/${id}`)}
        pagination={pagination}
        onPageChange={setCurrentPage}
      />

      {/* Delete Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Expense"
        size="small"
      >
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <i className="fas fa-exclamation-triangle" style={{ fontSize: '3rem', color: 'var(--me-warning)', marginBottom: '1rem' }}></i>
          <p style={{ color: 'var(--me-text-sub)', fontSize: '1rem', marginBottom: '0.5rem' }}>
            Are you sure you want to delete this expense?
          </p>
          {expenseToDelete && (
            <div style={{ 
              background: 'var(--me-bg-page)', 
              padding: '1rem', 
              borderRadius: 'var(--me-radius)', 
              marginTop: '1rem',
              border: '1px solid var(--me-border)'
            }}>
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>{expenseToDelete.description || 'No description'}</strong>
              <span style={{ color: 'var(--me-text-sub)' }}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: expenseToDelete.currency || 'ILS' }).format(expenseToDelete.amount)}
              </span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--me-border)' }}>
          <Button type="button" variant="secondary" onClick={() => setDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={handleConfirmDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export default MyExpenses
