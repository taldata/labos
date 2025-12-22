import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Badge, Input, Select, SearchableSelect, Skeleton, EmptyState, Modal, useToast } from '../components/ui'
import MoveExpenseToYearModal from '../components/MoveExpenseToYearModal'
import './ExpenseHistory.css'

function ExpenseHistory({ user, setUser }) {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
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
  })

  // Selected category option for display in SearchableSelect
  const [selectedCategoryOption, setSelectedCategoryOption] = useState('')

  // Filter options
  const [departments, setDepartments] = useState([])
  const [users, setUsers] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryOptions, setCategoryOptions] = useState([]) // Flattened list for SearchableSelect
  const [suppliers, setSuppliers] = useState([])
  const [showFilters, setShowFilters] = useState(true)

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [currentExpense, setCurrentExpense] = useState(null)
  const [editFormData, setEditFormData] = useState({
    status: '',
    payment_status: '',
    amount: '',
    currency: 'ILS',
    description: '',
    reason: '',
    type: '',
    subcategory_id: '',
    supplier_id: '',
    credit_card_id: '',
    payment_method: '',
    invoice_date: '',
    rejection_reason: ''
  })
  const [editFiles, setEditFiles] = useState({
    quote: null,
    invoice: null,
    receipt: null
  })
  const [deleteFiles, setDeleteFiles] = useState({
    quote: false,
    invoice: false,
    receipt: false
  })
  const [creditCards, setCreditCards] = useState([])
  const [subcategories, setSubcategories] = useState([])

  // Delete confirmation
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [expenseToDelete, setExpenseToDelete] = useState(null)

  // Move to year modal
  const [moveModalOpen, setMoveModalOpen] = useState(false)
  const [expenseToMove, setExpenseToMove] = useState(null)

  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/dashboard')
      return
    }
    fetchFilterOptions()

    // Check for URL parameters and set filters accordingly
    const urlParams = new URLSearchParams(window.location.search)
    const newFilters = { ...filters }

    if (urlParams.get('department_id')) {
      newFilters.department_id = urlParams.get('department_id')
    }
    if (urlParams.get('category_id')) {
      newFilters.category_id = urlParams.get('category_id')
    }
    if (urlParams.get('user_id')) {
      newFilters.user_id = urlParams.get('user_id')
    }

    setFilters(newFilters)
  }, [])

  useEffect(() => {
    if (user?.is_admin) {
      fetchExpenses()
    }
  }, [currentPage, filters])

  const fetchFilterOptions = async () => {
    try {
      const [deptRes, userRes, catRes, suppRes, ccRes, subcatRes] = await Promise.all([
        fetch('/api/v1/form-data/departments', { credentials: 'include' }),
        fetch('/api/v1/admin/users', { credentials: 'include' }),
        fetch('/api/v1/form-data/categories?all=true&include_subcategories=true', { credentials: 'include' }),
        fetch('/api/v1/form-data/suppliers', { credentials: 'include' }),
        fetch('/api/v1/form-data/credit-cards', { credentials: 'include' }),
        fetch('/api/v1/form-data/subcategories?all=true', { credentials: 'include' })
      ])

      if (deptRes.ok) {
        const data = await deptRes.json()
        setDepartments(data.departments || [])
      }
      if (userRes.ok) {
        const data = await userRes.json()
        setUsers(data.users || [])
      }
      if (catRes.ok) {
        const data = await catRes.json()
        const categoriesData = data.categories || []
        setCategories(categoriesData)

        // Create flattened list with categories and subcategories for SearchableSelect
        const flattenedOptions = []
        categoriesData.forEach(cat => {
          // Add category as a header/group item
          flattenedOptions.push({
            id: `cat_${cat.id}`,
            name: cat.department_name ? `${cat.department_name} > ${cat.name}` : cat.name,
            type: 'category',
            category_id: cat.id,
            isHeader: true
          })
          // Add subcategories under the category
          if (cat.subcategories && cat.subcategories.length > 0) {
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
      }
      if (suppRes.ok) {
        const data = await suppRes.json()
        setSuppliers(data.suppliers || [])
      }
      if (ccRes.ok) {
        const data = await ccRes.json()
        setCreditCards(data.credit_cards || [])
      }
      if (subcatRes.ok) {
        const data = await subcatRes.json()
        setSubcategories(data.subcategories || [])
      }
    } catch (err) {
      console.error('Failed to fetch filter options:', err)
    }
  }

  const fetchExpenses = async () => {
    try {
      setLoading(true)
      setError('')

      const params = new URLSearchParams({
        page: currentPage,
        per_page: 25,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== '')
        )
      })

      const response = await fetch(`/api/v1/admin/expenses?${params}`, {
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
    setCurrentPage(1)
  }

  const clearFilters = () => {
    setFilters({
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
    })
    setSelectedCategoryOption('')
    setCurrentPage(1)
  }

  // Handle category/subcategory selection from SearchableSelect
  const handleCategorySelect = (e) => {
    const selectedId = e.target.value
    setSelectedCategoryOption(selectedId)

    if (!selectedId) {
      setFilters(prev => ({ ...prev, category_id: '', subcategory_id: '' }))
      setCurrentPage(1)
      return
    }

    const selectedOption = categoryOptions.find(opt => opt.id === selectedId)
    if (selectedOption) {
      if (selectedOption.type === 'category') {
        setFilters(prev => ({
          ...prev,
          category_id: selectedOption.category_id,
          subcategory_id: ''
        }))
      } else {
        setFilters(prev => ({
          ...prev,
          category_id: selectedOption.category_id,
          subcategory_id: selectedOption.subcategory_id
        }))
      }
      setCurrentPage(1)
    }
  }

  const openEditModal = (expense) => {
    setCurrentExpense(expense)
    setEditFormData({
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
    setEditModalOpen(true)
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    try {
      const formData = new FormData()

      // Add all form fields
      Object.entries(editFormData).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          formData.append(key, value)
        }
      })

      // Add files if selected
      if (editFiles.quote) {
        formData.append('quote', editFiles.quote)
      }
      if (editFiles.invoice) {
        formData.append('invoice', editFiles.invoice)
      }
      if (editFiles.receipt) {
        formData.append('receipt', editFiles.receipt)
      }

      // Add delete file flags
      if (deleteFiles.quote) {
        formData.append('delete_quote', 'true')
      }
      if (deleteFiles.invoice) {
        formData.append('delete_invoice', 'true')
      }
      if (deleteFiles.receipt) {
        formData.append('delete_receipt', 'true')
      }

      const res = await fetch(`/api/v1/admin/expenses/${currentExpense.id}`, {
        method: 'PUT',
        credentials: 'include',
        body: formData
      })

      if (res.ok) {
        success('Expense updated successfully')
        setEditModalOpen(false)
        setEditFiles({ quote: null, invoice: null, receipt: null })
        setDeleteFiles({ quote: false, invoice: false, receipt: false })
        fetchExpenses()
      } else {
        const data = await res.json()
        showError(data.error || 'Failed to update expense')
      }
    } catch (err) {
      showError('An error occurred')
    }
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

  const openDeleteModal = (expense) => {
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
        fetchExpenses()
      } else {
        const data = await res.json()
        showError(data.error || 'Failed to delete expense')
      }
    } catch (err) {
      showError('An error occurred')
    }
  }

  const openMoveModal = (expense) => {
    setExpenseToMove(expense)
    setMoveModalOpen(true)
  }

  const handleMoveSuccess = (data) => {
    success(`Expense moved successfully from year ${data.old_year} to ${data.new_year}`)
    setMoveModalOpen(false)
    setExpenseToMove(null)
    fetchExpenses()
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

  const getPaymentStatusVariant = (status) => {
    const variants = {
      pending: 'warning',
      paid: 'success',
      cancelled: 'danger'
    }
    return variants[status] || 'default'
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

  const hasActiveFilters = Object.entries(filters).some(([key, val]) =>
    val !== '' && !['sort_by', 'sort_order'].includes(key)
  )

  if (!user?.is_admin) return null

  return (
    <div className="expense-history-container">

      <main className="expense-history-main">
        <div className="page-header-section">
          <div>
            <h1>Expense History</h1>
            <p className="subtitle">{totalExpenses} total expenses</p>
          </div>
          <div className="header-actions">
            <Button
              variant="secondary"
              icon="fas fa-download"
              onClick={() => window.open('/api/v1/expenses/export?' + new URLSearchParams(
                Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
              ).toString(), '_blank')}
            >
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="filters-section">
          <div className="filters-header" onClick={() => setShowFilters(!showFilters)}>
            <div className="filters-title">
              <i className="fas fa-filter"></i>
              <span>Filters & Search</span>
              {hasActiveFilters && (
                <Badge variant="primary" size="small">
                  {Object.entries(filters).filter(([k, v]) => v && !['sort_by', 'sort_order'].includes(k)).length} active
                </Badge>
              )}
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
                  placeholder="Search description, reason, employee, supplier, or amount..."
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

                <Select
                  label="Department"
                  name="department_id"
                  value={filters.department_id}
                  onChange={handleFilterChange}
                >
                  <option value="">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </Select>

                <Select
                  label="Employee"
                  name="user_id"
                  value={filters.user_id}
                  onChange={handleFilterChange}
                >
                  <option value="">All Employees</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="filter-row">
                <SearchableSelect
                  label="Category"
                  name="category_id"
                  value={selectedCategoryOption}
                  onChange={handleCategorySelect}
                  options={categoryOptions}
                  placeholder="All Categories"
                  searchPlaceholder="Search categories..."
                  displayKey="name"
                  valueKey="id"
                />

                <SearchableSelect
                  label="Supplier"
                  name="supplier_id"
                  value={filters.supplier_id}
                  onChange={handleFilterChange}
                  options={suppliers}
                  placeholder="All Suppliers"
                  searchPlaceholder="Search suppliers..."
                  displayKey="name"
                  valueKey="id"
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
                  type="date"
                  label="Start Date"
                  name="start_date"
                  value={filters.start_date}
                  onChange={handleFilterChange}
                />
              </div>

              <div className="filter-row">
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

                <div className="filter-actions-inline">
                  <Button variant="secondary" icon="fas fa-times" onClick={clearFilters}>
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Expenses Table */}
        <Card className="expenses-list-card">
          {error && (
            <div className="error-alert">
              <i className="fas fa-exclamation-circle"></i>
              {error}
            </div>
          )}

          {loading ? (
            <div className="loading-state">
              <Skeleton.Table rows={8} columns={11} />
            </div>
          ) : expenses.length === 0 ? (
            <EmptyState
              icon="fas fa-receipt"
              title="No expenses found"
              description={hasActiveFilters
                ? "Try adjusting your filters to find what you're looking for"
                : "No expenses have been submitted yet."}
            />
          ) : (
            <>
              <div className="expenses-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Supplier</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Payment</th>
                      <th>Files</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map(expense => (
                      <tr key={expense.id} className="expense-row">
                        <td>{formatDate(expense.date)}</td>
                        <td>
                          <div className="employee-info">
                            <div className="employee-avatar">
                              {expense.user?.name?.[0]?.toUpperCase() || '?'}
                            </div>
                            <span>{expense.user?.name || 'Unknown'}</span>
                          </div>
                        </td>
                        <td>
                          <Badge variant="default" size="small">
                            {expense.user?.department || '-'}
                          </Badge>
                        </td>
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
                              <Badge variant="primary-solid" size="small">{expense.category.name}</Badge>
                            )}
                            {expense.subcategory?.name && (
                              <span className="subcategory-text">{expense.subcategory.name}</span>
                            )}
                          </div>
                        </td>
                        <td>{expense.supplier?.name || '-'}</td>
                        <td className="amount-cell">
                          {formatCurrency(expense.amount, expense.currency)}
                        </td>
                        <td>
                          <Badge variant={getStatusVariant(expense.status)} size="small" rounded>
                            {expense.status ? expense.status.charAt(0).toUpperCase() + expense.status.slice(1) : '-'}
                          </Badge>
                        </td>
                        <td>
                          {expense.payment_status ? (
                            <Badge variant={getPaymentStatusVariant(expense.payment_status)} size="small">
                              {expense.payment_status}
                            </Badge>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td className="files-cell">
                          {(expense.has_invoice || expense.has_receipt || expense.has_quote) ? (
                            <div className="file-icons">
                              {expense.invoice_filename && (
                                <Button
                                  variant="ghost"
                                  size="small"
                                  icon="fas fa-file-invoice"
                                  onClick={() => window.open(`/download/${expense.invoice_filename}`, '_blank')}
                                  title="Download Invoice"
                                />
                              )}
                              {expense.receipt_filename && (
                                <Button
                                  variant="ghost"
                                  size="small"
                                  icon="fas fa-receipt"
                                  onClick={() => window.open(`/download/${expense.receipt_filename}`, '_blank')}
                                  title="Download Receipt"
                                />
                              )}
                              {expense.quote_filename && (
                                <Button
                                  variant="ghost"
                                  size="small"
                                  icon="fas fa-file-alt"
                                  onClick={() => window.open(`/download/${expense.quote_filename}`, '_blank')}
                                  title="Download Quote"
                                />
                              )}
                            </div>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td className="actions-cell">
                          <Button
                            variant="ghost"
                            size="small"
                            icon="fas fa-eye"
                            onClick={() => navigate(`/expenses/${expense.id}`)}
                            title="View Details"
                          />
                          <Button
                            variant="ghost"
                            size="small"
                            icon="fas fa-edit"
                            onClick={() => openEditModal(expense)}
                            title="Edit"
                          />
                          <Button
                            variant="ghost"
                            size="small"
                            icon="fas fa-calendar-alt"
                            onClick={() => openMoveModal(expense)}
                            title="Move to Different Year"
                            className="btn-move-year"
                          />
                          <Button
                            variant="ghost"
                            size="small"
                            icon="fas fa-trash"
                            onClick={() => openDeleteModal(expense)}
                            title="Delete"
                            className="btn-delete"
                          />
                        </td>
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
      </main>

      {/* Edit Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Expense"
        size="large"
      >
        <form onSubmit={handleEditSubmit} className="edit-form">
          {currentExpense && (
            <div className="expense-summary">
              <p><strong>Employee:</strong> {currentExpense.user?.name}</p>
              <p><strong>Original Amount:</strong> {formatCurrency(currentExpense.amount, currentExpense.currency)}</p>
            </div>
          )}

          <div className="form-section">
            <h4 className="section-title"><i className="fas fa-info-circle"></i> Basic Information</h4>
            <div className="form-row">
              <Input
                type="number"
                label="Amount"
                name="amount"
                value={editFormData.amount}
                onChange={(e) => setEditFormData(prev => ({ ...prev, amount: e.target.value }))}
                step="0.01"
                min="0"
              />
              <Select
                label="Currency"
                name="currency"
                value={editFormData.currency}
                onChange={(e) => setEditFormData(prev => ({ ...prev, currency: e.target.value }))}
              >
                <option value="ILS">ILS (₪)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </Select>
            </div>

            <Input
              label="Description"
              name="description"
              value={editFormData.description}
              onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
            />

            <Input
              label="Business Reason"
              name="reason"
              value={editFormData.reason}
              onChange={(e) => setEditFormData(prev => ({ ...prev, reason: e.target.value }))}
            />

            <div className="form-row">
              <Select
                label="Type"
                name="type"
                value={editFormData.type}
                onChange={(e) => setEditFormData(prev => ({ ...prev, type: e.target.value }))}
              >
                <option value="needs_approval">Needs Approval</option>
                <option value="pre_approved">Pre-approved</option>
                <option value="reimbursement">Reimbursement</option>
              </Select>
              <Select
                label="Subcategory"
                name="subcategory_id"
                value={editFormData.subcategory_id}
                onChange={(e) => setEditFormData(prev => ({ ...prev, subcategory_id: e.target.value }))}
              >
                <option value="">Select Subcategory</option>
                {subcategories.map(sub => (
                  <option key={sub.id} value={sub.id}>
                    {sub.department_name} &gt; {sub.category_name} &gt; {sub.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="form-section">
            <h4 className="section-title"><i className="fas fa-check-circle"></i> Status & Payment</h4>
            <div className="form-row">
              <Select
                label="Status"
                name="status"
                value={editFormData.status}
                onChange={(e) => setEditFormData(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </Select>
              <Select
                label="Payment Status"
                name="payment_status"
                value={editFormData.payment_status}
                onChange={(e) => setEditFormData(prev => ({ ...prev, payment_status: e.target.value }))}
              >
                <option value="">Not Set</option>
                <option value="pending_attention">Pending Attention</option>
                <option value="pending_payment">Pending Payment</option>
                <option value="paid">Paid</option>
              </Select>
            </div>

            {editFormData.status === 'rejected' && (
              <Input
                label="Rejection Reason"
                name="rejection_reason"
                value={editFormData.rejection_reason}
                onChange={(e) => setEditFormData(prev => ({ ...prev, rejection_reason: e.target.value }))}
                placeholder="Enter reason for rejection..."
              />
            )}

            <div className="form-row">
              <Select
                label="Payment Method"
                name="payment_method"
                value={editFormData.payment_method}
                onChange={(e) => setEditFormData(prev => ({ ...prev, payment_method: e.target.value }))}
              >
                <option value="">Select Method</option>
                <option value="credit">Credit Card</option>
                <option value="transfer">Bank Transfer</option>
                <option value="standing_order">Standing Order</option>
              </Select>
              {editFormData.payment_method === 'credit' && (
                <Select
                  label="Credit Card"
                  name="credit_card_id"
                  value={editFormData.credit_card_id}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, credit_card_id: e.target.value }))}
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

          <div className="form-section">
            <h4 className="section-title"><i className="fas fa-store"></i> Supplier & Date</h4>
            <div className="form-row">
              <Select
                label="Supplier"
                name="supplier_id"
                value={editFormData.supplier_id}
                onChange={(e) => setEditFormData(prev => ({ ...prev, supplier_id: e.target.value }))}
              >
                <option value="">Select Supplier</option>
                {suppliers.map(sup => (
                  <option key={sup.id} value={sup.id}>{sup.name}</option>
                ))}
              </Select>
              <Input
                type="date"
                label="Invoice Date"
                name="invoice_date"
                value={editFormData.invoice_date}
                onChange={(e) => setEditFormData(prev => ({ ...prev, invoice_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-section">
            <h4 className="section-title"><i className="fas fa-paperclip"></i> Attachments</h4>

            <div className="file-upload-grid">
              <div className="file-upload-item">
                <label className="file-label">Quote</label>
                {currentExpense?.quote_filename && !deleteFiles.quote && !editFiles.quote ? (
                  <div className="existing-file">
                    <a href={`/download/${currentExpense.quote_filename}`} target="_blank" rel="noopener noreferrer">
                      <i className="fas fa-file-alt"></i> View Quote
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="small"
                      icon="fas fa-trash"
                      onClick={() => handleDeleteFile('quote')}
                      title="Delete Quote"
                    />
                  </div>
                ) : deleteFiles.quote ? (
                  <div className="file-deleted">
                    <span><i className="fas fa-times-circle"></i> Will be deleted</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="small"
                      onClick={() => setDeleteFiles(prev => ({ ...prev, quote: false }))}
                    >
                      Undo
                    </Button>
                  </div>
                ) : null}
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => handleFileChange(e, 'quote')}
                  className="file-input"
                />
                {editFiles.quote && (
                  <span className="new-file-name"><i className="fas fa-check"></i> {editFiles.quote.name}</span>
                )}
              </div>

              <div className="file-upload-item">
                <label className="file-label">Invoice</label>
                {currentExpense?.invoice_filename && !deleteFiles.invoice && !editFiles.invoice ? (
                  <div className="existing-file">
                    <a href={`/download/${currentExpense.invoice_filename}`} target="_blank" rel="noopener noreferrer">
                      <i className="fas fa-file-invoice"></i> View Invoice
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="small"
                      icon="fas fa-trash"
                      onClick={() => handleDeleteFile('invoice')}
                      title="Delete Invoice"
                    />
                  </div>
                ) : deleteFiles.invoice ? (
                  <div className="file-deleted">
                    <span><i className="fas fa-times-circle"></i> Will be deleted</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="small"
                      onClick={() => setDeleteFiles(prev => ({ ...prev, invoice: false }))}
                    >
                      Undo
                    </Button>
                  </div>
                ) : null}
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => handleFileChange(e, 'invoice')}
                  className="file-input"
                />
                {editFiles.invoice && (
                  <span className="new-file-name"><i className="fas fa-check"></i> {editFiles.invoice.name}</span>
                )}
              </div>

              <div className="file-upload-item">
                <label className="file-label">Receipt</label>
                {currentExpense?.receipt_filename && !deleteFiles.receipt && !editFiles.receipt ? (
                  <div className="existing-file">
                    <a href={`/download/${currentExpense.receipt_filename}`} target="_blank" rel="noopener noreferrer">
                      <i className="fas fa-receipt"></i> View Receipt
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="small"
                      icon="fas fa-trash"
                      onClick={() => handleDeleteFile('receipt')}
                      title="Delete Receipt"
                    />
                  </div>
                ) : deleteFiles.receipt ? (
                  <div className="file-deleted">
                    <span><i className="fas fa-times-circle"></i> Will be deleted</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="small"
                      onClick={() => setDeleteFiles(prev => ({ ...prev, receipt: false }))}
                    >
                      Undo
                    </Button>
                  </div>
                ) : null}
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => handleFileChange(e, 'receipt')}
                  className="file-input"
                />
                {editFiles.receipt && (
                  <span className="new-file-name"><i className="fas fa-check"></i> {editFiles.receipt.name}</span>
                )}
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Move to Year Modal */}
      <MoveExpenseToYearModal
        isOpen={moveModalOpen}
        onClose={() => setMoveModalOpen(false)}
        expense={expenseToMove}
        onSuccess={handleMoveSuccess}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Expense"
        size="small"
      >
        <div className="delete-confirmation">
          <i className="fas fa-exclamation-triangle warning-icon"></i>
          <p>Are you sure you want to delete this expense?</p>
          {expenseToDelete && (
            <div className="expense-summary">
              <p><strong>Employee:</strong> {expenseToDelete.user?.name}</p>
              <p><strong>Amount:</strong> {formatCurrency(expenseToDelete.amount, expenseToDelete.currency)}</p>
              <p><strong>Description:</strong> {expenseToDelete.description}</p>
            </div>
          )}
          <p className="warning-text">This action cannot be undone.</p>
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

export default ExpenseHistory
