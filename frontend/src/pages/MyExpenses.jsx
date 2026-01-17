import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Card, Button, Badge, Input, Select, Skeleton, EmptyState, Modal, useToast, FilePreviewButton } from '../components/ui'
import { useScrollToItem } from '../hooks/useScrollToItem'
import logger from '../utils/logger'
import './MyExpenses.css'

function MyExpenses({ user, setUser }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { success, error: showError } = useToast()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newExpenseId, setNewExpenseId] = useState(location.state?.newExpenseId || null)
  const isMountedRef = useRef(true)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalExpenses, setTotalExpenses] = useState(0)

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    category_id: '',
    search: '',
    start_date: '',
    end_date: '',
    sort_by: 'date',
    sort_order: 'desc'
  })

  // Form data
  const [categories, setCategories] = useState([])
  const [showFilters, setShowFilters] = useState(false)

  // Auto-scroll to newly created expense
  const { getItemRef } = useScrollToItem(expenses, newExpenseId, () => setNewExpenseId(null))

  // Delete confirmation
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [expenseToDelete, setExpenseToDelete] = useState(null)

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
      // Ignore abort errors
      if (error.name === 'AbortError') return
      logger.error('Failed to fetch categories', { error: error.message })
    }

    return () => abortController.abort()
  }, [])

  const fetchExpenses = useCallback(async () => {
    const abortController = new AbortController()

    try {
      setLoading(true)
      setError('')

      // Build query params
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
      // Ignore abort errors
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

  useEffect(() => {
    isMountedRef.current = true
    const cleanup = fetchCategories()

    return () => {
      cleanup?.then(fn => fn?.())
    }
  }, [fetchCategories])

  useEffect(() => {
    const cleanup = fetchExpenses()

    return () => {
      cleanup?.then(fn => fn?.())
    }
  }, [fetchExpenses])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({ ...prev, [name]: value }))
    setCurrentPage(1)
  }

  const clearFilters = () => {
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

  const openDeleteModal = (e, expense) => {
    e.stopPropagation() // Prevent row click navigation
    setExpenseToDelete(expense)
    setDeleteModalOpen(true)
  }

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/v1/admin/expenses/${expenseToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (res.ok) {
        success('Expense deleted successfully')
        setDeleteModalOpen(false)
        setExpenseToDelete(null)
        fetchExpenses() // Refresh the list
      } else {
        const data = await res.json()
        showError(data.error || 'Failed to delete expense')
      }
    } catch (err) {
      showError('An error occurred')
    }
  }

  const getStatusVariant = (status) => {
    const variants = {
      pending: 'warning',
      approved: 'success',
      rejected: 'danger',
      paid: 'info'
    }
    return variants[status] || 'default'
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'ILS'
    }).format(amount)
  }

  const hasActiveFilters = filters.status || filters.category_id || filters.search || filters.start_date || filters.end_date

  return (
    <div className="my-expenses-container">

      <div className="page-content">
        {/* Page Header */}
        <div className="page-title-section">
          <div>
            <h1>My Expenses</h1>
            <p className="subtitle">{totalExpenses} total expenses</p>
          </div>
          <Button variant="primary" icon="fas fa-plus" onClick={() => navigate('/submit-expense')}>
            New Expense
          </Button>
        </div>

        {/* Filters */}
        <Card className="filters-section">
          <div className="filters-header" onClick={() => setShowFilters(!showFilters)}>
            <div className="filters-title">
              <i className="fas fa-filter"></i>
              <span>Filters & Search</span>
              {hasActiveFilters && <Badge variant="primary" size="small">{Object.values(filters).filter(v => v).length - 2} active</Badge>}
            </div>
            <Button variant="ghost" size="small">
              <i className={`fas fa-chevron-${showFilters ? 'up' : 'down'}`}></i>
            </Button>
          </div>

          {showFilters && (
            <div className="filters-body">
              <div className="filter-row">
                <Input
                  label="Search"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Search description..."
                  icon="fas fa-search"
                />

                <Select
                  label="Status"
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="paid">Paid</option>
                </Select>

                <Select
                  label="Category"
                  name="category_id"
                  value={filters.category_id}
                  onChange={handleFilterChange}
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </Select>
              </div>

              <div className="filter-row">
                <Input
                  type="date"
                  label="Start Date"
                  name="start_date"
                  value={filters.start_date}
                  onChange={handleFilterChange}
                />

                <Input
                  type="date"
                  label="End Date"
                  name="end_date"
                  value={filters.end_date}
                  onChange={handleFilterChange}
                />

                <Select
                  label="Sort By"
                  name="sort_by"
                  value={filters.sort_by}
                  onChange={handleFilterChange}
                >
                  <option value="date">Date</option>
                  <option value="amount">Amount</option>
                  <option value="status">Status</option>
                </Select>

                <Select
                  label="Order"
                  name="sort_order"
                  value={filters.sort_order}
                  onChange={handleFilterChange}
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </Select>
              </div>

              <div className="filter-actions">
                <Button variant="secondary" icon="fas fa-times" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Expenses List */}
        <Card className="expenses-list-card">
          {error && (
            <div className="error-alert">
              <i className="fas fa-exclamation-circle"></i>
              {error}
            </div>
          )}

          {loading ? (
            <div className="loading-state">
              <Skeleton.Table rows={5} columns={6} />
            </div>
          ) : expenses.length === 0 ? (
            <EmptyState
              icon="fas fa-inbox"
              title="No expenses found"
              description={hasActiveFilters
                ? "Try adjusting your filters to find what you're looking for"
                : "You haven't submitted any expenses yet. Click the button below to get started."}
              actionLabel="Submit New Expense"
              onAction={() => navigate('/submit-expense')}
            />
          ) : (
            <>
              <div className="expenses-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Attachments</th>
                      {(user?.is_manager || user?.is_admin) && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map(expense => (
                      <tr
                        key={expense.id}
                        ref={getItemRef(expense.id)}
                        data-item-id={expense.id}
                        className="expense-row"
                        onClick={() => navigate(`/expenses/${expense.id}`)}
                      >
                        <td>{formatDate(expense.date)}</td>
                        <td>
                          <div className="expense-description">
                            <strong>{expense.description || 'No description'}</strong>
                            {expense.reason && (
                              <span className="expense-reason">{expense.reason}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="category-info">
                            {expense.category?.name && (
                              <Badge variant="default" size="small">{expense.category.name}</Badge>
                            )}
                            {expense.subcategory?.name && (
                              <span className="subcategory-text">{expense.subcategory.name}</span>
                            )}
                          </div>
                        </td>
                        <td className="amount-cell">
                          {formatCurrency(expense.amount, expense.currency)}
                        </td>
                        <td>
                          <Badge variant={getStatusVariant(expense.status)} size="small">
                            {expense.status}
                          </Badge>
                        </td>
                        <td className="attachments-cell" onClick={(e) => e.stopPropagation()}>
                          {expense.invoice_filename && (
                            <FilePreviewButton
                              fileUrl={`/download/${expense.invoice_filename}`}
                              fileName={expense.invoice_filename}
                              icon="fas fa-file-invoice"
                              title="Preview invoice"
                            />
                          )}
                          {expense.receipt_filename && (
                            <FilePreviewButton
                              fileUrl={`/download/${expense.receipt_filename}`}
                              fileName={expense.receipt_filename}
                              icon="fas fa-receipt"
                              title="Preview receipt"
                            />
                          )}
                          {!expense.invoice_filename && !expense.receipt_filename && <span className="no-attachments">-</span>}
                        </td>
                        {(user?.is_manager || user?.is_admin) && (
                          <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="small"
                              icon="fas fa-trash"
                              onClick={(e) => openDeleteModal(e, expense)}
                              title="Delete"
                              className="btn-delete"
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pagination">
                  <Button
                    variant="secondary"
                    size="small"
                    icon="fas fa-chevron-left"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>

                  <span className="pagination-info">
                    Page {currentPage} of {totalPages}
                  </span>

                  <Button
                    variant="secondary"
                    size="small"
                    iconPosition="right"
                    icon="fas fa-chevron-right"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Expense"
        size="small"
      >
        <div className="delete-confirmation">
          <p>Are you sure you want to delete this expense?</p>
          {expenseToDelete && (
            <div className="expense-details">
              <strong>{expenseToDelete.description || 'No description'}</strong>
              <span>{formatCurrency(expenseToDelete.amount, expenseToDelete.currency)}</span>
            </div>
          )}
        </div>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={() => setDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export default MyExpenses
