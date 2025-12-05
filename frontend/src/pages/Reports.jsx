import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
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

  const getStatusBadge = (status) => {
    const classes = {
      pending: 'status-pending',
      approved: 'status-approved',
      rejected: 'status-rejected',
      paid: 'status-paid'
    }
    return <span className={`status-badge ${classes[status] || ''}`}>{status}</span>
  }

  return (
    <div className="reports-container">
      <Header user={user} setUser={setUser} currentPage="reports" />

      <main className="reports-main">
        <div className="page-header-section">
          <div>
            <h1>Expense Reports</h1>
            <p className="subtitle">Generate and export expense reports</p>
          </div>
        </div>

        {/* Filters Section */}
        <div className="filters-card card">
          <h3><i className="fas fa-filter"></i> Filters</h3>
          
          {/* Quick Date Presets */}
          <div className="date-presets">
            <span className="preset-label">Quick select:</span>
            <button className="preset-btn" onClick={() => setDatePreset('this_month')}>This Month</button>
            <button className="preset-btn" onClick={() => setDatePreset('last_month')}>Last Month</button>
            <button className="preset-btn" onClick={() => setDatePreset('this_quarter')}>This Quarter</button>
            <button className="preset-btn" onClick={() => setDatePreset('this_year')}>This Year</button>
            <button className="preset-btn" onClick={() => setDatePreset('last_year')}>Last Year</button>
          </div>

          <div className="filters-grid">
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
              <label>Status</label>
              <select name="status" value={filters.status} onChange={handleFilterChange}>
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            {user?.is_admin && (
              <div className="filter-group">
                <label>Department</label>
                <select name="department_id" value={filters.department_id} onChange={handleFilterChange}>
                  <option value="">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
            )}
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

          <div className="filter-actions">
            <button className="btn-primary" onClick={fetchReport} disabled={loading}>
              <i className="fas fa-search"></i> {loading ? 'Loading...' : 'Generate Report'}
            </button>
            <button className="btn-secondary" onClick={() => setFilters({
              start_date: '', end_date: '', status: 'all', department_id: '', category_id: ''
            })}>
              <i className="fas fa-times"></i> Clear Filters
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {expenses.length > 0 && (
          <div className="summary-cards">
            <div className="summary-card card">
              <div className="summary-icon"><i className="fas fa-receipt"></i></div>
              <div className="summary-content">
                <span className="summary-value">{summary.total_count}</span>
                <span className="summary-label">Total Expenses</span>
              </div>
            </div>
            <div className="summary-card card">
              <div className="summary-icon approved"><i className="fas fa-check-circle"></i></div>
              <div className="summary-content">
                <span className="summary-value">₪{summary.total_approved_amount.toLocaleString()}</span>
                <span className="summary-label">Approved Amount</span>
              </div>
            </div>
            <div className="summary-card card">
              <div className="summary-icon export"><i className="fas fa-download"></i></div>
              <div className="summary-content">
                <button className="btn-export" onClick={handleExport}>
                  Export to CSV
                </button>
                <span className="summary-label">Download Report</span>
              </div>
            </div>
          </div>
        )}

        {/* Results Table */}
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Generating report...</p>
          </div>
        ) : expenses.length > 0 ? (
          <div className="results-card card">
            <div className="results-header">
              <h3>Results ({expenses.length} expenses)</h3>
            </div>
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
                      <td>{getStatusBadge(expense.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="empty-state card">
            <i className="fas fa-chart-bar"></i>
            <h3>No data to display</h3>
            <p>Select filters and click "Generate Report" to view expenses</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default Reports
