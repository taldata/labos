import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { Card, Button, Badge, Input, Select, Skeleton, EmptyState, Modal, useToast } from '../components/ui'
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
    supplier_id: '',
    payment_method: '',
    search: '',
    start_date: '',
    end_date: '',
    sort_by: 'date',
    sort_order: 'desc'
  })

  // Filter options
  const [departments, setDepartments] = useState([])
  const [users, setUsers] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [supplierSearch, setSupplierSearch] = useState('')
  const [showFilters, setShowFilters] = useState(true)

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [currentExpense, setCurrentExpense] = useState(null)
  const [editFormData, setEditFormData] = useState({
    status: '',
    payment_status: '',
    accounting_notes: ''
  })

  // Delete confirmation
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [expenseToDelete, setExpenseToDelete] = useState(null)

  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/dashboard')
      return
    }
    fetchFilterOptions()
  }, [])

  useEffect(() => {
    if (user?.is_admin) {
      fetchExpenses()
    }
  }, [currentPage, filters])

  const fetchFilterOptions = async () => {
    try {
      const [deptRes, userRes, catRes, suppRes] = await Promise.all([
        fetch('/api/v1/form-data/departments', { credentials: 'include' }),
        fetch('/api/v1/admin/users', { credentials: 'include' }),
        fetch('/api/v1/form-data/categories', { credentials: 'include' }),
        fetch('/api/v1/form-data/suppliers', { credentials: 'include' })
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
        setCategories(data.categories || [])
      }
      if (suppRes.ok) {
        const data = await suppRes.json()
        setSuppliers(data.suppliers || [])
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
      supplier_id: '',
      payment_method: '',
      search: '',
      start_date: '',
      end_date: '',
      sort_by: 'date',
      sort_order: 'desc'
    })
    setSupplierSearch('')
    setCurrentPage(1)
  }

  const openEditModal = (expense) => {
    setCurrentExpense(expense)
    setEditFormData({
      status: expense.status,
      payment_status: expense.payment_status || '',
      accounting_notes: expense.accounting_notes || ''
    })
    setEditModalOpen(true)
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`/api/v1/admin/expenses/${currentExpense.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editFormData)
      })

      if (res.ok) {
        success('Expense updated successfully')
        setEditModalOpen(false)
        fetchExpenses()
      } else {
        const data = await res.json()
        showError(data.error || 'Failed to update expense')
      }
    } catch (err) {
      showError('An error occurred')
    }
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

  // Filter suppliers based on search
  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(supplierSearch.toLowerCase())
  )

  if (!user?.is_admin) return null

  return (
    <div className="expense-history-container">
      <Header user={user} setUser={setUser} currentPage="admin" />

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
                  placeholder="Search description, reason, or employee..."
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

                <Input
                  label="Search Supplier"
                  name="supplier_search"
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  placeholder="Type to search suppliers..."
                  icon="fas fa-search"
                />

                <Select
                  label="Supplier"
                  name="supplier_id"
                  value={filters.supplier_id}
                  onChange={handleFilterChange}
                >
                  <option value="">All Suppliers</option>
                  {filteredSuppliers.map(sup => (
                    <option key={sup.id} value={sup.id}>{sup.name}</option>
                  ))}
                </Select>

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
              <Skeleton.Table rows={8} columns={8} />
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
                            {expense.status.charAt(0).toUpperCase() + expense.status.slice(1)}
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
        size="medium"
      >
        <form onSubmit={handleEditSubmit} className="edit-form">
          {currentExpense && (
            <div className="expense-summary">
              <p><strong>Employee:</strong> {currentExpense.user?.name}</p>
              <p><strong>Amount:</strong> {formatCurrency(currentExpense.amount, currentExpense.currency)}</p>
              <p><strong>Description:</strong> {currentExpense.description}</p>
            </div>
          )}

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
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </Select>

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
