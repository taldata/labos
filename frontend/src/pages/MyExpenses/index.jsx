
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { Button, Modal, useToast, PageHeader } from '../../components/ui'
import { useScrollToItem } from '../../hooks/useScrollToItem'
import logger from '../../utils/logger'
import ExpenseStats from './components/ExpenseStats'
import ExpenseFilters from './components/ExpenseFilters'
import ExpenseList from './components/ExpenseList'
import ExpenseEditModal from '../../components/ExpenseEditModal'
import useExpenseFormOptions from '../../hooks/useExpenseFormOptions'
import './styles.css'

// ============================================================================
// Date Conversion Helpers
// ============================================================================
// Convert dd/mm/yyyy to yyyy-mm-dd
const convertToISODate = (displayDate) => {
  if (!displayDate || !/^\d{2}\/\d{2}\/\d{4}$/.test(displayDate)) return ''
  const [day, month, year] = displayDate.split('/')
  return `${year}-${month}-${day}`
}

// Convert yyyy-mm-dd to dd/mm/yyyy
const convertToDisplayDate = (isoDate) => {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return ''
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

function MyExpenses({ user, setUser }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { success, error: showError } = useToast()

  // Data State
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState([])

  // Pagination State
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page')) || 1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalExpenses, setTotalExpenses] = useState(0)

  // Initialize filters from URL params
  const [filters, setFilters] = useState(() => ({
    status: searchParams.get('status') || '',
    category_id: searchParams.get('category_id') || '',
    search: searchParams.get('search') || '',
    start_date: convertToDisplayDate(searchParams.get('start_date') || ''),
    end_date: convertToDisplayDate(searchParams.get('end_date') || ''),
    sort_by: searchParams.get('sort_by') || 'date',
    sort_order: searchParams.get('sort_order') || 'desc'
  }))
  const [showFilters, setShowFilters] = useState(false)

  // Delete State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [expenseToDelete, setExpenseToDelete] = useState(null)

  // Edit State
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState(null)
  const { subcategories, suppliers, creditCards, fetchOptions } = useExpenseFormOptions()

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

      // Convert display dates to ISO format for API
      const apiFilters = { ...filters }
      if (apiFilters.start_date) {
        apiFilters.start_date = convertToISODate(apiFilters.start_date)
      }
      if (apiFilters.end_date) {
        apiFilters.end_date = convertToISODate(apiFilters.end_date)
      }

      const params = new URLSearchParams({
        page: currentPage,
        per_page: 20,
        ...Object.fromEntries(
          Object.entries(apiFilters).filter(([_, v]) => v !== '')
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
    fetchCategories()
    fetchOptions()
    return () => {
      isMountedRef.current = false
    }
  }, [fetchCategories])

  // Fetch on changes
  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  // Sync filters to URL params (preserves state on navigation)
  useEffect(() => {
    const params = new URLSearchParams()
    if (currentPage > 1) params.set('page', currentPage)
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== '' && !(key === 'sort_by' && value === 'date') && !(key === 'sort_order' && value === 'desc')) {
        if ((key === 'start_date' || key === 'end_date') && value) {
          const isoDate = convertToISODate(value)
          if (isoDate) params.set(key, isoDate)
        } else {
          params.set(key, value)
        }
      }
    })
    setSearchParams(params, { replace: true })
  }, [filters, currentPage, setSearchParams])

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
    setSearchParams({}, { replace: true }) // Clear URL params
  }

  const handleEditClick = (expense) => {
    setSelectedExpense(expense)
    setEditModalOpen(true)
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
      <PageHeader
        title="My Expenses"
        subtitle="Manage and track your expense submissions"
        icon="fas fa-list"
        variant="blue"
        actions={
          <Button
            variant="primary"
            icon="fas fa-plus"
            onClick={() => navigate('/submit-expense')}
          >
            New Expense
          </Button>
        }
      />

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
        onEdit={handleEditClick}
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

      <ExpenseEditModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        expense={selectedExpense}
        onSuccess={fetchExpenses}
        subcategories={subcategories}
        suppliers={suppliers}
        creditCards={creditCards}
        isManagerView={true} // Hide admin fields like status/payment
      />
    </div>
  )
}

export default MyExpenses
