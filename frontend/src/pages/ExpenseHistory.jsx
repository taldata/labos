import { useState, useEffect, useCallback, useMemo } from 'react'
import { useColumnResize } from '../hooks/useColumnResize'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, Button, Badge, Input, Select, TomSelectInput, Skeleton, EmptyState, Modal, useToast, FilePreviewButton, PageHeader, DateRangeFilter } from '../components/ui'
import MoveExpenseToYearModal from '../components/MoveExpenseToYearModal'
import ExpenseEditModal from '../components/ExpenseEditModal'
import useFilterOptions from '../hooks/useFilterOptions'
import logger from '../utils/logger'
import './ExpenseHistory.css'

// ============================================================================
// Date Conversion Helpers
// ============================================================================
// Convert yyyy-mm-dd to dd/mm/yyyy
const convertToDisplayDate = (isoDate) => {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return ''
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

// Convert dd/mm/yyyy to yyyy-mm-dd
const convertToISODate = (displayDate) => {
  if (!displayDate || !/^\d{2}\/\d{2}\/\d{4}$/.test(displayDate)) return ''
  const [day, month, year] = displayDate.split('/')
  return `${year}-${month}-${day}`
}

// ============================================================================
// Custom Hook: useExpenseFilters
// ============================================================================
function useExpenseFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const getInitialFilters = useCallback(() => ({
    status: searchParams.get('status') || '',
    department_id: searchParams.get('department_id') || '',
    user_id: searchParams.get('user_id') || '',
    category_id: searchParams.get('category_id') || '',
    subcategory_id: searchParams.get('subcategory_id') || '',
    supplier_id: searchParams.get('supplier_id') || '',
    payment_method: searchParams.get('payment_method') || '',
    search: searchParams.get('search') || '',
    start_date: convertToDisplayDate(searchParams.get('start_date') || ''),
    end_date: convertToDisplayDate(searchParams.get('end_date') || ''),
    sort_by: searchParams.get('sort_by') || 'date',
    sort_order: searchParams.get('sort_order') || 'desc'
  }), [searchParams])

  const [filters, setFilters] = useState(getInitialFilters)
  const [debouncedFilters, setDebouncedFilters] = useState(getInitialFilters)
  const [selectedCategoryOption, setSelectedCategoryOption] = useState('')

  // Debounce filters for API calls (prevents jumping during typing)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFilters(filters)
    }, 400)
    return () => clearTimeout(handler)
  }, [filters])

  // Sync debounced filters to URL params (preserves state on navigation)
  useEffect(() => {
    const params = new URLSearchParams()
    Object.entries(debouncedFilters).forEach(([key, value]) => {
      if (value && value !== '' && !(key === 'sort_by' && value === 'date') && !(key === 'sort_order' && value === 'desc')) {
        // Convert display dates to ISO for URL
        if ((key === 'start_date' || key === 'end_date') && value) {
          const isoDate = convertToISODate(value)
          if (isoDate) params.set(key, isoDate)
        } else {
          params.set(key, value)
        }
      }
    })
    setSearchParams(params, { replace: true })
  }, [debouncedFilters, setSearchParams])

  const updateFilter = useCallback((name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }))
  }, [])

  const clearFilters = useCallback(() => {
    const clearedFilters = {
      status: '',
      department_id: '',
      user_id: '',
      category_id: '',
      subcategory_id: '',
      supplier_id: '',
      payment_method: '',
      search: '',
      start_date: '',
      end_date: '',
      sort_by: 'date',
      sort_order: 'desc'
    }
    setFilters(clearedFilters)
    setDebouncedFilters(clearedFilters) // Immediately clear debounced too
    setSelectedCategoryOption('')
    setSearchParams({}, { replace: true }) // Clear URL params too
  }, [setSearchParams])

  const hasActiveFilters = useMemo(() =>
    Object.entries(filters).some(([key, val]) =>
      val !== '' && !['sort_by', 'sort_order'].includes(key)
    ), [filters]
  )

  const activeFilterCount = useMemo(() =>
    Object.entries(filters).filter(([k, v]) => v && !['sort_by', 'sort_order'].includes(k)).length
    , [filters])

  return {
    filters,
    debouncedFilters,
    setFilters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
    selectedCategoryOption,
    setSelectedCategoryOption
  }
}

// ============================================================================
// Custom Hook: useExpenseData
// ============================================================================
function useExpenseData(filters, currentPage, isManagerView = false) {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [totalPages, setTotalPages] = useState(1)
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [managedDepartments, setManagedDepartments] = useState([])

  const fetchExpenses = useCallback(async () => {
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
        per_page: 25,
        ...Object.fromEntries(
          Object.entries(apiFilters).filter(([_, v]) => v !== '')
        )
      })

      // Use different API endpoint based on view type
      const endpoint = isManagerView ? '/api/v1/manager/expenses' : '/api/v1/admin/expenses'
      const response = await fetch(`${endpoint}?${params}`, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setExpenses(data.expenses)
        setTotalPages(data.pagination.pages)
        setTotalExpenses(data.pagination.total)
        if (data.managed_departments) {
          setManagedDepartments(data.managed_departments)
        }
      } else {
        let errorMsg = 'Failed to load expenses'
        try {
          const data = await response.json()
          if (data.error) errorMsg = data.error
        } catch (_) {
          // Response body might not be JSON
        }
        setError(errorMsg)
        logger.error('Failed to load expenses', { status: response.status, error: errorMsg })
      }
    } catch (err) {
      setError('An error occurred while fetching expenses')
      logger.error('Fetch error', { error: err.message })
    } finally {
      setLoading(false)
    }
  }, [filters, currentPage, isManagerView])

  return {
    expenses,
    loading,
    error,
    totalPages,
    totalExpenses,
    managedDepartments,
    fetchExpenses
  }
}



// ============================================================================
// Component: ExpenseHistoryHeader
// ============================================================================
function ExpenseHistoryHeader({ totalExpenses, filters, isManagerView = false }) {
  const handleExport = () => {
    // Convert display dates to ISO format for API
    const apiFilters = { ...filters }
    if (apiFilters.start_date) {
      apiFilters.start_date = convertToISODate(apiFilters.start_date)
    }
    if (apiFilters.end_date) {
      apiFilters.end_date = convertToISODate(apiFilters.end_date)
    }

    const params = new URLSearchParams(
      Object.fromEntries(Object.entries(apiFilters).filter(([_, v]) => v !== ''))
    )
    window.open('/api/v1/expenses/export?' + params.toString(), '_blank')
  }

  return (
    <PageHeader
      title={isManagerView ? "Department Expenses" : "Expense History"}
      subtitle={`${totalExpenses.toLocaleString()} total expenses`}
      icon="fas fa-history"
      variant="blue"
      actions={
        <Button
          variant="secondary"
          icon="fas fa-file-excel"
          onClick={handleExport}
        >
          Export Excel
        </Button>
      }
    />
  )
}

// ============================================================================
// Component: ExpenseHistoryFilters
// ============================================================================
function ExpenseHistoryFilters({
  filters,
  setFilters,
  updateFilter,
  clearFilters,
  hasActiveFilters,
  activeFilterCount,
  departments,
  userOptions,
  categoryOptions,
  suppliers,
  selectedCategoryOption,
  onCategorySelect
}) {
  const [isExpanded, setIsExpanded] = useState(true)

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    updateFilter(name, value)
  }

  // Add "Select All" option to each filter dropdown
  const departmentOptionsWithAll = useMemo(() => [
    { id: '', name: 'Select All' },
    ...departments
  ], [departments])

  const userOptionsWithAll = useMemo(() => [
    { id: '', name: 'Select All' },
    ...userOptions
  ], [userOptions])

  const categoryOptionsWithAll = useMemo(() => [
    { id: '', name: 'Select All' },
    ...categoryOptions
  ], [categoryOptions])

  const supplierOptionsWithAll = useMemo(() => [
    { id: '', name: 'Select All' },
    ...suppliers
  ], [suppliers])

  return (
    <Card className="eh-filters">
      <button
        className="eh-filters__header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <div className="eh-filters__title">
          <i className="fas fa-sliders-h" />
          <span>Filters & Search</span>
          {hasActiveFilters && (
            <Badge variant="primary" size="small">
              {activeFilterCount} active
            </Badge>
          )}
        </div>
        <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} eh-filters__toggle`} />
      </button>

      {hasActiveFilters && (
        <div className="eh-active-filters">
          {filters.search && (
            <span className="eh-filter-chip">
              Search: "{filters.search}"
              <button onClick={() => updateFilter('search', '')}><i className="fas fa-times"></i></button>
            </span>
          )}
          {filters.status && (
            <span className="eh-filter-chip">
              Status: {filters.status.charAt(0).toUpperCase() + filters.status.slice(1)}
              <button onClick={() => updateFilter('status', '')}><i className="fas fa-times"></i></button>
            </span>
          )}
          {filters.department_id && (
            <span className="eh-filter-chip">
              Department: {departments.find(d => String(d.id) === String(filters.department_id))?.name || filters.department_id}
              <button onClick={() => updateFilter('department_id', '')}><i className="fas fa-times"></i></button>
            </span>
          )}
          {filters.user_id && (
            <span className="eh-filter-chip">
              Employee: {userOptions.find(u => String(u.id) === String(filters.user_id))?.name || filters.user_id}
              <button onClick={() => updateFilter('user_id', '')}><i className="fas fa-times"></i></button>
            </span>
          )}
          {filters.category_id && (
            <span className="eh-filter-chip">
              Category: {categoryOptions.find(c => String(c.id) === String(filters.category_id))?.name || filters.category_id}
              <button onClick={() => { updateFilter('category_id', ''); updateFilter('subcategory_id', ''); onCategorySelect({ target: { name: 'category_id', value: '' } }); }}><i className="fas fa-times"></i></button>
            </span>
          )}
          {filters.supplier_id && (
            <span className="eh-filter-chip">
              Supplier: {suppliers.find(s => String(s.id) === String(filters.supplier_id))?.name || filters.supplier_id}
              <button onClick={() => updateFilter('supplier_id', '')}><i className="fas fa-times"></i></button>
            </span>
          )}
          {filters.payment_method && (
            <span className="eh-filter-chip">
              Payment: {filters.payment_method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              <button onClick={() => updateFilter('payment_method', '')}><i className="fas fa-times"></i></button>
            </span>
          )}
          {filters.start_date && (
            <span className="eh-filter-chip">
              From: {filters.start_date}
              <button onClick={() => setFilters(prev => ({ ...prev, start_date: '' }))}><i className="fas fa-times"></i></button>
            </span>
          )}
          {filters.end_date && (
            <span className="eh-filter-chip">
              To: {filters.end_date}
              <button onClick={() => setFilters(prev => ({ ...prev, end_date: '' }))}><i className="fas fa-times"></i></button>
            </span>
          )}
        </div>
      )}

      {isExpanded && (
        <div className="eh-filters__body">
          {/* Row 1: Search, Status, Department, Employee */}
          <div className="eh-filters__row">
            <Input
              label="Search"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="Description, reason, employee, supplier..."
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
            </Select>
            <TomSelectInput
              label="Department"
              name="department_id"
              value={filters.department_id}
              onChange={handleFilterChange}
              options={departmentOptionsWithAll}
              displayKey="name"
              valueKey="id"
              placeholder="All Departments"
              allowClear={true}
            />
            <TomSelectInput
              label="Employee"
              name="user_id"
              value={filters.user_id}
              onChange={handleFilterChange}
              options={userOptionsWithAll}
              displayKey="name"
              valueKey="id"
              placeholder="All Employees"
              allowClear={true}
            />
          </div>

          {/* Row 2: Category, Supplier, Payment Method, Start Date */}
          <div className="eh-filters__row">
            <TomSelectInput
              label="Category"
              name="category_id"
              value={selectedCategoryOption}
              onChange={onCategorySelect}
              options={categoryOptionsWithAll}
              placeholder="All Categories"
              displayKey="name"
              valueKey="id"
              allowClear={true}
            />
            <TomSelectInput
              label="Supplier"
              name="supplier_id"
              value={filters.supplier_id}
              onChange={handleFilterChange}
              options={supplierOptionsWithAll}
              placeholder="All Suppliers"
              displayKey="name"
              valueKey="id"
              allowClear={true}
            />
            <Select
              label="Payment Method"
              name="payment_method"
              value={filters.payment_method}
              onChange={handleFilterChange}
            >
              <option value="">All Methods</option>
              <option value="credit">Credit Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="standing_order">Standing Order</option>
              <option value="check">Check</option>
            </Select>
          </div>

          {/* Row 3: Time Period, Sort By, Order, Clear */}
          <div className="eh-filters__row">
            <DateRangeFilter filters={filters} setFilters={setFilters} />
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
            <div className="eh-filters__actions">
              <Button
                variant="secondary"
                icon="fas fa-times"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

// ============================================================================
// Component: ExpenseRow
// ============================================================================
function ExpenseRow({ expense, onView, onEdit, onMove, onDelete, formatDate, formatCurrency, isManagerView }) {
  const getStatusVariant = (status) => {
    const variants = {
      pending: 'warning',
      approved: 'success',
      rejected: 'danger',
      paid: 'info'
    }
    return variants[status] || 'default'
  }

  const getPaymentStatusVariant = (status) => {
    const variants = {
      pending: 'warning',
      paid: 'success',
      cancelled: 'danger'
    }
    return variants[status] || 'default'
  }

  return (
    <tr className="eh-table__row eh-table__row--clickable" onClick={() => onView(expense.id)} style={{ cursor: 'pointer' }}>
      <td className="eh-table__cell eh-table__cell--date">
        {formatDate(expense.invoice_date)}
      </td>
      <td className="eh-table__cell eh-table__cell--submit-date">
        {formatDate(expense.submit_date)}
      </td>
      <td className="eh-table__cell eh-table__cell--employee">
        <div className="eh-employee">
          <div className="eh-employee__avatar">
            {expense.user?.name?.[0]?.toUpperCase() || '?'}
          </div>
          <span className="eh-employee__name">{expense.user?.name || 'Unknown'}</span>
        </div>
      </td>
      <td className="eh-table__cell eh-table__cell--department">
        <Badge variant="default" size="small">
          {expense.user?.department || '-'}
        </Badge>
      </td>
      <td className="eh-table__cell eh-table__cell--description">
        <div className="eh-description">
          <strong>{expense.description || 'No description'}</strong>
          {expense.reason && (
            <span className="eh-description__reason">{expense.reason}</span>
          )}
        </div>
      </td>
      <td className="eh-table__cell eh-table__cell--category">
        <div className="eh-category">
          {expense.category?.name && (
            <Badge variant="primary-solid" size="small">{expense.category.name}</Badge>
          )}
          {expense.subcategory?.name && (
            <span className="eh-category__sub">{expense.subcategory.name}</span>
          )}
        </div>
      </td>
      <td className="eh-table__cell eh-table__cell--supplier">
        {expense.supplier?.name || '-'}
      </td>
      <td className="eh-table__cell eh-table__cell--amount">
        <div>
          {formatCurrency(expense.amount, expense.currency)}
          {expense.currency !== 'ILS' && expense.amount_ils && (
            <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>
              ≈ {formatCurrency(expense.amount_ils, 'ILS')}
            </div>
          )}
        </div>
      </td>
      <td className="eh-table__cell eh-table__cell--status">
        <Badge variant={getStatusVariant(expense.status)} size="small" rounded>
          {expense.status ? expense.status.charAt(0).toUpperCase() + expense.status.slice(1) : '-'}
        </Badge>
      </td>
      <td className="eh-table__cell eh-table__cell--payment">
        {expense.payment_status ? (
          <Badge variant={getPaymentStatusVariant(expense.payment_status)} size="small">
            {expense.payment_status}
          </Badge>
        ) : (
          <span className="eh-muted">-</span>
        )}
      </td>
      <td className="eh-table__cell eh-table__cell--files" onClick={(e) => e.stopPropagation()}>
        {(expense.invoice_filename || expense.receipt_filename || expense.quote_filename) ? (
          <div className="eh-files">
            {expense.invoice_filename && (
              <div className="eh-file-item">
                <FilePreviewButton
                  fileUrl={`/download/${expense.invoice_filename}`}
                  fileName={expense.invoice_filename}
                  icon="fas fa-file-invoice-dollar"
                  title="Preview Invoice"
                />
                <span className="eh-file-label">חשבונית</span>
              </div>
            )}
            {expense.receipt_filename && (
              <div className="eh-file-item">
                <FilePreviewButton
                  fileUrl={`/download/${expense.receipt_filename}`}
                  fileName={expense.receipt_filename}
                  icon="fas fa-receipt"
                  title="Preview Receipt"
                />
                <span className="eh-file-label">קבלה</span>
              </div>
            )}
            {expense.quote_filename && (
              <div className="eh-file-item">
                <FilePreviewButton
                  fileUrl={`/download/${expense.quote_filename}`}
                  fileName={expense.quote_filename}
                  icon="fas fa-file-alt"
                  title="Preview Quote"
                />
                <span className="eh-file-label">הצעת מחיר</span>
              </div>
            )}
          </div>
        ) : (
          <span className="eh-muted">-</span>
        )}
      </td>
      <td className="eh-table__cell eh-table__cell--actions" onClick={(e) => e.stopPropagation()}>
        <div className="eh-actions">
          <Button
            variant="ghost"
            size="small"
            icon="fas fa-edit"
            onClick={() => onEdit(expense)}
            title="Edit"
          />
          {!isManagerView && (
            <Button
              variant="ghost"
              size="small"
              icon="fas fa-calendar-alt"
              onClick={() => onMove(expense)}
              title="Move to Different Year"
              className="eh-actions__move"
            />
          )}
          {!isManagerView && (
            <Button
              variant="ghost"
              size="small"
              icon="fas fa-trash"
              onClick={() => onDelete(expense)}
              title="Delete"
              className="eh-actions__delete"
            />
          )}
        </div>
      </td>
    </tr>
  )
}

// ============================================================================
// Component: ExpenseTable
// ============================================================================
const EH_DEFAULT_WIDTHS = {
  date: 110, 'submit-date': 110, employee: 180, department: 120,
  description: 240, category: 150, supplier: 140, amount: 110,
  status: 100, payment: 100, files: 150, actions: 150
}

function ResizeHandle({ columnKey, onResizeStart }) {
  return (
    <span
      className="col-resize-handle"
      onMouseDown={(e) => onResizeStart(columnKey, e)}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

function ExpenseTable({ expenses, loading, error, hasActiveFilters, onView, onEdit, onMove, onDelete, isManagerView }) {
  const { columnWidths, onResizeStart } = useColumnResize('expense-history', EH_DEFAULT_WIDTHS)

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

  if (error) {
    return (
      <div className="eh-error">
        <i className="fas fa-exclamation-circle" />
        <span>{error}</span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="eh-loading">
        <Skeleton.Table rows={8} columns={11} />
      </div>
    )
  }

  if (expenses.length === 0) {
    return (
      <EmptyState
        icon="fas fa-receipt"
        title="No expenses found"
        description={hasActiveFilters
          ? "Try adjusting your filters to find what you're looking for"
          : "No expenses have been submitted yet."}
      />
    )
  }

  return (
    <div className="eh-table-wrapper">
      <table className="eh-table">
        <thead className="eh-table__head">
          <tr>
            {[
              ['date', 'Document Date'], ['submit-date', 'Submit Date'], ['employee', 'Employee'],
              ['department', 'Department'], ['description', 'Description'], ['category', 'Category'],
              ['supplier', 'Supplier'], ['amount', 'Amount'], ['status', 'Status'],
              ['payment', 'Payment'], ['files', 'Files'], ['actions', 'Actions']
            ].map(([key, label]) => (
              <th key={key} className={`eh-table__header eh-table__header--${key}`} style={{ width: columnWidths[key] }}>
                {label}
                <ResizeHandle columnKey={key} onResizeStart={onResizeStart} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="eh-table__body">
          {expenses.map(expense => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              onView={onView}
              onEdit={onEdit}
              onMove={onMove}
              onDelete={onDelete}
              formatDate={formatDate}
              formatCurrency={formatCurrency}
              isManagerView={isManagerView}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================================
// Component: ExpensePagination
// ============================================================================
function ExpensePagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null

  return (
    <div className="eh-pagination">
      <Button
        variant="secondary"
        size="small"
        icon="fas fa-chevron-left"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
      >
        Previous
      </Button>
      <span className="eh-pagination__info">
        Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
      </span>
      <Button
        variant="secondary"
        size="small"
        iconPosition="right"
        icon="fas fa-chevron-right"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
      >
        Next
      </Button>
    </div>
  )
}



// ============================================================================
// Component: ExpenseDeleteModal
// ============================================================================
function ExpenseDeleteModal({ isOpen, onClose, expense, onSuccess }) {
  const { success, error: showError } = useToast()

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/v1/admin/expenses/${expense.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (res.ok) {
        success('Expense deleted successfully')
        onSuccess()
        onClose()
      } else {
        const data = await res.json()
        showError(data.error || 'Failed to delete expense')
      }
    } catch (err) {
      showError('An error occurred')
    }
  }

  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'ILS'
    }).format(amount)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Expense" size="small">
      <div className="eh-delete-modal">
        <div className="eh-delete-modal__icon">
          <i className="fas fa-exclamation-triangle" />
        </div>
        <p className="eh-delete-modal__message">Are you sure you want to delete this expense?</p>
        {expense && (
          <div className="eh-delete-modal__summary">
            <p><strong>Employee:</strong> {expense.user?.name}</p>
            <p><strong>Amount:</strong> {formatCurrency(expense.amount, expense.currency)}</p>
            <p><strong>Description:</strong> {expense.description}</p>
          </div>
        )}
        <p className="eh-delete-modal__warning">This action cannot be undone.</p>
      </div>
      <div className="eh-delete-modal__actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" variant="danger" onClick={handleDelete}>
          Delete
        </Button>
      </div>
    </Modal>
  )
}

// ============================================================================
// Main Component: ExpenseHistory
// ============================================================================
function ExpenseHistory({ user, isManagerView = false }) {
  const navigate = useNavigate()
  const [currentPage, setCurrentPage] = useState(1)

  // Custom hooks
  const filterHook = useExpenseFilters()
  const dataHook = useExpenseData(filterHook.debouncedFilters, currentPage, isManagerView)
  const optionsHook = useFilterOptions(isManagerView)

  // Memoize user options to prevent infinite re-renders from TomSelectInput
  const userOptions = useMemo(() =>
    optionsHook.users.map(u => ({
      id: u.id,
      name: `${u.first_name} ${u.last_name}`
    })),
    [optionsHook.users]
  )

  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [moveModalOpen, setMoveModalOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState(null)
  const { success } = useToast()

  // Initialize
  useEffect(() => {
    // Check access: admin for admin view, manager or admin for manager view
    const hasAccess = isManagerView
      ? (user?.is_manager || user?.is_admin)
      : user?.is_admin

    if (!hasAccess) {
      navigate('/dashboard')
      return
    }
    optionsHook.fetchFilterOptions()
  }, [])

  // Fetch expenses when fetch function changes (due to filters/page) or user loads
  useEffect(() => {
    const hasAccess = isManagerView
      ? (user?.is_manager || user?.is_admin)
      : user?.is_admin

    if (hasAccess) {
      dataHook.fetchExpenses()
    }
  }, [dataHook.fetchExpenses, user, isManagerView])

  // Reset page when debounced filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filterHook.debouncedFilters])

  // Sync selectedCategoryOption with filters
  useEffect(() => {
    const { category_id, subcategory_id } = filterHook.filters
    const { categoryOptions } = optionsHook

    if (!categoryOptions.length) return

    let targetOptionId = ''

    if (subcategory_id) {
      const option = categoryOptions.find(opt =>
        opt.type === 'subcategory' && String(opt.subcategory_id) === String(subcategory_id)
      )
      if (option) targetOptionId = option.id
    } else if (category_id) {
      const option = categoryOptions.find(opt =>
        opt.type === 'category' && String(opt.category_id) === String(category_id)
      )
      if (option) targetOptionId = option.id
    }

    if (targetOptionId !== filterHook.selectedCategoryOption) {
      filterHook.setSelectedCategoryOption(targetOptionId)
    }
  }, [filterHook.filters.category_id, filterHook.filters.subcategory_id, optionsHook.categoryOptions])

  // Handlers
  const handleCategorySelect = (e) => {
    const selectedId = e.target.value
    filterHook.setSelectedCategoryOption(selectedId)

    if (!selectedId) {
      filterHook.setFilters(prev => ({ ...prev, category_id: '', subcategory_id: '' }))
      return
    }

    const selectedOption = optionsHook.categoryOptions.find(opt => opt.id === selectedId)
    if (selectedOption) {
      if (selectedOption.type === 'category') {
        filterHook.setFilters(prev => ({
          ...prev,
          category_id: selectedOption.category_id,
          subcategory_id: ''
        }))
      } else {
        filterHook.setFilters(prev => ({
          ...prev,
          category_id: selectedOption.category_id,
          subcategory_id: selectedOption.subcategory_id
        }))
      }
    }
  }

  const handleView = (expenseId) => {
    navigate(`/expenses/${expenseId}`)
  }

  const handleEdit = (expense) => {
    setSelectedExpense(expense)
    setEditModalOpen(true)
  }

  const handleMove = (expense) => {
    setSelectedExpense(expense)
    setMoveModalOpen(true)
  }

  const handleDelete = (expense) => {
    setSelectedExpense(expense)
    setDeleteModalOpen(true)
  }

  const handleMoveSuccess = (data) => {
    success(`Expense moved successfully from year ${data.old_year} to ${data.new_year}`)
    setMoveModalOpen(false)
    setSelectedExpense(null)
    dataHook.fetchExpenses()
  }

  // Check access
  const hasAccess = isManagerView
    ? (user?.is_manager || user?.is_admin)
    : user?.is_admin
  if (!hasAccess) return null

  return (
    <div className="eh-container">
      <main className="eh-main">
        <ExpenseHistoryHeader
          totalExpenses={dataHook.totalExpenses}
          filters={filterHook.filters}
          isManagerView={isManagerView}
        />

        <ExpenseHistoryFilters
          filters={filterHook.filters}
          setFilters={filterHook.setFilters}
          updateFilter={filterHook.updateFilter}
          clearFilters={filterHook.clearFilters}
          hasActiveFilters={filterHook.hasActiveFilters}
          activeFilterCount={filterHook.activeFilterCount}
          departments={optionsHook.departments}
          userOptions={userOptions}
          categoryOptions={optionsHook.categoryOptions}
          suppliers={optionsHook.suppliers}
          selectedCategoryOption={filterHook.selectedCategoryOption}
          onCategorySelect={handleCategorySelect}
        />

        <Card className="eh-content">
          <ExpenseTable
            expenses={dataHook.expenses}
            loading={dataHook.loading}
            error={dataHook.error}
            hasActiveFilters={filterHook.hasActiveFilters}
            onView={handleView}
            onEdit={handleEdit}
            onMove={handleMove}
            onDelete={handleDelete}
            isManagerView={isManagerView}
          />
          <ExpensePagination
            currentPage={currentPage}
            totalPages={dataHook.totalPages}
            onPageChange={setCurrentPage}
          />
        </Card>
      </main>

      {/* Modals */}
      <ExpenseEditModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        expense={selectedExpense}
        onSuccess={dataHook.fetchExpenses}
        subcategories={optionsHook.subcategories}
        suppliers={optionsHook.suppliers}
        creditCards={optionsHook.creditCards}
        isManagerView={isManagerView}
      />

      <MoveExpenseToYearModal
        isOpen={moveModalOpen}
        onClose={() => setMoveModalOpen(false)}
        expense={selectedExpense}
        onSuccess={handleMoveSuccess}
      />

      <ExpenseDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        expense={selectedExpense}
        onSuccess={dataHook.fetchExpenses}
      />
    </div>
  )
}

export default ExpenseHistory
