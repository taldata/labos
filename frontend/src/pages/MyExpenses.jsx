import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './MyExpenses.css'

function MyExpenses({ user }) {
  const navigate = useNavigate()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    fetchExpenses()
  }, [currentPage, filters])

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/v1/form-data/categories', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories)
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  const fetchExpenses = async () => {
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
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setExpenses(data.expenses)
        setTotalPages(data.pagination.pages)
        setTotalExpenses(data.pagination.total)
      } else {
        setError('Failed to load expenses')
      }
    } catch (err) {
      setError('An error occurred while fetching expenses')
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({ ...prev, [name]: value }))
    setCurrentPage(1) // Reset to first page when filtering
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

  const getStatusBadge = (status) => {
    const statusStyles = {
      pending: 'status-badge status-pending',
      approved: 'status-badge status-approved',
      rejected: 'status-badge status-rejected',
      paid: 'status-badge status-paid'
    }
    return statusStyles[status] || 'status-badge'
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'ILS'
    }).format(amount)
  }

  return (
    <div className="my-expenses-container">
      {/* Header */}
      <header className="page-header">
        <div className="header-left">
          <button className="back-button" onClick={() => navigate('/dashboard')}>
            <i className="fas fa-arrow-left"></i>
          </button>
          <div>
            <h1>My Expenses</h1>
            <p className="subtitle">{totalExpenses} total expenses</p>
          </div>
        </div>
        <div className="header-right">
          <button className="btn-primary" onClick={() => navigate('/submit-expense')}>
            <i className="fas fa-plus"></i> New Expense
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="filters-section card">
        <div className="filters-header" onClick={() => setShowFilters(!showFilters)}>
          <div className="filters-title">
            <i className="fas fa-filter"></i>
            <span>Filters & Search</span>
          </div>
          <button className="toggle-filters-btn">
            <i className={`fas fa-chevron-${showFilters ? 'up' : 'down'}`}></i>
          </button>
        </div>

        {showFilters && (
          <div className="filters-body">
            <div className="filter-row">
              <div className="filter-group">
                <label>Search</label>
                <input
                  type="text"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Search description..."
                />
              </div>

              <div className="filter-group">
                <label>Status</label>
                <select name="status" value={filters.status} onChange={handleFilterChange}>
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="paid">Paid</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Category</label>
                <select name="category_id" value={filters.category_id} onChange={handleFilterChange}>
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="filter-row">
              <div className="filter-group">
                <label>Start Date</label>
                <input
                  type="date"
                  name="start_date"
                  value={filters.start_date}
                  onChange={handleFilterChange}
                />
              </div>

              <div className="filter-group">
                <label>End Date</label>
                <input
                  type="date"
                  name="end_date"
                  value={filters.end_date}
                  onChange={handleFilterChange}
                />
              </div>

              <div className="filter-group">
                <label>Sort By</label>
                <select name="sort_by" value={filters.sort_by} onChange={handleFilterChange}>
                  <option value="date">Date</option>
                  <option value="amount">Amount</option>
                  <option value="status">Status</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Order</label>
                <select name="sort_order" value={filters.sort_order} onChange={handleFilterChange}>
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
            </div>

            <div className="filter-actions">
              <button className="btn-secondary" onClick={clearFilters}>
                <i className="fas fa-times"></i> Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Expenses List */}
      <div className="expenses-list card">
        {error && (
          <div className="error-alert">
            <i className="fas fa-exclamation-circle"></i>
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading expenses...</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-inbox"></i>
            <h3>No expenses found</h3>
            <p>Try adjusting your filters or submit a new expense</p>
            <button className="btn-primary" onClick={() => navigate('/submit-expense')}>
              <i className="fas fa-plus"></i> Submit New Expense
            </button>
          </div>
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
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(expense => (
                    <tr key={expense.id} className="expense-row" onClick={() => navigate(`/expenses/${expense.id}`)}>
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
                            <span className="category-badge">{expense.category.name}</span>
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
                        <span className={getStatusBadge(expense.status)}>
                          {expense.status}
                        </span>
                      </td>
                      <td className="attachments-cell">
                        {expense.has_invoice && <i className="fas fa-file-invoice" title="Has invoice"></i>}
                        {expense.has_receipt && <i className="fas fa-receipt" title="Has receipt"></i>}
                        {!expense.has_invoice && !expense.has_receipt && '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <i className="fas fa-chevron-left"></i> Previous
                </button>

                <span className="pagination-info">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next <i className="fas fa-chevron-right"></i>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default MyExpenses
