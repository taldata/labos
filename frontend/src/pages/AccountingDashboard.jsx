import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, Button, Badge, Input, Select, Skeleton, EmptyState, useToast, FilePreviewButton, PageHeader } from '../components/ui'
import logger from '../utils/logger'
import './AccountingDashboard.css'

// ============================================================================
// Helpers
// ============================================================================
const formatDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

const formatDateTime = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${day}/${month} ${hours}:${minutes}`
}

const formatCurrency = (amount, currency) => {
  if (amount == null) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'ILS'
  }).format(amount)
}

const formatPaymentMethod = (method) => {
  const map = {
    credit: 'Credit Card',
    transfer: 'Bank Transfer',
    standing_order: 'Standing Order'
  }
  return map[method] || method || '-'
}

const formatPaymentDueDate = (val) => {
  const map = {
    start_of_month: 'Start of month',
    end_of_month: 'End of month',
    international_transfer: 'International Transfer'
  }
  return map[val] || 'End of month'
}

// ============================================================================
// Summary Cards
// ============================================================================
function SummaryCards({ summary }) {
  const cards = [
    {
      label: 'Total Approved',
      count: summary.total_count,
      amount: summary.total_amount,
      icon: 'fas fa-receipt',
      color: '#667eea',
      bg: '#eef2ff'
    },
    {
      label: 'Paid',
      count: summary.paid_count,
      amount: summary.paid_amount,
      icon: 'fas fa-check-circle',
      color: '#10b981',
      bg: '#ecfdf5'
    },
    {
      label: 'Pending Payment',
      count: summary.pending_count,
      amount: summary.pending_amount,
      icon: 'fas fa-clock',
      color: '#f59e0b',
      bg: '#fffbeb'
    },
    {
      label: 'External Accounting',
      count: summary.external_entered_count,
      amount: null,
      icon: 'fas fa-building-columns',
      color: '#8b5cf6',
      bg: '#f5f3ff',
      subtitle: `${summary.external_not_entered_count} not entered`
    }
  ]

  return (
    <div className="acct-summary-grid">
      {cards.map((card) => (
        <div key={card.label} className="acct-summary-card" style={{ '--card-color': card.color, '--card-bg': card.bg }}>
          <div className="acct-summary-card__icon">
            <i className={card.icon} />
          </div>
          <div className="acct-summary-card__content">
            <span className="acct-summary-card__label">{card.label}</span>
            <span className="acct-summary-card__value">
              {card.amount != null ? formatCurrency(card.amount, 'ILS') : card.count}
            </span>
            <span className="acct-summary-card__sub">
              {card.subtitle || `${card.count} expenses`}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Filters
// ============================================================================
function AccountingFilters({ filters, onChange, onClear, monthOptions }) {
  const [isExpanded, setIsExpanded] = useState(true)

  const handleChange = (e) => {
    onChange(e.target.name, e.target.value)
  }

  const hasFilters = Object.entries(filters).some(([k, v]) =>
    v !== 'all' && v !== '' && k !== 'page'
  )

  return (
    <Card className="acct-filters">
      <button
        className="acct-filters__header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="acct-filters__title">
          <i className="fas fa-sliders-h" />
          <span>Filters</span>
          {hasFilters && (
            <Badge variant="primary" size="small">Active</Badge>
          )}
        </div>
        <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`} />
      </button>

      {isExpanded && (
        <div className="acct-filters__body">
          <div className="acct-filters__row">
            <Select label="Month" name="month" value={filters.month} onChange={handleChange}>
              <option value="all">All Months</option>
              {monthOptions.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </Select>
            <Select label="Payment Method" name="payment_method" value={filters.payment_method} onChange={handleChange}>
              <option value="all">All Methods</option>
              <option value="credit">Credit Card</option>
              <option value="transfer">Bank Transfer</option>
              <option value="standing_order">Standing Order</option>
            </Select>
            <Select label="Payment Status" name="payment_status" value={filters.payment_status} onChange={handleChange}>
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
            </Select>
            <Select label="Payment Due" name="payment_due_date" value={filters.payment_due_date} onChange={handleChange}>
              <option value="all">All</option>
              <option value="start_of_month">Start of month</option>
              <option value="end_of_month">End of month</option>
            </Select>
          </div>
          <div className="acct-filters__row">
            <Select label="Invoice Date" name="invoice_date" value={filters.invoice_date} onChange={handleChange}>
              <option value="all">All Dates</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_quarter">This Quarter</option>
              <option value="this_year">This Year</option>
            </Select>
            <Select label="External Accounting" name="external_accounting" value={filters.external_accounting} onChange={handleChange}>
              <option value="all">All</option>
              <option value="entered">Entered</option>
              <option value="not_entered">Not Entered</option>
            </Select>
            <Input
              label="Supplier"
              name="supplier_search"
              value={filters.supplier_search}
              onChange={handleChange}
              placeholder="Search supplier..."
              icon="fas fa-building"
            />
            <Input
              label="Search"
              name="search_text"
              value={filters.search_text}
              onChange={handleChange}
              placeholder="Description, notes..."
              icon="fas fa-search"
            />
          </div>
          <div className="acct-filters__row acct-filters__row--actions">
            <div className="acct-filters__amount-range">
              <Input
                type="number"
                label="Min Amount"
                name="amount_min"
                value={filters.amount_min}
                onChange={handleChange}
                placeholder="0"
                step="0.01"
              />
              <span className="acct-filters__separator">-</span>
              <Input
                type="number"
                label="Max Amount"
                name="amount_max"
                value={filters.amount_max}
                onChange={handleChange}
                placeholder="No limit"
                step="0.01"
              />
            </div>
            <div className="acct-filters__btns">
              <Button variant="secondary" icon="fas fa-times" onClick={onClear} disabled={!hasFilters}>
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
// Expense Row (card-based for modern look)
// ============================================================================
function ExpenseCard({ expense, onMarkPaid, onMarkUnpaid, onMarkPending, onMarkExternal, onUnmarkExternal, actionLoading }) {
  const [expanded, setExpanded] = useState(false)

  const getPaymentStatusBadge = () => {
    if (expense.payment_method === 'credit') {
      return <Badge variant="info" size="small" icon="fas fa-credit-card">Auto-paid</Badge>
    }
    if (expense.payment_status === 'paid') {
      return <Badge variant="success" size="small" icon="fas fa-check">Paid</Badge>
    }
    if (expense.payment_status === 'pending_payment') {
      return <Badge variant="warning" size="small" icon="fas fa-clock">Pending Payment</Badge>
    }
    return <Badge variant="warning" size="small" icon="fas fa-exclamation-circle">Pending Attention</Badge>
  }

  const isLoading = actionLoading === expense.id

  return (
    <div className={`acct-expense ${expanded ? 'acct-expense--expanded' : ''}`}>
      {/* Main row */}
      <div className="acct-expense__main" onClick={() => setExpanded(!expanded)}>
        <div className="acct-expense__left">
          <div className="acct-expense__date">{formatDate(expense.date)}</div>
          <div className="acct-expense__supplier">
            {expense.supplier?.name || 'No supplier'}
          </div>
          <div className="acct-expense__description">{expense.description}</div>
        </div>
        <div className="acct-expense__center">
          <div className="acct-expense__amount">
            {formatCurrency(expense.amount, expense.currency)}
            {expense.currency !== 'ILS' && expense.amount_ils && (
              <span className="acct-expense__amount-ils">
                ({formatCurrency(expense.amount_ils, 'ILS')})
              </span>
            )}
          </div>
          <div className="acct-expense__method">
            {formatPaymentMethod(expense.payment_method)}
            {expense.credit_card && (
              <span className="acct-expense__card"> *{expense.credit_card.last_four_digits}</span>
            )}
          </div>
        </div>
        <div className="acct-expense__right">
          <div className="acct-expense__badges">
            {getPaymentStatusBadge()}
            {expense.external_accounting_entry ? (
              <Badge variant="success" size="small" icon="fas fa-building-columns">Entered</Badge>
            ) : (
              <Badge variant="default" size="small" icon="fas fa-building-columns">Not Entered</Badge>
            )}
          </div>
          <div className="acct-expense__actions" onClick={(e) => e.stopPropagation()}>
            {/* Payment actions */}
            {expense.payment_method !== 'credit' && (
              <>
                {expense.payment_status === 'pending_attention' && (
                  <>
                    <Button size="small" variant="secondary" icon="fas fa-hourglass-start"
                      onClick={() => onMarkPending(expense.id)} disabled={isLoading}>
                      Pending
                    </Button>
                    <Button size="small" variant="primary" icon="fas fa-check"
                      onClick={() => onMarkPaid(expense.id)} disabled={isLoading}>
                      Paid
                    </Button>
                  </>
                )}
                {expense.payment_status === 'pending_payment' && (
                  <>
                    <Button size="small" variant="primary" icon="fas fa-check"
                      onClick={() => onMarkPaid(expense.id)} disabled={isLoading}>
                      Paid
                    </Button>
                    <Button size="small" variant="ghost" icon="fas fa-undo"
                      onClick={() => onMarkUnpaid(expense.id)} disabled={isLoading}>
                      Unpaid
                    </Button>
                  </>
                )}
                {expense.payment_status === 'paid' && (
                  <Button size="small" variant="ghost" icon="fas fa-undo"
                    onClick={() => onMarkUnpaid(expense.id)} disabled={isLoading}>
                    Unpaid
                  </Button>
                )}
              </>
            )}
            {/* External accounting */}
            {expense.external_accounting_entry ? (
              <Button size="small" variant="ghost" icon="fas fa-times"
                onClick={() => onUnmarkExternal(expense.id)} disabled={isLoading}
                title="Remove external entry">
                Unmark
              </Button>
            ) : (
              <Button size="small" variant="secondary" icon="fas fa-building-columns"
                onClick={() => onMarkExternal(expense.id)} disabled={isLoading}>
                Mark Ext.
              </Button>
            )}
          </div>
        </div>
        <div className="acct-expense__chevron">
          <i className={`fas fa-chevron-${expanded ? 'up' : 'down'}`} />
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="acct-expense__details">
          <div className="acct-expense__detail-grid">
            {/* Payment Info */}
            <div className="acct-detail-section">
              <h4><i className="fas fa-money-bill-wave" /> Payment</h4>
              <div className="acct-detail-row">
                <span>Due Date</span>
                <span>{formatPaymentDueDate(expense.payment_due_date)}</span>
              </div>
              <div className="acct-detail-row">
                <span>Invoice Date</span>
                <span>{formatDate(expense.invoice_date)}</span>
              </div>
              {expense.is_paid && (
                <>
                  <div className="acct-detail-row">
                    <span>Paid By</span>
                    <span>{expense.paid_by || '-'}</span>
                  </div>
                  <div className="acct-detail-row">
                    <span>Paid At</span>
                    <span>{formatDate(expense.paid_at)}</span>
                  </div>
                </>
              )}
              {expense.external_accounting_entry && (
                <>
                  <div className="acct-detail-row">
                    <span>Ext. Entry By</span>
                    <span>{expense.external_accounting_entry_by || '-'}</span>
                  </div>
                  <div className="acct-detail-row">
                    <span>Ext. Entry At</span>
                    <span>{formatDateTime(expense.external_accounting_entry_at)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Supplier Info */}
            {expense.supplier && (
              <div className="acct-detail-section">
                <h4><i className="fas fa-building" /> Supplier</h4>
                <div className="acct-detail-row">
                  <span>Tax ID</span>
                  <span>{expense.supplier.tax_id || '-'}</span>
                </div>
                <div className="acct-detail-row">
                  <span>Bank</span>
                  <span>{expense.supplier.bank_name || '-'}</span>
                </div>
                <div className="acct-detail-row">
                  <span>Account</span>
                  <span>{expense.supplier.bank_account_number || '-'}</span>
                </div>
                <div className="acct-detail-row">
                  <span>Branch</span>
                  <span>{expense.supplier.bank_branch || '-'}</span>
                </div>
                {expense.supplier.bank_swift && (
                  <div className="acct-detail-row">
                    <span>SWIFT</span>
                    <span>{expense.supplier.bank_swift}</span>
                  </div>
                )}
                <div className="acct-detail-row">
                  <span>Email</span>
                  <span>{expense.supplier.email || '-'}</span>
                </div>
                <div className="acct-detail-row">
                  <span>Phone</span>
                  <span>{expense.supplier.phone || '-'}</span>
                </div>
              </div>
            )}

            {/* Expense Info */}
            <div className="acct-detail-section">
              <h4><i className="fas fa-info-circle" /> Details</h4>
              <div className="acct-detail-row">
                <span>Employee</span>
                <span>{expense.submitter?.username || '-'}</span>
              </div>
              <div className="acct-detail-row">
                <span>Department</span>
                <span>{expense.submitter?.department || '-'}</span>
              </div>
              {expense.reason && (
                <div className="acct-detail-row">
                  <span>Reason</span>
                  <span>{expense.reason}</span>
                </div>
              )}
              <div className="acct-detail-row">
                <span>Type</span>
                <span>{expense.type}</span>
              </div>
              {expense.handler && (
                <div className="acct-detail-row">
                  <span>Handled By</span>
                  <span>{expense.handler.username}</span>
                </div>
              )}
              {expense.handled_at && (
                <div className="acct-detail-row">
                  <span>Handled At</span>
                  <span>{formatDate(expense.handled_at)}</span>
                </div>
              )}
            </div>

            {/* Attachments */}
            <div className="acct-detail-section">
              <h4><i className="fas fa-paperclip" /> Attachments</h4>
              <div className="acct-attachments">
                {expense.quote_filename && (
                  <FilePreviewButton
                    fileUrl={`/download/${expense.quote_filename}`}
                    fileName={expense.quote_filename}
                    icon="fas fa-file-alt"
                    title="Quote"
                  />
                )}
                {expense.invoice_filename && (
                  <FilePreviewButton
                    fileUrl={`/download/${expense.invoice_filename}`}
                    fileName={expense.invoice_filename}
                    icon="fas fa-file-invoice-dollar"
                    title="Invoice"
                  />
                )}
                {expense.receipt_filename && (
                  <FilePreviewButton
                    fileUrl={`/download/${expense.receipt_filename}`}
                    fileName={expense.receipt_filename}
                    icon="fas fa-receipt"
                    title="Receipt"
                  />
                )}
                {!expense.quote_filename && !expense.invoice_filename && !expense.receipt_filename && (
                  <span className="acct-no-files">No attachments</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Pagination
// ============================================================================
function Pagination({ page, pages, onPageChange }) {
  if (pages <= 1) return null
  return (
    <div className="acct-pagination">
      <Button variant="secondary" size="small" icon="fas fa-chevron-left"
        onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}>
        Previous
      </Button>
      <span className="acct-pagination__info">
        Page <strong>{page}</strong> of <strong>{pages}</strong>
      </span>
      <Button variant="secondary" size="small" icon="fas fa-chevron-right" iconPosition="right"
        onClick={() => onPageChange(Math.min(pages, page + 1))} disabled={page === pages}>
        Next
      </Button>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================
function AccountingDashboard({ user }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { success, error: showError } = useToast()

  const [loading, setLoading] = useState(true)
  const [expenses, setExpenses] = useState([])
  const [summary, setSummary] = useState({
    total_count: 0, total_amount: 0,
    paid_count: 0, paid_amount: 0,
    pending_count: 0, pending_amount: 0,
    external_entered_count: 0, external_not_entered_count: 0
  })
  const [monthOptions, setMonthOptions] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [actionLoading, setActionLoading] = useState(null)

  const [filters, setFilters] = useState({
    month: searchParams.get('month') || 'all',
    payment_method: searchParams.get('payment_method') || 'all',
    payment_status: searchParams.get('payment_status') || 'all',
    payment_due_date: searchParams.get('payment_due_date') || 'all',
    invoice_date: searchParams.get('invoice_date') || 'all',
    external_accounting: searchParams.get('external_accounting') || 'all',
    supplier_search: searchParams.get('supplier_search') || '',
    search_text: searchParams.get('search_text') || '',
    amount_min: searchParams.get('amount_min') || '',
    amount_max: searchParams.get('amount_max') || ''
  })

  const currentPage = parseInt(searchParams.get('page') || '1')

  const fetchExpenses = useCallback(async (filtersToUse, page) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ page, per_page: 25 })
      Object.entries(filtersToUse).forEach(([k, v]) => {
        if (v && v !== 'all' && v !== '') params.set(k, v)
      })

      const res = await fetch(`/api/v1/accounting/expenses?${params}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setExpenses(data.expenses)
        setSummary(data.summary)
        setMonthOptions(data.month_options)
        setPagination(data.pagination)
      } else {
        showError('Failed to load expenses')
      }
    } catch (err) {
      logger.error('Fetch accounting expenses error', { error: err.message })
      showError('Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user?.is_admin && !user?.is_accounting) {
      navigate('/dashboard')
      return
    }
    fetchExpenses(filters, currentPage)
  }, [])

  // Debounce filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      // Sync URL
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => {
        if (v && v !== 'all' && v !== '') params.set(k, v)
      })
      setSearchParams(params, { replace: true })
      fetchExpenses(filters, 1)
    }, 400)
    return () => clearTimeout(timer)
  }, [filters])

  const handleFilterChange = useCallback((name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }))
  }, [])

  const handleClearFilters = useCallback(() => {
    setFilters({
      month: 'all', payment_method: 'all', payment_status: 'all',
      payment_due_date: 'all', invoice_date: 'all', external_accounting: 'all',
      supplier_search: '', search_text: '', amount_min: '', amount_max: ''
    })
    setSearchParams({}, { replace: true })
  }, [setSearchParams])

  const handlePageChange = (page) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', page)
    setSearchParams(params, { replace: true })
    fetchExpenses(filters, page)
  }

  // Action handlers
  const doAction = async (url, expenseId) => {
    setActionLoading(expenseId)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Action failed')
      }
      success('Updated successfully')
      fetchExpenses(filters, pagination.page)
    } catch (err) {
      showError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleExport = () => {
    const params = new URLSearchParams()
    if (filters.month !== 'all') params.set('month', filters.month)
    window.open(`/export_accounting_excel?${params}`, '_blank')
  }

  if (!user?.is_admin && !user?.is_accounting) return null

  return (
    <div className="acct-container">
      <main className="acct-main">
        <PageHeader
          title="Accounting Dashboard"
          subtitle={`${pagination.total} approved expenses`}
          icon="fas fa-calculator"
          variant="green"
          actions={
            <div className="acct-header-actions">
              <Button variant="secondary" icon="fas fa-building" onClick={() => navigate('/admin/suppliers')}>
                Suppliers
              </Button>
              <Button variant="primary" icon="fas fa-file-excel" onClick={handleExport}>
                Export Excel
              </Button>
            </div>
          }
        />

        <SummaryCards summary={summary} />

        <AccountingFilters
          filters={filters}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
          monthOptions={monthOptions}
        />

        <div className="acct-expenses-list">
          {loading ? (
            <Card>
              <Card.Body>
                <Skeleton variant="text" count={8} />
              </Card.Body>
            </Card>
          ) : expenses.length === 0 ? (
            <EmptyState
              icon="fas fa-receipt"
              title="No expenses found"
              description="Try adjusting your filters"
            />
          ) : (
            <>
              {expenses.map(expense => (
                <ExpenseCard
                  key={expense.id}
                  expense={expense}
                  actionLoading={actionLoading}
                  onMarkPaid={(id) => doAction(`/mark_expense_paid/${id}`, id)}
                  onMarkUnpaid={(id) => doAction(`/mark_expense_unpaid/${id}`, id)}
                  onMarkPending={(id) => doAction(`/mark_expense_pending_payment/${id}`, id)}
                  onMarkExternal={(id) => doAction(`/mark_expense_external_accounting/${id}`, id)}
                  onUnmarkExternal={(id) => doAction(`/unmark_expense_external_accounting/${id}`, id)}
                />
              ))}
              <Pagination
                page={pagination.page}
                pages={pagination.pages}
                onPageChange={handlePageChange}
              />
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default AccountingDashboard
