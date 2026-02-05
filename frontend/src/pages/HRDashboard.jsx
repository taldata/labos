import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { Card, Select, Skeleton, Button, Badge, Input, PageHeader, useToast } from '../components/ui'
import logger from '../utils/logger'
import './HRDashboard.css'

function UtilizationBadge({ percent }) {
  const variant = percent > 90 ? 'danger' : percent > 70 ? 'warning' : 'success'
  return <Badge variant={variant}>{percent.toFixed(1)}%</Badge>
}

function HRDashboard({ user }) {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const mountedRef = useRef(true)

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [years, setYears] = useState([])
  const [selectedYear, setSelectedYear] = useState('')
  const [expandedDepts, setExpandedDepts] = useState({})
  const [editingBudget, setEditingBudget] = useState(null) // { type: 'category'|'subcategory', id, value }

  // Access check
  useEffect(() => {
    if (!user?.is_hr && !user?.is_admin) {
      navigate('/dashboard')
    }
  }, [user, navigate])

  useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  // Fetch budget years on mount
  useEffect(() => {
    const fetchYears = async () => {
      try {
        const response = await fetch('/api/v1/organization/years', {
          credentials: 'include'
        })
        if (response.ok) {
          const result = await response.json()
          const yearsData = result.years || []
          if (mountedRef.current) {
            setYears(yearsData)
            // Auto-select current year
            const currentYear = yearsData.find(y => y.is_current)
            if (currentYear) {
              setSelectedYear(String(currentYear.id))
            } else if (yearsData.length > 0) {
              setSelectedYear(String(yearsData[0].id))
            }
          }
        }
      } catch (error) {
        logger.error('Failed to fetch budget years', { error: error.message })
      }
    }
    fetchYears()
  }, [])

  // Fetch welfare data when year changes
  const fetchWelfareOverview = useCallback(async () => {
    if (!selectedYear) return
    setLoading(true)
    try {
      const response = await fetch(`/api/v1/hr/welfare-overview?year_id=${selectedYear}`, {
        credentials: 'include'
      })
      if (response.ok) {
        const result = await response.json()
        if (mountedRef.current) {
          setData(result)
        }
      } else {
        if (mountedRef.current) showError('Failed to load welfare data')
      }
    } catch (error) {
      logger.error('Failed to fetch welfare overview', { error: error.message })
      if (mountedRef.current) showError('Failed to load welfare data')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [selectedYear, showError])

  useEffect(() => {
    fetchWelfareOverview()
  }, [fetchWelfareOverview])

  const toggleExpand = (deptId) => {
    setExpandedDepts(prev => ({ ...prev, [deptId]: !prev[deptId] }))
  }

  const startEdit = (type, id, currentBudget) => {
    setEditingBudget({ type, id, value: String(currentBudget) })
  }

  const cancelEdit = () => {
    setEditingBudget(null)
  }

  const saveEdit = async () => {
    if (!editingBudget) return

    const url = editingBudget.type === 'category'
      ? `/api/v1/hr/welfare-budget/${editingBudget.id}`
      : `/api/v1/hr/welfare-subcategory-budget/${editingBudget.id}`

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ budget: parseFloat(editingBudget.value) || 0 })
      })

      if (response.ok) {
        success('Budget updated successfully')
        setEditingBudget(null)
        fetchWelfareOverview()
      } else {
        const err = await response.json()
        showError(err.error || 'Failed to update budget')
      }
    } catch (error) {
      logger.error('Failed to save budget', { error: error.message })
      showError('Failed to update budget')
    }
  }

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') saveEdit()
    if (e.key === 'Escape') cancelEdit()
  }

  const formatCurrency = (amount) => {
    return `₪${Number(amount).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  if (!user?.is_hr && !user?.is_admin) return null

  const summary = data?.summary
  const departments = data?.departments || []
  const chartData = data?.chart_data || []

  return (
    <div className="hr-dashboard-container">
      <PageHeader
        title="HR Welfare Dashboard"
        subtitle="Welfare budget management across departments"
        icon="fas fa-heart"
      />

      {/* Year Selector */}
      <Card className="hr-filters-card">
        <Card.Body>
          <div className="hr-filters-row">
            <Select
              label="Budget Year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              {years.map(y => (
                <option key={y.id} value={y.id}>
                  {y.name}{y.is_current ? ' (Current)' : ''}
                </option>
              ))}
            </Select>
          </div>
        </Card.Body>
      </Card>

      {loading ? (
        <div className="hr-loading">
          <div className="hr-stats-grid">
            {[1,2,3,4].map(i => (
              <Card key={i}><Card.Body><Skeleton height="80px" /></Card.Body></Card>
            ))}
          </div>
          <Card><Card.Body><Skeleton height="350px" /></Card.Body></Card>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          {summary && (
            <div className="hr-stats-grid">
              <Card className="hr-stat-card">
                <Card.Body>
                  <div className="hr-stat-icon green">
                    <i className="fas fa-wallet"></i>
                  </div>
                  <div className="hr-stat-info">
                    <div className="hr-stat-value">{formatCurrency(summary.total_welfare_budget)}</div>
                    <div className="hr-stat-label">Total Welfare Budget</div>
                  </div>
                </Card.Body>
              </Card>
              <Card className="hr-stat-card">
                <Card.Body>
                  <div className="hr-stat-icon blue">
                    <i className="fas fa-shopping-cart"></i>
                  </div>
                  <div className="hr-stat-info">
                    <div className="hr-stat-value">{formatCurrency(summary.total_welfare_spent)}</div>
                    <div className="hr-stat-label">Total Spent</div>
                  </div>
                </Card.Body>
              </Card>
              <Card className="hr-stat-card">
                <Card.Body>
                  <div className="hr-stat-icon yellow">
                    <i className="fas fa-piggy-bank"></i>
                  </div>
                  <div className="hr-stat-info">
                    <div className="hr-stat-value">{formatCurrency(summary.total_welfare_remaining)}</div>
                    <div className="hr-stat-label">Remaining</div>
                  </div>
                </Card.Body>
              </Card>
              <Card className="hr-stat-card">
                <Card.Body>
                  <div className="hr-stat-icon" style={{ backgroundColor: summary.utilization_percent > 90 ? '#fee2e2' : summary.utilization_percent > 70 ? '#fef3c7' : '#d1fae5', color: summary.utilization_percent > 90 ? '#ef4444' : summary.utilization_percent > 70 ? '#f59e0b' : '#10b981' }}>
                    <i className="fas fa-chart-pie"></i>
                  </div>
                  <div className="hr-stat-info">
                    <div className="hr-stat-value">{summary.utilization_percent.toFixed(1)}%</div>
                    <div className="hr-stat-label">Utilization Rate</div>
                  </div>
                </Card.Body>
              </Card>
            </div>
          )}

          {/* Chart */}
          {chartData.length > 0 && (
            <Card className="hr-chart-card">
              <Card.Header>
                <h3>Welfare Budget vs Spending by Department</h3>
              </Card.Header>
              <Card.Body>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="budget" fill="#4facfe" name="Budget" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="spent" fill="#fa709a" name="Spent" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card.Body>
            </Card>
          )}

          {/* Department Welfare Table */}
          <Card className="hr-table-card">
            <Card.Header>
              <h3>Department Welfare Details</h3>
              <span className="hr-dept-count">{summary?.department_count || 0} departments</span>
            </Card.Header>
            <Card.Body>
              {departments.length === 0 ? (
                <div className="hr-empty-state">
                  <i className="fas fa-info-circle"></i>
                  <p>No welfare categories found. Mark categories as &quot;Welfare&quot; in the Organization page to see them here.</p>
                </div>
              ) : (
                <div className="hr-table-wrapper">
                  <table className="hr-welfare-table">
                    <thead>
                      <tr>
                        <th className="col-dept">Department</th>
                        <th className="col-cat">Category</th>
                        <th className="col-budget">Budget</th>
                        <th className="col-spent">Spent</th>
                        <th className="col-remaining">Remaining</th>
                        <th className="col-util">Utilization</th>
                        <th className="col-actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departments.map(dept => {
                        const wc = dept.welfare_category
                        const isExpanded = expandedDepts[dept.department_id]
                        const key = `dept-${dept.department_id}-cat-${wc.id}`

                        return (
                          <tbody key={key} className="hr-dept-group">
                            <tr
                              className={`hr-dept-row ${isExpanded ? 'expanded' : ''}`}
                              onClick={() => toggleExpand(dept.department_id)}
                            >
                              <td className="col-dept">
                                <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'} expand-icon`}></i>
                                {dept.department_name}
                              </td>
                              <td className="col-cat">{wc.name}</td>
                              <td className="col-budget">
                                {editingBudget?.type === 'category' && editingBudget?.id === wc.id ? (
                                  <div className="hr-edit-inline" onClick={e => e.stopPropagation()}>
                                    <Input
                                      type="number"
                                      value={editingBudget.value}
                                      onChange={(e) => setEditingBudget(prev => ({ ...prev, value: e.target.value }))}
                                      onKeyDown={handleEditKeyDown}
                                      autoFocus
                                      className="hr-budget-input"
                                    />
                                    <Button variant="ghost" size="small" onClick={saveEdit}><i className="fas fa-check"></i></Button>
                                    <Button variant="ghost" size="small" onClick={cancelEdit}><i className="fas fa-times"></i></Button>
                                  </div>
                                ) : (
                                  formatCurrency(wc.budget)
                                )}
                              </td>
                              <td className="col-spent">{formatCurrency(wc.spent)}</td>
                              <td className={`col-remaining ${wc.remaining < 0 ? 'negative' : ''}`}>
                                {formatCurrency(wc.remaining)}
                              </td>
                              <td className="col-util">
                                <UtilizationBadge percent={wc.utilization_percent} />
                              </td>
                              <td className="col-actions" onClick={e => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="small"
                                  onClick={() => startEdit('category', wc.id, wc.budget)}
                                  title="Edit budget"
                                >
                                  <i className="fas fa-edit"></i>
                                </Button>
                              </td>
                            </tr>
                            {isExpanded && wc.subcategories.map(sub => (
                              <tr key={`sub-${sub.id}`} className="hr-subcat-row">
                                <td className="col-dept"></td>
                                <td className="col-cat indent">{sub.name}</td>
                                <td className="col-budget">
                                  {editingBudget?.type === 'subcategory' && editingBudget?.id === sub.id ? (
                                    <div className="hr-edit-inline" onClick={e => e.stopPropagation()}>
                                      <Input
                                        type="number"
                                        value={editingBudget.value}
                                        onChange={(e) => setEditingBudget(prev => ({ ...prev, value: e.target.value }))}
                                        onKeyDown={handleEditKeyDown}
                                        autoFocus
                                        className="hr-budget-input"
                                      />
                                      <Button variant="ghost" size="small" onClick={saveEdit}><i className="fas fa-check"></i></Button>
                                      <Button variant="ghost" size="small" onClick={cancelEdit}><i className="fas fa-times"></i></Button>
                                    </div>
                                  ) : (
                                    formatCurrency(sub.budget)
                                  )}
                                </td>
                                <td className="col-spent">{formatCurrency(sub.spent)}</td>
                                <td className={`col-remaining ${sub.remaining < 0 ? 'negative' : ''}`}>
                                  {formatCurrency(sub.remaining)}
                                </td>
                                <td className="col-util">
                                  <UtilizationBadge percent={sub.utilization_percent} />
                                </td>
                                <td className="col-actions">
                                  <Button
                                    variant="ghost"
                                    size="small"
                                    onClick={() => startEdit('subcategory', sub.id, sub.budget)}
                                    title="Edit budget"
                                  >
                                    <i className="fas fa-edit"></i>
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card.Body>
          </Card>
        </>
      )}
    </div>
  )
}

export default HRDashboard
