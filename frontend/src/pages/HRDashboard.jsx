import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { Card, Select, Button, Input, Modal, PageHeader, useToast } from '../components/ui'
import logger from '../utils/logger'
import './HRDashboard.css'

function UtilizationBar({ percent }) {
  const level = percent > 90 ? 'danger' : percent > 70 ? 'warning' : 'success'
  const clampedPercent = Math.min(percent, 100)
  return (
    <div className="hr-util-bar-container">
      <div className="hr-util-bar-track">
        <div
          className={`hr-util-bar-fill hr-util-${level}`}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
      <span className={`hr-util-bar-label hr-util-${level}-text`}>{percent.toFixed(1)}%</span>
    </div>
  )
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

  // Search and sort state
  const [searchQuery, setSearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })

  // Departments list for "add category" modal
  const [departments, setDepartments] = useState([])

  // Modal states
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [showAddSubcategory, setShowAddSubcategory] = useState(false)
  const [showEditItem, setShowEditItem] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Form state for add/edit modals
  const [formData, setFormData] = useState({ name: '', budget: '', department_id: '', category_id: '' })
  const [editTarget, setEditTarget] = useState(null) // { type: 'category'|'subcategory', id, name, budget }
  const [deleteTarget, setDeleteTarget] = useState(null) // { type: 'category'|'subcategory', id, name }
  const [modalLoading, setModalLoading] = useState(false)


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

  // Fetch departments for the selected year (for add category modal)
  const fetchDepartments = useCallback(async () => {
    if (!selectedYear) return
    try {
      const response = await fetch(`/api/v1/hr/departments?year_id=${selectedYear}`, {
        credentials: 'include'
      })
      if (response.ok) {
        const result = await response.json()
        if (mountedRef.current) {
          setDepartments(result.departments || [])
        }
      }
    } catch (error) {
      logger.error('Failed to fetch departments', { error: error.message })
    }
  }, [selectedYear])

  useEffect(() => {
    fetchDepartments()
  }, [fetchDepartments])

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

  // --- CRUD Operations ---

  const openAddCategory = () => {
    setFormData({ name: '', budget: '', department_id: '', category_id: '' })
    setShowAddCategory(true)
  }

  const openAddSubcategory = (categoryId) => {
    setFormData({ name: '', budget: '', department_id: '', category_id: String(categoryId) })
    setShowAddSubcategory(true)
  }

  const openEditItem = (type, item) => {
    setEditTarget({ type, id: item.id, name: item.name, budget: item.budget })
    setFormData({ name: item.name, budget: String(item.budget), department_id: '', category_id: '' })
    setShowEditItem(true)
  }

  const openDeleteConfirm = (type, item) => {
    setDeleteTarget({ type, id: item.id, name: item.name })
    setShowDeleteConfirm(true)
  }

  const handleAddCategory = async () => {
    if (!formData.name.trim() || !formData.department_id) {
      showError('Please fill in all required fields')
      return
    }

    setModalLoading(true)
    try {
      const response = await fetch('/api/v1/hr/welfare-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name.trim(),
          budget: parseFloat(formData.budget) || 0,
          department_id: parseInt(formData.department_id)
        })
      })

      if (response.ok) {
        success('Welfare category created')
        setShowAddCategory(false)
        fetchWelfareOverview()
      } else {
        const err = await response.json()
        showError(err.error || 'Failed to create category')
      }
    } catch (error) {
      logger.error('Failed to create welfare category', { error: error.message })
      showError('Failed to create category')
    } finally {
      setModalLoading(false)
    }
  }

  const handleAddSubcategory = async () => {
    if (!formData.name.trim() || !formData.category_id) {
      showError('Please fill in all required fields')
      return
    }

    setModalLoading(true)
    try {
      const response = await fetch('/api/v1/hr/welfare-subcategories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name.trim(),
          budget: parseFloat(formData.budget) || 0,
          category_id: parseInt(formData.category_id)
        })
      })

      if (response.ok) {
        success('Subcategory created')
        setShowAddSubcategory(false)
        fetchWelfareOverview()
      } else {
        const err = await response.json()
        showError(err.error || 'Failed to create subcategory')
      }
    } catch (error) {
      logger.error('Failed to create welfare subcategory', { error: error.message })
      showError('Failed to create subcategory')
    } finally {
      setModalLoading(false)
    }
  }

  const handleEditItem = async () => {
    if (!editTarget || !formData.name.trim()) {
      showError('Name cannot be empty')
      return
    }

    setModalLoading(true)
    const url = editTarget.type === 'category'
      ? `/api/v1/hr/welfare-categories/${editTarget.id}`
      : `/api/v1/hr/welfare-subcategories/${editTarget.id}`

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name.trim(),
          budget: parseFloat(formData.budget) || 0
        })
      })

      if (response.ok) {
        success(`${editTarget.type === 'category' ? 'Category' : 'Subcategory'} updated`)
        setShowEditItem(false)
        setEditTarget(null)
        fetchWelfareOverview()
      } else {
        const err = await response.json()
        showError(err.error || 'Failed to update')
      }
    } catch (error) {
      logger.error('Failed to update welfare item', { error: error.message })
      showError('Failed to update')
    } finally {
      setModalLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    setModalLoading(true)
    const url = deleteTarget.type === 'category'
      ? `/api/v1/hr/welfare-categories/${deleteTarget.id}`
      : `/api/v1/hr/welfare-subcategories/${deleteTarget.id}`

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (response.ok) {
        success(`${deleteTarget.type === 'category' ? 'Category' : 'Subcategory'} deleted`)
        setShowDeleteConfirm(false)
        setDeleteTarget(null)
        fetchWelfareOverview()
      } else {
        const err = await response.json()
        showError(err.error || 'Failed to delete')
      }
    } catch (error) {
      logger.error('Failed to delete welfare item', { error: error.message })
      showError('Failed to delete')
    } finally {
      setModalLoading(false)
    }
  }

  // --- Search, Sort, and Derived Data ---

  const deptResults = useMemo(() => data?.departments || [], [data])

  const filteredDepts = useMemo(() => {
    if (!searchQuery.trim()) return deptResults
    const q = searchQuery.toLowerCase()
    return deptResults.filter(dept =>
      dept.department_name.toLowerCase().includes(q) ||
      dept.welfare_category.name.toLowerCase().includes(q) ||
      dept.welfare_category.subcategories.some(s => s.name.toLowerCase().includes(q))
    )
  }, [deptResults, searchQuery])

  const sortedDepts = useMemo(() => {
    if (!sortConfig.key) return filteredDepts
    const sorted = [...filteredDepts]
    sorted.sort((a, b) => {
      let aVal, bVal
      switch (sortConfig.key) {
        case 'department':
          aVal = a.department_name.toLowerCase()
          bVal = b.department_name.toLowerCase()
          break
        case 'category':
          aVal = a.welfare_category.name.toLowerCase()
          bVal = b.welfare_category.name.toLowerCase()
          break
        case 'budget':
          aVal = a.welfare_category.budget
          bVal = b.welfare_category.budget
          break
        case 'spent':
          aVal = a.welfare_category.spent
          bVal = b.welfare_category.spent
          break
        case 'remaining':
          aVal = a.welfare_category.remaining
          bVal = b.welfare_category.remaining
          break
        case 'utilization':
          aVal = a.welfare_category.utilization_percent
          bVal = b.welfare_category.utilization_percent
          break
        default:
          return 0
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [filteredDepts, sortConfig])

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return 'fas fa-sort'
    return sortConfig.direction === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down'
  }

  const overBudgetCount = useMemo(() => {
    return deptResults.filter(d => d.welfare_category.remaining < 0).length
  }, [deptResults])

  const allExpanded = useMemo(() => {
    return filteredDepts.length > 0 && filteredDepts.every(d => expandedDepts[d.department_id])
  }, [filteredDepts, expandedDepts])

  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedDepts({})
    } else {
      const newExpanded = {}
      filteredDepts.forEach(d => { newExpanded[d.department_id] = true })
      setExpandedDepts(newExpanded)
    }
  }

  const exportCSV = () => {
    if (!deptResults.length) return
    const rows = [['Department', 'Category', 'Subcategory', 'Budget', 'Spent', 'Remaining', 'Utilization %']]

    for (const dept of deptResults) {
      const wc = dept.welfare_category
      rows.push([
        dept.department_name,
        wc.name,
        '',
        wc.budget,
        wc.spent,
        wc.remaining,
        wc.utilization_percent
      ])
      for (const sub of wc.subcategories) {
        rows.push([
          dept.department_name,
          wc.name,
          sub.name,
          sub.budget,
          sub.spent,
          sub.remaining,
          sub.utilization_percent
        ])
      }
    }

    const csvContent = rows.map(row =>
      row.map(val => typeof val === 'string' && val.includes(',') ? `"${val}"` : val).join(',')
    ).join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `welfare_report_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    success('Report exported')
  }

  if (!user?.is_hr && !user?.is_admin) return null

  const summary = data?.summary
  const chartData = data?.chart_data || []

  return (
    <div className="hr-dashboard-container">
      <PageHeader
        title="HR Welfare Dashboard"
        subtitle="Welfare budget management across departments"
        icon="fas fa-heart"
      />

      {/* Year Selector + Actions */}
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
            <div className="hr-filters-actions">
              <Button variant="secondary" onClick={exportCSV} disabled={!deptResults.length} title="Export to CSV">
                <i className="fas fa-download"></i> Export CSV
              </Button>
              <Button variant="primary" onClick={openAddCategory} className="hr-add-category-btn">
                <i className="fas fa-plus"></i> Add Welfare Category
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      {loading ? (
        <div className="content-loader">
          <div className="spinner"></div>
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
              {overBudgetCount > 0 && (
                <Card className="hr-stat-card hr-stat-card-alert">
                  <Card.Body>
                    <div className="hr-stat-icon red">
                      <i className="fas fa-exclamation-triangle"></i>
                    </div>
                    <div className="hr-stat-info">
                      <div className="hr-stat-value">{overBudgetCount}</div>
                      <div className="hr-stat-label">Over Budget</div>
                    </div>
                  </Card.Body>
                </Card>
              )}
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
              <div className="hr-table-header-actions">
                <div className="hr-search-box">
                  <i className="fas fa-search"></i>
                  <input
                    type="text"
                    placeholder="Search departments or categories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="hr-search-input"
                  />
                  {searchQuery && (
                    <button className="hr-search-clear" onClick={() => setSearchQuery('')}>
                      <i className="fas fa-times"></i>
                    </button>
                  )}
                </div>
                <span className="hr-dept-count">
                  {filteredDepts.length}{filteredDepts.length !== deptResults.length ? ` / ${deptResults.length}` : ''} departments
                </span>
                {filteredDepts.length > 0 && (
                  <Button variant="ghost" size="small" onClick={toggleExpandAll} title={allExpanded ? 'Collapse all' : 'Expand all'}>
                    <i className={`fas fa-${allExpanded ? 'compress-alt' : 'expand-alt'}`}></i>
                    {allExpanded ? ' Collapse All' : ' Expand All'}
                  </Button>
                )}
              </div>
            </Card.Header>
            <Card.Body>
              {deptResults.length === 0 ? (
                <div className="hr-empty-state">
                  <i className="fas fa-info-circle"></i>
                  <p>No welfare categories found. Click &quot;Add Welfare Category&quot; to create one, or mark categories as &quot;Welfare&quot; in the Organization page.</p>
                </div>
              ) : filteredDepts.length === 0 ? (
                <div className="hr-empty-state">
                  <i className="fas fa-search"></i>
                  <p>No results match &quot;{searchQuery}&quot;. Try a different search term.</p>
                </div>
              ) : (
                <div className="hr-table-wrapper">
                  <table className="hr-welfare-table">
                    <thead>
                      <tr>
                        <th className="col-dept hr-sortable" onClick={() => handleSort('department')}>
                          Department <i className={getSortIcon('department')}></i>
                        </th>
                        <th className="col-cat hr-sortable" onClick={() => handleSort('category')}>
                          Category <i className={getSortIcon('category')}></i>
                        </th>
                        <th className="col-budget hr-sortable" onClick={() => handleSort('budget')}>
                          Budget <i className={getSortIcon('budget')}></i>
                        </th>
                        <th className="col-spent hr-sortable" onClick={() => handleSort('spent')}>
                          Spent <i className={getSortIcon('spent')}></i>
                        </th>
                        <th className="col-remaining hr-sortable" onClick={() => handleSort('remaining')}>
                          Remaining <i className={getSortIcon('remaining')}></i>
                        </th>
                        <th className="col-util hr-sortable" onClick={() => handleSort('utilization')}>
                          Utilization <i className={getSortIcon('utilization')}></i>
                        </th>
                        <th className="col-actions">Actions</th>
                      </tr>
                    </thead>
                    {sortedDepts.map(dept => {
                      const wc = dept.welfare_category
                      const isExpanded = expandedDepts[dept.department_id]
                      const key = `dept-${dept.department_id}-cat-${wc.id}`

                      return (
                        <tbody key={key} className={`hr-dept-group ${isExpanded ? 'hr-dept-group-expanded' : ''}`}>
                          <tr
                            className={`hr-dept-row ${isExpanded ? 'expanded' : ''} ${wc.remaining < 0 ? 'over-budget' : ''}`}
                            onClick={() => toggleExpand(dept.department_id)}
                          >
                            <td className="col-dept">
                              <span className="hr-expand-toggle">
                                <i className={`fas fa-chevron-right expand-icon ${isExpanded ? 'expand-icon-open' : ''}`}></i>
                              </span>
                              <span className="hr-dept-name">{dept.department_name}</span>
                            </td>
                            <td className="col-cat">
                              <span className="hr-cat-badge">{wc.name}</span>
                            </td>
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
                                <span className="hr-currency">{formatCurrency(wc.budget)}</span>
                              )}
                            </td>
                            <td className="col-spent">
                              <span className="hr-currency">{formatCurrency(wc.spent)}</span>
                            </td>
                            <td className={`col-remaining ${wc.remaining < 0 ? 'negative' : ''}`}>
                              <span className="hr-currency">{formatCurrency(wc.remaining)}</span>
                            </td>
                            <td className="col-util">
                              <UtilizationBar percent={wc.utilization_percent} />
                            </td>
                            <td className="col-actions" onClick={e => e.stopPropagation()}>
                              <div className="hr-actions-group">
                                <button
                                  className="hr-action-btn"
                                  onClick={() => startEdit('category', wc.id, wc.budget)}
                                  title="Edit budget"
                                >
                                  <i className="fas fa-coins"></i>
                                </button>
                                <button
                                  className="hr-action-btn"
                                  onClick={() => openEditItem('category', wc)}
                                  title="Edit category"
                                >
                                  <i className="fas fa-edit"></i>
                                </button>
                                <button
                                  className="hr-action-btn"
                                  onClick={() => openAddSubcategory(wc.id)}
                                  title="Add subcategory"
                                >
                                  <i className="fas fa-plus"></i>
                                </button>
                                <button
                                  className="hr-action-btn hr-action-btn-danger"
                                  onClick={() => openDeleteConfirm('category', wc)}
                                  title="Delete category"
                                >
                                  <i className="fas fa-trash"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && wc.subcategories.map((sub, idx) => (
                            <tr key={`sub-${sub.id}`} className={`hr-subcat-row ${idx === wc.subcategories.length - 1 ? 'hr-subcat-row-last' : ''}`}>
                              <td className="col-dept">
                                <span className="hr-tree-line">
                                  <span className={`hr-tree-connector ${idx === wc.subcategories.length - 1 ? 'hr-tree-connector-last' : ''}`}></span>
                                </span>
                              </td>
                              <td className="col-cat">
                                <span className="hr-subcat-name">{sub.name}</span>
                              </td>
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
                                  <span className="hr-currency hr-currency-sub">{formatCurrency(sub.budget)}</span>
                                )}
                              </td>
                              <td className="col-spent">
                                <span className="hr-currency hr-currency-sub">{formatCurrency(sub.spent)}</span>
                              </td>
                              <td className={`col-remaining ${sub.remaining < 0 ? 'negative' : ''}`}>
                                <span className="hr-currency hr-currency-sub">{formatCurrency(sub.remaining)}</span>
                              </td>
                              <td className="col-util">
                                <UtilizationBar percent={sub.utilization_percent} />
                              </td>
                              <td className="col-actions">
                                <div className="hr-actions-group">
                                  <button
                                    className="hr-action-btn"
                                    onClick={() => startEdit('subcategory', sub.id, sub.budget)}
                                    title="Edit budget"
                                  >
                                    <i className="fas fa-coins"></i>
                                  </button>
                                  <button
                                    className="hr-action-btn"
                                    onClick={() => openEditItem('subcategory', sub)}
                                    title="Edit subcategory"
                                  >
                                    <i className="fas fa-edit"></i>
                                  </button>
                                  <button
                                    className="hr-action-btn hr-action-btn-danger"
                                    onClick={() => openDeleteConfirm('subcategory', sub)}
                                    title="Delete subcategory"
                                  >
                                    <i className="fas fa-trash"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {isExpanded && wc.subcategories.length === 0 && (
                            <tr className="hr-subcat-row hr-empty-subcat-row">
                              <td colSpan="7" className="hr-empty-subcat">
                                <i className="fas fa-folder-open"></i>
                                <span>No subcategories yet</span>
                                <Button
                                  variant="ghost"
                                  size="small"
                                  onClick={() => openAddSubcategory(wc.id)}
                                >
                                  <i className="fas fa-plus"></i> Add Subcategory
                                </Button>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      )
                    })}
                  </table>
                </div>
              )}
            </Card.Body>
          </Card>
        </>
      )}

      {/* Add Welfare Category Modal */}
      <Modal.Form
        isOpen={showAddCategory}
        onClose={() => setShowAddCategory(false)}
        onSubmit={handleAddCategory}
        title="Add Welfare Category"
        submitText="Create"
        loading={modalLoading}
      >
        <div className="hr-modal-field">
          <Select
            label="Department"
            value={formData.department_id}
            onChange={(e) => setFormData(prev => ({ ...prev, department_id: e.target.value }))}
            required
          >
            <option value="">Select department...</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
        </div>
        <div className="hr-modal-field">
          <Input
            label="Category Name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Employee Benefits"
            required
          />
        </div>
        <div className="hr-modal-field">
          <Input
            label="Budget (ILS)"
            type="number"
            value={formData.budget}
            onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
            placeholder="0"
          />
        </div>
      </Modal.Form>

      {/* Add Subcategory Modal */}
      <Modal.Form
        isOpen={showAddSubcategory}
        onClose={() => setShowAddSubcategory(false)}
        onSubmit={handleAddSubcategory}
        title="Add Subcategory"
        submitText="Create"
        loading={modalLoading}
      >
        <div className="hr-modal-field">
          <Input
            label="Subcategory Name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Holiday Gifts"
            required
          />
        </div>
        <div className="hr-modal-field">
          <Input
            label="Budget (ILS)"
            type="number"
            value={formData.budget}
            onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
            placeholder="0"
          />
        </div>
      </Modal.Form>

      {/* Edit Category/Subcategory Modal */}
      <Modal.Form
        isOpen={showEditItem}
        onClose={() => { setShowEditItem(false); setEditTarget(null) }}
        onSubmit={handleEditItem}
        title={`Edit ${editTarget?.type === 'category' ? 'Category' : 'Subcategory'}`}
        submitText="Save"
        loading={modalLoading}
      >
        <div className="hr-modal-field">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>
        <div className="hr-modal-field">
          <Input
            label="Budget (ILS)"
            type="number"
            value={formData.budget}
            onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
            placeholder="0"
          />
        </div>
      </Modal.Form>

      {/* Delete Confirmation */}
      <Modal.Confirm
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setDeleteTarget(null) }}
        onConfirm={handleDelete}
        title={`Delete ${deleteTarget?.type === 'category' ? 'Category' : 'Subcategory'}`}
        message={`Are you sure you want to delete "${deleteTarget?.name}"? ${deleteTarget?.type === 'category' ? 'All subcategories under this category will also be deleted.' : ''} This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={modalLoading}
      />
    </div>
  )
}

export default HRDashboard
