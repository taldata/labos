import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { Card, Select, Skeleton, Input, Button } from '../components/ui'
import logger from '../utils/logger'
import './AdminDashboard.css'

const COLORS = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe', '#43e97b', '#fa709a']

function AdminDashboard({ user, setUser }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [timePeriod, setTimePeriod] = useState('this_month')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/dashboard')
      return
    }
    // Only fetch if not custom, or if custom and both dates are set
    if (timePeriod !== 'custom' || (startDate && endDate)) {
      fetchAdminStats()
    }
  }, [timePeriod])

  const fetchAdminStats = async () => {
    try {
      setLoading(true)
      let url = `/api/v1/admin/stats?period=${timePeriod}`
      
      // Add custom date range parameters
      if (timePeriod === 'custom' && startDate && endDate) {
        url += `&start_date=${startDate}&end_date=${endDate}`
      }
      
      const response = await fetch(url, {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      } else {
        logger.error('Failed to fetch admin stats', { timePeriod })
      }
    } catch (error) {
      logger.error('Error fetching admin stats', { timePeriod, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleApplyDateRange = () => {
    if (startDate && endDate) {
      fetchAdminStats()
    }
  }

  const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  if (!user?.is_admin) {
    return null
  }

  return (
    <div className="admin-dashboard-container">
      
      <main className="admin-dashboard-main">
        <div className="page-header-section">
          <div>
            <h1>Admin Analytics Dashboard</h1>
            <p className="subtitle">Comprehensive insights into expense management</p>
          </div>
          <div className="filters-section">
            <div className="period-selector">
              <Select
                label="Time Period:"
                value={timePeriod}
                onChange={(e) => setTimePeriod(e.target.value)}
              >
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="this_quarter">This Quarter</option>
                <option value="this_year">This Year</option>
                <option value="last_year">Last Year</option>
                <option value="last_6_months">Last 6 Months</option>
                <option value="custom">Custom Date Range</option>
              </Select>
            </div>
            
            {timePeriod === 'custom' && (
              <div className="date-range-filter">
                <div className="date-inputs">
                  <Input
                    type="date"
                    label="Start Date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <Input
                    type="date"
                    label="End Date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <Button 
                  variant="primary" 
                  onClick={handleApplyDateRange}
                  disabled={!startDate || !endDate}
                >
                  Apply
                </Button>
              </div>
            )}
          </div>
        </div>


        {loading ? (
          <div className="loading-state">
            <Skeleton variant="title" width="50%" />
            <div className="stats-grid">
              <Card><Card.Body><Skeleton variant="text" count={3} /></Card.Body></Card>
              <Card><Card.Body><Skeleton variant="text" count={3} /></Card.Body></Card>
              <Card><Card.Body><Skeleton variant="text" count={3} /></Card.Body></Card>
              <Card><Card.Body><Skeleton variant="text" count={3} /></Card.Body></Card>
            </div>
          </div>
        ) : stats ? (
          <>
            {/* Summary Cards */}
            <div className="stats-grid">
              <Card className="stat-card">
                <Card.Body>
                  <div className="stat-icon" style={{ background: '#dbeafe' }}>
                    💰
                  </div>
                  <div className="stat-content">
                    <h3>Total Expenses</h3>
                    <p className="stat-value">
                      {stats.currency === 'USD' ? '$' : '₪'}
                      {stats.total_expenses?.toLocaleString() || '0'}
                    </p>
                    <p className="stat-label">{stats.total_count || 0} expenses</p>
                  </div>
                </Card.Body>
              </Card>

              <Card className="stat-card">
                <Card.Body>
                  <div className="stat-icon" style={{ background: '#dcfce7' }}>
                    ✅
                  </div>
                  <div className="stat-content">
                    <h3>Approved</h3>
                    <p className="stat-value">
                      {stats.currency === 'USD' ? '$' : '₪'}
                      {stats.approved_amount?.toLocaleString() || '0'}
                    </p>
                    <p className="stat-label">{stats.approved_count || 0} expenses</p>
                  </div>
                </Card.Body>
              </Card>

              <Card className="stat-card">
                <Card.Body>
                  <div className="stat-icon" style={{ background: '#fef3c7' }}>
                    ⏳
                  </div>
                  <div className="stat-content">
                    <h3>Pending</h3>
                    <p className="stat-value">
                      {stats.currency === 'USD' ? '$' : '₪'}
                      {stats.pending_amount?.toLocaleString() || '0'}
                    </p>
                    <p className="stat-label">{stats.pending_count || 0} expenses</p>
                  </div>
                </Card.Body>
              </Card>

              <Card className="stat-card">
                <Card.Body>
                  <div className="stat-icon" style={{ background: '#fee2e2' }}>
                    ❌
                  </div>
                  <div className="stat-content">
                    <h3>Rejected</h3>
                    <p className="stat-value">
                      {stats.currency === 'USD' ? '$' : '₪'}
                      {stats.rejected_amount?.toLocaleString() || '0'}
                    </p>
                    <p className="stat-label">{stats.rejected_count || 0} expenses</p>
                  </div>
                </Card.Body>
              </Card>
            </div>

            {/* Charts Grid */}
            <div className="charts-grid">
              {/* Expense Trend Over Time */}
              {stats.expense_trend && stats.expense_trend.length > 0 && (
                <Card className="chart-card">
                  <Card.Header>Expense Trend Over Time</Card.Header>
                  <Card.Body>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={stats.expense_trend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis />
                        <Tooltip
                          formatter={(value) => `${stats.currency === 'USD' ? '$' : '₪'}${value.toLocaleString()}`}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="amount"
                          stroke="#667eea"
                          strokeWidth={2}
                          name="Expenses"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
              )}

              {/* Department Spending */}
              {stats.department_spending && stats.department_spending.length > 0 && (
                <Card className="chart-card">
                  <Card.Header>Spending by Department</Card.Header>
                  <Card.Body>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={stats.department_spending}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip
                          formatter={(value) => `${stats.currency === 'USD' ? '$' : '₪'}${value.toLocaleString()}`}
                        />
                        <Legend />
                        <Bar dataKey="amount" fill="#764ba2" name="Amount" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
              )}

              {/* Category Distribution */}
              {stats.category_distribution && stats.category_distribution.length > 0 && (
                <Card className="chart-card">
                  <Card.Header>Expenses by Category</Card.Header>
                  <Card.Body>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={stats.category_distribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="amount"
                        >
                          {stats.category_distribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => `${stats.currency === 'USD' ? '$' : '₪'}${value.toLocaleString()}`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
              )}

              {/* Status Distribution */}
              {stats.status_distribution && stats.status_distribution.length > 0 && (
                <Card className="chart-card">
                  <Card.Header>Expense Status Distribution</Card.Header>
                  <Card.Body>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={stats.status_distribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {stats.status_distribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
              )}

              {/* Top Users */}
              {stats.top_users && stats.top_users.length > 0 && (
                <Card className="chart-card">
                  <Card.Header>Top Spenders</Card.Header>
                  <Card.Body>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={stats.top_users} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={100} />
                        <Tooltip
                          formatter={(value) => `${stats.currency === 'USD' ? '$' : '₪'}${value.toLocaleString()}`}
                        />
                        <Legend />
                        <Bar dataKey="amount" fill="#43e97b" name="Amount" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
              )}

              {/* Budget Usage */}
              {stats.budget_usage && stats.budget_usage.length > 0 && (
                <Card className="chart-card">
                  <Card.Header>Department Budget Usage</Card.Header>
                  <Card.Body>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={stats.budget_usage}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip
                          formatter={(value, name) => {
                            if (name === 'usage_percent') return `${value.toFixed(1)}%`
                            return `${stats.currency === 'USD' ? '$' : '₪'}${value.toLocaleString()}`
                          }}
                        />
                        <Legend />
                        <Bar dataKey="spent" fill="#fa709a" name="Spent" />
                        <Bar dataKey="budget" fill="#4facfe" name="Budget" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card.Body>
                </Card>
              )}
            </div>
          </>
        ) : (
          <Card className="error-state">
            <Card.Body>
              <i className="fas fa-exclamation-triangle"></i>
              <h3>Failed to load analytics</h3>
              <p>Please try refreshing the page</p>
            </Card.Body>
          </Card>
        )}
      </main>
    </div>
  )
}

export default AdminDashboard

