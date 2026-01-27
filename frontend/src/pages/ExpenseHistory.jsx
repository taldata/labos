import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, Button, Badge, Input, Select, TomSelectInput, Skeleton, EmptyState, Modal, useToast, FilePreviewButton, PageHeader } from '../components/ui'
import MoveExpenseToYearModal from '../components/MoveExpenseToYearModal'
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
        setError('Failed to load expenses')
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
// Custom Hook: useFilterOptions
// ============================================================================
function useFilterOptions() {
  const [departments, setDepartments] = useState([])
  const [users, setUsers] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryOptions, setCategoryOptions] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [creditCards, setCreditCards] = useState([])
  const [subcategories, setSubcategories] = useState([])

  const fetchFilterOptions = useCallback(async () => {
    try {
      // Use combined endpoint for better performance (1 request instead of 6)
      const response = await fetch('/api/v1/admin/expense-filter-options', { credentials: 'include' })

      if (response.ok) {
        const data = await response.json()

        // Departments
        setDepartments(data.departments || [])

        // Users
        setUsers(data.users || [])

        // Categories and category options
        const categoriesData = data.categories || []
        setCategories(categoriesData)

        const flattenedOptions = []
        categoriesData.forEach(cat => {
          flattenedOptions.push({
            id: `cat_${cat.id}`,
            name: cat.department_name ? `${cat.department_name} > ${cat.name}` : cat.name,
            type: 'category',
            category_id: cat.id,
            isHeader: true
          })
          if (cat.subcategories?.length > 0) {
            cat.subcategories.forEach(sub => {
              flattenedOptions.push({
                id: `sub_${sub.id}`,
                name: cat.department_name
                  ? `${cat.department_name} > ${cat.name} > ${sub.name}`
                  : `${cat.name} > ${sub.name}`,
                type: 'subcategory',
                category_id: cat.id,
                subcategory_id: sub.id
              })
            })
          }
        })
        setCategoryOptions(flattenedOptions)

        // Suppliers
        setSuppliers(data.suppliers || [])

        // Credit cards
        setCreditCards(data.credit_cards || [])

        // Subcategories
        setSubcategories(data.subcategories || [])
      } else {
        logger.error('Failed to fetch filter options', { status: response.status })
      }
    } catch (err) {
      logger.error('Failed to fetch filter options', { error: err.message })
    }
  }, [])

  return {
    departments,
    users,
    categories,
    categoryOptions,
    suppliers,
    creditCards,
    subcategories,
    fetchFilterOptions
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
              <option value="credit_card">Credit Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="standing_order">Standing Order</option>
            </Select>
            <Input
              type="text"
              label="Start Date"
              name="start_date"
              value={filters.start_date}
              onChange={handleFilterChange}
              placeholder="DD/MM/YYYY"
              pattern="\d{2}/\d{2}/\d{4}"
            />
          </div>

          {/* Row 3: End Date, Sort By, Order, Clear */}
          <div className="eh-filters__row">
            <Input
              type="text"
              label="End Date"
              name="end_date"
              value={filters.end_date}
              onChange={handleFilterChange}
              placeholder="DD/MM/YYYY"
              pattern="\d{2}/\d{2}/\d{4}"
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
function ExpenseRow({ expense, onView, onEdit, onMove, onDelete, formatDate, formatCurrency }) {
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
        {formatDate(expense.date)}
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
        {formatCurrency(expense.amount, expense.currency)}
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
          <Button
            variant="ghost"
            size="small"
            icon="fas fa-calendar-alt"
            onClick={() => onMove(expense)}
            title="Move to Different Year"
            className="eh-actions__move"
          />
          <Button
            variant="ghost"
            size="small"
            icon="fas fa-trash"
            onClick={() => onDelete(expense)}
            title="Delete"
            className="eh-actions__delete"
          />
        </div>
      </td>
    </tr>
  )
}

// ============================================================================
// Component: ExpenseTable
// ============================================================================
function ExpenseTable({ expenses, loading, error, hasActiveFilters, onView, onEdit, onMove, onDelete }) {
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
            <th className="eh-table__header eh-table__header--date">Date</th>
            <th className="eh-table__header eh-table__header--employee">Employee</th>
            <th className="eh-table__header eh-table__header--department">Department</th>
            <th className="eh-table__header eh-table__header--description">Description</th>
            <th className="eh-table__header eh-table__header--category">Category</th>
            <th className="eh-table__header eh-table__header--supplier">Supplier</th>
            <th className="eh-table__header eh-table__header--amount">Amount</th>
            <th className="eh-table__header eh-table__header--status">Status</th>
            <th className="eh-table__header eh-table__header--payment">Payment</th>
            <th className="eh-table__header eh-table__header--files">Files</th>
            <th className="eh-table__header eh-table__header--actions">Actions</th>
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
// Component: ExpenseEditModal
// ============================================================================
function ExpenseEditModal({ isOpen, onClose, expense, onSuccess, subcategories, suppliers, creditCards }) {
  const { success, error: showError } = useToast()
  const [formData, setFormData] = useState({})
  const [editFiles, setEditFiles] = useState({ quote: null, invoice: null, receipt: null })
  const [deleteFiles, setDeleteFiles] = useState({ quote: false, invoice: false, receipt: false })

  useEffect(() => {
    if (expense) {
      setFormData({
        status: expense.status || '',
        payment_status: expense.payment_status || '',
        amount: expense.amount || '',
        currency: expense.currency || 'ILS',
        description: expense.description || '',
        reason: expense.reason || '',
        type: expense.type || 'needs_approval',
        subcategory_id: expense.subcategory?.id || '',
        supplier_id: expense.supplier?.id || '',
        credit_card_id: expense.credit_card_id || '',
        payment_method: expense.payment_method || '',
        invoice_date: expense.invoice_date ? expense.invoice_date.split('T')[0] : '',
        rejection_reason: expense.rejection_reason || ''
      })
      setEditFiles({ quote: null, invoice: null, receipt: null })
      setDeleteFiles({ quote: false, invoice: false, receipt: false })
    }
  }, [expense])

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleFileChange = (e, fileType) => {
    const file = e.target.files[0]
    if (file) {
      setEditFiles(prev => ({ ...prev, [fileType]: file }))
      setDeleteFiles(prev => ({ ...prev, [fileType]: false }))
    }
  }

  const handleDeleteFile = (fileType) => {
    setDeleteFiles(prev => ({ ...prev, [fileType]: true }))
    setEditFiles(prev => ({ ...prev, [fileType]: null }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.description || !formData.supplier_id) {
      showError('Description and Supplier are required fields')
      return
    }

    try {
      const formDataToSend = new FormData()

      Object.entries(formData).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          formDataToSend.append(key, value)
        }
      })

      if (editFiles.quote) formDataToSend.append('quote', editFiles.quote)
      if (editFiles.invoice) formDataToSend.append('invoice', editFiles.invoice)
      if (editFiles.receipt) formDataToSend.append('receipt', editFiles.receipt)

      if (deleteFiles.quote) formDataToSend.append('delete_quote', 'true')
      if (deleteFiles.invoice) formDataToSend.append('delete_invoice', 'true')
      if (deleteFiles.receipt) formDataToSend.append('delete_receipt', 'true')

      const res = await fetch(`/api/v1/admin/expenses/${expense.id}`, {
        method: 'PUT',
        credentials: 'include',
        body: formDataToSend
      })

      if (res.ok) {
        success('Expense updated successfully')
        onSuccess()
        onClose()
      } else {
        const data = await res.json()
        showError(data.error || 'Failed to update expense')
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
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Expense" size="large">
      <form onSubmit={handleSubmit} className="eh-edit-form">
        {expense && (
          <div className="eh-edit-form__summary">
            <p><strong>Employee:</strong> {expense.user?.name}</p>
            <p><strong>Original Amount:</strong> {formatCurrency(expense.amount, expense.currency)}</p>
          </div>
        )}

        {/* Basic Information */}
        <div className="eh-edit-form__section">
          <h4 className="eh-edit-form__section-title">
            <i className="fas fa-info-circle" /> Basic Information
          </h4>
          <div className="eh-edit-form__row">
            <Input
              type="number"
              label="Amount"
              name="amount"
              value={formData.amount}
              onChange={(e) => handleInputChange('amount', e.target.value)}
              step="0.01"
              min="0"
            />
            <Select
              label="Currency"
              name="currency"
              value={formData.currency}
              onChange={(e) => handleInputChange('currency', e.target.value)}
            >
              <option value="ILS">ILS (₪)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </Select>
          </div>
          <Input
            label="Description"
            name="description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            required
          />
          <Input
            label="Business Reason"
            name="reason"
            value={formData.reason}
            onChange={(e) => handleInputChange('reason', e.target.value)}
          />
          <div className="eh-edit-form__row">
            <Select
              label="Type"
              name="type"
              value={formData.type}
              onChange={(e) => handleInputChange('type', e.target.value)}
            >
              <option value="needs_approval">Needs Approval</option>
              <option value="pre_approved">Pre-approved</option>
              <option value="reimbursement">Reimbursement</option>
            </Select>
            <TomSelectInput
              label="Subcategory"
              name="subcategory_id"
              value={formData.subcategory_id}
              onChange={(e) => handleInputChange('subcategory_id', e.target.value)}
              options={subcategories.map(sub => ({
                id: sub.id,
                name: `${sub.department_name} > ${sub.category_name} > ${sub.name}`
              }))}
              displayKey="name"
              valueKey="id"
              placeholder="Select Subcategory"
              allowClear={true}
            />
          </div>
        </div>

        {/* Status & Payment */}
        <div className="eh-edit-form__section">
          <h4 className="eh-edit-form__section-title">
            <i className="fas fa-check-circle" /> Status & Payment
          </h4>
          <div className="eh-edit-form__row">
            <Select
              label="Status"
              name="status"
              value={formData.status}
              onChange={(e) => handleInputChange('status', e.target.value)}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </Select>
            <Select
              label="Payment Status"
              name="payment_status"
              value={formData.payment_status}
              onChange={(e) => handleInputChange('payment_status', e.target.value)}
            >
              <option value="">Not Set</option>
              <option value="pending_attention">Pending Attention</option>
              <option value="pending_payment">Pending Payment</option>
              <option value="paid">Paid</option>
            </Select>
          </div>
          {formData.status === 'rejected' && (
            <Input
              label="Rejection Reason"
              name="rejection_reason"
              value={formData.rejection_reason}
              onChange={(e) => handleInputChange('rejection_reason', e.target.value)}
              placeholder="Enter reason for rejection..."
            />
          )}
          <div className="eh-edit-form__row">
            <Select
              label="Payment Method"
              name="payment_method"
              value={formData.payment_method}
              onChange={(e) => handleInputChange('payment_method', e.target.value)}
            >
              <option value="">Select Method</option>
              <option value="credit">Credit Card</option>
              <option value="transfer">Bank Transfer</option>
              <option value="standing_order">Standing Order</option>
            </Select>
            {formData.payment_method === 'credit' && (
              <Select
                label="Credit Card"
                name="credit_card_id"
                value={formData.credit_card_id}
                onChange={(e) => handleInputChange('credit_card_id', e.target.value)}
              >
                <option value="">Select Card</option>
                {creditCards.map(card => (
                  <option key={card.id} value={card.id}>
                    {card.name} (*{card.last_four_digits})
                  </option>
                ))}
              </Select>
            )}
          </div>
        </div>

        {/* Supplier & Date */}
        <div className="eh-edit-form__section">
          <h4 className="eh-edit-form__section-title">
            <i className="fas fa-store" /> Supplier & Date
          </h4>
          <div className="eh-edit-form__row">
            <TomSelectInput
              label="Supplier"
              name="supplier_id"
              value={formData.supplier_id}
              onChange={(e) => handleInputChange('supplier_id', e.target.value)}
              options={suppliers}
              displayKey="name"
              valueKey="id"
              placeholder="Select Supplier"
              allowClear={false}
              required
            />
            <Input
              type="date"
              label="Invoice Date"
              name="invoice_date"
              value={formData.invoice_date}
              onChange={(e) => handleInputChange('invoice_date', e.target.value)}
            />
          </div>
        </div>

        {/* Attachments */}
        <div className="eh-edit-form__section">
          <h4 className="eh-edit-form__section-title">
            <i className="fas fa-paperclip" /> Attachments
          </h4>
          <div className="eh-edit-form__files">
            {['quote', 'invoice', 'receipt'].map(fileType => (
              <div key={fileType} className="eh-file-upload">
                <label className="eh-file-upload__label">
                  {fileType.charAt(0).toUpperCase() + fileType.slice(1)}
                </label>
                {expense?.[`${fileType}_filename`] && !deleteFiles[fileType] && !editFiles[fileType] ? (
                  <div className="eh-file-upload__existing">
                    <a href={`/download/${expense[`${fileType}_filename`]}`} target="_blank" rel="noopener noreferrer">
                      <i className={`fas ${fileType === 'invoice' ? 'fa-file-invoice-dollar' : fileType === 'receipt' ? 'fa-receipt' : 'fa-file-alt'}`} />
                      View {fileType.charAt(0).toUpperCase() + fileType.slice(1)}
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="small"
                      icon="fas fa-trash"
                      onClick={() => handleDeleteFile(fileType)}
                      title={`Delete ${fileType}`}
                    />
                  </div>
                ) : deleteFiles[fileType] ? (
                  <div className="eh-file-upload__deleted">
                    <span><i className="fas fa-times-circle" /> Will be deleted</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="small"
                      onClick={() => setDeleteFiles(prev => ({ ...prev, [fileType]: false }))}
                    >
                      Undo
                    </Button>
                  </div>
                ) : null}
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => handleFileChange(e, fileType)}
                  className="eh-file-upload__input"
                />
                {editFiles[fileType] && (
                  <span className="eh-file-upload__new">
                    <i className="fas fa-check" /> {editFiles[fileType].name}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="eh-edit-form__actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
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
  const optionsHook = useFilterOptions()

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

  // Fetch expenses when debounced filters or page change
  useEffect(() => {
    const hasAccess = isManagerView
      ? (user?.is_manager || user?.is_admin)
      : user?.is_admin

    if (hasAccess) {
      dataHook.fetchExpenses()
    }
  }, [currentPage, filterHook.debouncedFilters])

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
