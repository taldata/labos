import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Input, Select, TomSelectInput, Badge, Skeleton } from '../components/ui'
import './Reports.css'

function Reports({ user, setUser }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [expenses, setExpenses] = useState([])
  const [departments, setDepartments] = useState([])
  const [categories, setCategories] = useState([])
  const [summary, setSummary] = useState({ total_count: 0, total_approved_amount: 0 })

  // Filters
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    status: 'all',
    department_id: '',
    category_id: ''
  })

  // Quick date presets
  const setDatePreset = (preset) => {
    const today = new Date()
    let start, end

    switch (preset) {
      case 'this_month':
        start = new Date(today.getFullYear(), today.getMonth(), 1)
        end = today
        break
      case 'last_month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        end = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      case 'this_quarter':
        const quarter = Math.floor(today.getMonth() / 3)
        start = new Date(today.getFullYear(), quarter * 3, 1)
        end = today
        break
      case 'this_year':
        start = new Date(today.getFullYear(), 0, 1)
        end = today
        break
      case 'last_year':
        start = new Date(today.getFullYear() - 1, 0, 1)
        end = new Date(today.getFullYear() - 1, 11, 31)
        break
      default:
        return
    }

    setFilters(prev => ({
      ...prev,
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0]
    }))
  }

  useEffect(() => {
    fetchFilterOptions()
  }, [])

  const fetchFilterOptions = async () => {
    try {
      // Fetch departments
      const deptRes = await fetch('/api/v1/organization/structure', { credentials: 'include' })
      if (deptRes.ok) {
        const data = await deptRes.json()
        setDepartments(data.structure || [])
        // Extract all categories
        const allCats = []
        data.structure?.forEach(dept => {
          dept.categories?.forEach(cat => {
            if (!allCats.find(c => c.id === cat.id)) {
              allCats.push(cat)
            }
          })
        })
        setCategories(allCats)
      }
    } catch (err) {
      console.error('Failed to fetch filter options')
    }
  }

  const fetchReport = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      
      if (filters.start_date) params.append('start_date', filters.start_date)
      if (filters.end_date) params.append('end_date', filters.end_date)
      if (filters.status && filters.status !== 'all') params.append('status', filters.status)
      if (filters.department_id) params.append('department_id', filters.department_id)
      if (filters.category_id) params.append('category_id', filters.category_id)

      const res = await fetch(`/api/v1/expenses/report?${params.toString()}`, {
        credentials: 'include'
      })

      if (res.ok) {
        const data = await res.json()
        setExpenses(data.expenses)
        setSummary({
          total_count: data.total_count,
          total_approved_amount: data.total_approved_amount
        })
      }
    } catch (err) {
      console.error('Failed to fetch report')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    const params = new URLSearchParams()
    if (filters.start_date) params.append('start_date', filters.start_date)
    if (filters.end_date) params.append('end_date', filters.end_date)
    if (filters.status && filters.status !== 'all') params.append('status', filters.status)
    if (filters.department_id) params.append('department_id', filters.department_id)

    window.location.href = `/api/v1/expenses/export?${params.toString()}`
  }

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({ ...prev, [name]: value }))
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

  return (
    <div className="reports-container">

      <main className="reports-main">
        <div className="page-header-section">
          <div>
            <h1>Expense Reports</h1>
            <p className="subtitle">Generate and export expense reports</p>
          </div>
        </div>

        {/* Filters Section */}
        <Card className="filters-card">
          <Card.Header>
            <i className="fas fa-filter"></i> Filters
          </Card.Header>
          <Card.Body>
            {/* Quick Date Presets */}
            <div className="date-presets">
              <span className="preset-label">Quick select:</span>
              <Button variant="ghost" size="small" onClick={() => setDatePreset('this_month')}>
                This Month
              </Button>
              <Button variant="ghost" size="small" onClick={() => setDatePreset('last_month')}>
                Last Month
              </Button>
              <Button variant="ghost" size="small" onClick={() => setDatePreset('this_quarter')}>
                This Quarter
              </Button>
              <Button variant="ghost" size="small" onClick={() => setDatePreset('this_year')}>
                This Year
              </Button>
              <Button variant="ghost" size="small" onClick={() => setDatePreset('last_year')}>
                Last Year
              </Button>
            </div>

            <div className="filters-grid">
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
                label="Status"
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="paid">Paid</option>
              </Select>
              {user?.is_admin && (
                <TomSelectInput
                  label="Department"
                  name="department_id"
                  value={filters.department_id}
                  onChange={handleFilterChange}
                  options={departments}
                  displayKey="name"
                  valueKey="id"
                  placeholder="All Departments"
                />
              )}
              <TomSelectInput
                label="Category"
                name="category_id"
                value={filters.category_id}
                onChange={handleFilterChange}
                options={categories}
                displayKey="name"
                valueKey="id"
                placeholder="All Categories"
              />
            </div>

            <div className="filter-actions">
              <Button
                variant="primary"
                icon="fas fa-search"
                onClick={fetchReport}
                disabled={loading}
                loading={loading}
              >
                Generate Report
              </Button>
              <Button
                variant="secondary"
                icon="fas fa-times"
                onClick={() => setFilters({
                  start_date: '', end_date: '', status: 'all', department_id: '', category_id: ''
                })}
              >
                Clear Filters
              </Button>
            </div>
          </Card.Body>
        </Card>

        {/* Summary Cards */}
        {expenses.length > 0 && (
          <div className="summary-cards">
            <Card className="summary-card">
              <Card.Body>
                <div className="summary-icon"><i className="fas fa-receipt"></i></div>
                <div className="summary-content">
                  <span className="summary-value">{summary.total_count}</span>
                  <span className="summary-label">Total Expenses</span>
                </div>
              </Card.Body>
            </Card>
            <Card className="summary-card">
              <Card.Body>
                <div className="summary-icon approved"><i className="fas fa-check-circle"></i></div>
                <div className="summary-content">
                  <span className="summary-value">₪{summary.total_approved_amount.toLocaleString()}</span>
                  <span className="summary-label">Approved Amount</span>
                </div>
              </Card.Body>
            </Card>
            <Card className="summary-card">
              <Card.Body>
                <div className="summary-icon export"><i className="fas fa-download"></i></div>
                <div className="summary-content">
                  <Button variant="primary" size="small" icon="fas fa-download" onClick={handleExport}>
                    Export to CSV
                  </Button>
                  <span className="summary-label">Download Report</span>
                </div>
              </Card.Body>
            </Card>
          </div>
        )}

        {/* Results Table */}
        {loading ? (
          <Card>
            <Card.Body>
              <div className="loading-container">
                <Skeleton variant="title" width="40%" />
                <Skeleton variant="text" count={8} />
              </div>
            </Card.Body>
          </Card>
        ) : expenses.length > 0 ? (
          <Card className="results-card">
            <Card.Header>
              Results ({expenses.length} expenses)
            </Card.Header>
            <Card.Body>
              <div className="table-wrapper">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>User</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map(expense => (
                      <tr key={expense.id} onClick={() => navigate(`/expenses/${expense.id}`)}>
                        <td>{expense.date}</td>
                        <td className="desc-cell">
                          <span className="desc-text">{expense.description || '-'}</span>
                          {expense.supplier && <span className="supplier-text">{expense.supplier}</span>}
                        </td>
                        <td>
                          <span className="category-text">{expense.category}</span>
                          {expense.subcategory && <span className="subcategory-text">{expense.subcategory}</span>}
                        </td>
                        <td>
                          <span className="user-text">{expense.user}</span>
                          {expense.department && <span className="dept-text">{expense.department}</span>}
                        </td>
                        <td className="amount-cell">
                          <span className={expense.status === 'approved' ? 'amount-approved' : ''}>
                            {expense.currency === 'USD' ? '$' : '₪'}{expense.amount.toLocaleString()}
                          </span>
                        </td>
                        <td>
                          <Badge variant={getStatusVariant(expense.status)}>{expense.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card.Body>
          </Card>
        ) : (
          <Card className="empty-state">
            <Card.Body>
              <i className="fas fa-chart-bar"></i>
              <h3>No data to display</h3>
              <p>Select filters and click "Generate Report" to view expenses</p>
            </Card.Body>
          </Card>
        )}
      </main>
    </div>
  )
}

export default Reports
