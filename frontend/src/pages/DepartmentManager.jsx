import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, Button, Input, Select, Modal, Skeleton, useToast, PageHeader } from '../components/ui';
import { useScrollToItem } from '../hooks/useScrollToItem';
import './DepartmentManager.css';

const api = axios.create({
    withCredentials: true
});

const DepartmentManager = ({ user, setUser }) => {
    const navigate = useNavigate();
    const { success, error: showError } = useToast();
    const [structure, setStructure] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewOnly, setViewOnly] = useState(false); // View-only mode for managers

    // Year State
    const [years, setYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState(null);
    const [loadingYears, setLoadingYears] = useState(true);

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState(null); // 'department', 'category', 'subcategory', 'year'
    const [modalMode, setModalMode] = useState('create'); // 'create', 'edit'
    const [currentItem, setCurrentItem] = useState(null);
    const [parentId, setParentId] = useState(null); // For creating child items

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        budget: '',
        currency: 'ILS',
        is_welfare: false,
        year: new Date().getFullYear()
    });

    // Expanded State
    const [expandedDepts, setExpandedDepts] = useState({});
    const [expandedCats, setExpandedCats] = useState({});

    // Search State
    const [searchQuery, setSearchQuery] = useState('');

    // Copy Year Modal
    const [showCopyModal, setShowCopyModal] = useState(false);
    const [sourceYearId, setSourceYearId] = useState(null);

    // Auto-scroll and highlight for new items
    const [newDepartmentId, setNewDepartmentId] = useState(null);
    const { getItemRef } = useScrollToItem(structure, newDepartmentId, () => setNewDepartmentId(null));

    // Check if user is admin or manager (managers get view-only access to their departments)
    const isAdmin = user?.is_admin;
    const isManager = user?.is_manager;
    const isHR = user?.is_hr;

    useEffect(() => {
        if (!isAdmin && !isManager && !isHR) {
            navigate('/dashboard');
            return;
        }
        // Set view-only mode for managers and HR (non-admins)
        if ((isManager || isHR) && !isAdmin) {
            setViewOnly(true);
        }
        fetchYears();
    }, []);

    useEffect(() => {
        if (selectedYear) {
            fetchStructure(selectedYear.id);
        }
    }, [selectedYear]);

    const fetchYears = async () => {
        try {
            setLoadingYears(true);
            const response = await api.get('/api/v1/organization/years');
            const yearsData = response.data.years || [];
            setYears(yearsData);

            // Select year matching actual current calendar year, or fallback to is_current flag, or first available
            const actualCurrentYear = new Date().getFullYear();
            const currentYear = yearsData.find(y => y.year === actualCurrentYear) || yearsData.find(y => y.is_current) || yearsData[0];
            if (currentYear) {
                setSelectedYear(currentYear);
            } else {
                setLoading(false);
            }
            setLoadingYears(false);
        } catch (err) {
            showError('Failed to load budget years');
            setLoadingYears(false);
            setLoading(false);
        }
    };

    const fetchStructure = async (yearId) => {
        try {
            setLoading(true);
            const response = await api.get(`/api/v1/organization/structure?year_id=${yearId}`);
            setStructure(response.data.structure);
            // Update view_only from server response
            if (response.data.view_only) {
                setViewOnly(true);
            }
            setLoading(false);
        } catch (err) {
            showError('Failed to load organization structure');
            setLoading(false);
        }
    };

    const toggleDept = (deptId) => {
        setExpandedDepts(prev => ({
            ...prev,
            [deptId]: !prev[deptId]
        }));
    };

    const toggleCat = (catId) => {
        setExpandedCats(prev => ({
            ...prev,
            [catId]: !prev[catId]
        }));
    };

    const openModal = (type, mode, item = null, parent = null) => {
        setModalType(type);
        setModalMode(mode);
        setCurrentItem(item);
        setParentId(parent);

        if (type === 'year') {
            setFormData({
                name: '',
                budget: '',
                currency: 'ILS',
                year: mode === 'edit' && item ? item.year : new Date().getFullYear() + 1
            });
        } else if (mode === 'edit' && item) {
            setFormData({
                name: item.name,
                budget: item.budget || 0,
                currency: item.currency || 'ILS',
                is_welfare: item.is_welfare || false,
                year: new Date().getFullYear()
            });
        } else {
            setFormData({
                name: '',
                budget: '',
                currency: 'ILS',
                is_welfare: false,
                year: new Date().getFullYear()
            });
        }

        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setFormData({ name: '', budget: '', currency: 'ILS', is_welfare: false, year: new Date().getFullYear() });
        setCurrentItem(null);
        setParentId(null);
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            let url = '';
            let method = modalMode === 'create' ? 'post' : 'put';
            let data = { ...formData };

            // Handle year type
            if (modalType === 'year') {
                url = '/api/v1/organization/years';
                data = { year: parseInt(formData.year), name: formData.year.toString() };
                await api.post(url, data);
                success('Budget year created successfully');
                await fetchYears();
                closeModal();
                return;
            }

            // Construct URL and Data based on type
            if (modalType === 'department') {
                url = modalMode === 'create'
                    ? '/api/v1/organization/departments'
                    : `/api/v1/organization/departments/${currentItem.id}`;
                // Add year_id to new departments
                if (modalMode === 'create' && selectedYear) {
                    data.year_id = selectedYear.id;
                }
            } else if (modalType === 'category') {
                url = modalMode === 'create'
                    ? '/api/v1/organization/categories'
                    : `/api/v1/organization/categories/${currentItem.id}`;
                if (modalMode === 'create') data.department_id = parentId;
            } else if (modalType === 'subcategory') {
                url = modalMode === 'create'
                    ? '/api/v1/organization/subcategories'
                    : `/api/v1/organization/subcategories/${currentItem.id}`;
                if (modalMode === 'create') data.category_id = parentId;
            }

            const response = await api[method](url, data);
            success(modalMode === 'create' ? `${modalType} created successfully` : `${modalType} updated successfully`);
            await fetchStructure(selectedYear?.id);

            // Auto-scroll and highlight newly created department
            if (modalMode === 'create' && modalType === 'department' && response.data) {
                const newDeptId = response.data.id || response.data.department?.id;
                if (newDeptId) {
                    setNewDepartmentId(newDeptId);
                    // Auto-expand the newly created department
                    setExpandedDepts(prev => ({ ...prev, [newDeptId]: true }));
                }
            }

            closeModal();
        } catch (err) {
            showError(err.response?.data?.error || 'An error occurred');
        }
    };

    const handleDelete = async (type, id) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;

        try {
            let url = '';
            if (type === 'department') url = `/api/v1/organization/departments/${id}`;
            else if (type === 'category') url = `/api/v1/organization/categories/${id}`;
            else if (type === 'subcategory') url = `/api/v1/organization/subcategories/${id}`;

            await api.delete(url);
            success(`${type} deleted successfully`);
            fetchStructure(selectedYear?.id);
        } catch (err) {
            showError(err.response?.data?.error || 'Failed to delete item');
        }
    };

    // Filter structure based on search query
    const filteredStructure = structure.filter(dept => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();

        // Check department name
        if (dept.name.toLowerCase().includes(query)) return true;

        // Check category names
        if (dept.categories.some(cat => cat.name.toLowerCase().includes(query))) return true;

        // Check subcategory names
        if (dept.categories.some(cat =>
            cat.subcategories.some(sub => sub.name.toLowerCase().includes(query))
        )) return true;

        return false;
    });

    // Calculate budget usage percentage
    const getBudgetUsage = (spent, total) => {
        if (!total || total === 0) return 0;
        return Math.min((spent / total) * 100, 100);
    };

    const getCurrencyLabel = (currency) => {
        return currency === 'ILS' ? 'ILS' : currency;
    };

    if (!isAdmin && !isManager) {
        return null;
    }

    // Manager View - Simplified dashboard-style layout
    if (viewOnly) {
        return (
            <div className="department-manager-container manager-view">
                {loading ? (
                    <div className="loading-container">
                        <Skeleton variant="title" width="40%" />
                        <Skeleton variant="text" count={3} />
                    </div>
                ) : (
                    <main className="department-manager">
                        <PageHeader
                            title="My Departments"
                            subtitle="Budget & category overview"
                            icon="fas fa-building"
                            variant="purple"
                            actions={
                                <div className="year-selector" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <label style={{ fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>Year:</label>
                                    <Select
                                        value={selectedYear?.id || ''}
                                        onChange={(e) => {
                                            const yearObj = years.find(y => y.id === parseInt(e.target.value));
                                            setSelectedYear(yearObj);
                                        }}
                                        style={{ minWidth: '100px' }}
                                    >
                                        {years.map(y => (
                                            <option key={y.id} value={y.id}>
                                                {y.name}
                                            </option>
                                        ))}
                                    </Select>
                                </div>
                            }
                        />

                        {filteredStructure.length === 0 ? (
                            <Card className="empty-card">
                                <div className="empty-state-manager">
                                    <i className="fas fa-folder-open"></i>
                                    <h3>No departments assigned</h3>
                                    <p>Contact your system administrator to assign departments</p>
                                </div>
                            </Card>
                        ) : (
                            <div className="manager-departments-grid">
                                {filteredStructure.map(dept => {
                                    const remaining = dept.budget - (dept.spent || 0);
                                    const usagePercent = getBudgetUsage(dept.spent || 0, dept.budget);
                                    const isOverBudget = remaining < 0;
                                    const isWarning = usagePercent >= 80 && !isOverBudget;

                                    return (
                                        <Card key={dept.id} className="manager-dept-card">
                                            {/* Department Header */}
                                            <div className="manager-dept-header">
                                                <div className="manager-dept-title">
                                                    <h2>{dept.name}</h2>
                                                </div>
                                            </div>

                                            {/* Budget Overview */}
                                            <div className="manager-budget-overview">
                                                <div className="manager-budget-stats">
                                                    <div className="manager-stat">
                                                        <span className="manager-stat-label">Budget</span>
                                                        <span className="manager-stat-value">
                                                            {dept.budget.toLocaleString()} {getCurrencyLabel(dept.currency)}
                                                        </span>
                                                    </div>
                                                    <div className="manager-stat">
                                                        <span className="manager-stat-label">Expenses</span>
                                                        <span className="manager-stat-value spent">
                                                            {(dept.spent || 0).toLocaleString()} {getCurrencyLabel(dept.currency)}
                                                        </span>
                                                    </div>
                                                    <div className="manager-stat">
                                                        <span className="manager-stat-label">Remaining</span>
                                                        <span className={`manager-stat-value ${isOverBudget ? 'negative' : 'positive'}`}>
                                                            {remaining.toLocaleString()} {getCurrencyLabel(dept.currency)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="manager-progress-container">
                                                    <div className={`manager-progress-bar ${isOverBudget ? 'over-budget' : isWarning ? 'warning' : ''}`}>
                                                        <div
                                                            className="manager-progress-fill"
                                                            style={{ width: `${Math.min(usagePercent, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="manager-progress-text">{usagePercent.toFixed(0)}% used</span>
                                                </div>
                                            </div>

                                            {/* Categories */}
                                            <div className="manager-categories">
                                                <h3 className="manager-section-title">
                                                    <i className="fas fa-folder"></i>
                                                    Categories ({dept.categories.length})
                                                </h3>

                                                {dept.categories.length === 0 ? (
                                                    <p className="no-categories">No categories in this department</p>
                                                ) : (
                                                    <div className="manager-categories-list">
                                                        {dept.categories.map(cat => {
                                                            const catRemaining = cat.budget - (cat.spent || 0);
                                                            const catUsage = getBudgetUsage(cat.spent || 0, cat.budget);

                                                            return (
                                                                <div key={cat.id} className="manager-category-item">
                                                                    <div className="manager-category-header">
                                                                        <span className="manager-category-name">
                                                                            <i className="fas fa-folder-open"></i>
                                                                            {cat.name}
                                                                        </span>
                                                                        <span
                                                                            className="manager-category-expenses-link"
                                                                            onClick={() => navigate(`/manager/expense-history?category_id=${cat.id}`)}
                                                                            title="View expenses"
                                                                        >
                                                                            <i className="fas fa-external-link-alt"></i>
                                                                        </span>
                                                                    </div>
                                                                    <div className="manager-category-stats">
                                                                        <span className="cat-stat-item">
                                                                            <span className="cat-stat-label">Budget:</span>
                                                                            <span className="cat-budget" dir="ltr">{cat.budget.toLocaleString()}</span>
                                                                        </span>
                                                                        <span className="cat-separator">|</span>
                                                                        <span className="cat-stat-item">
                                                                            <span className="cat-stat-label">Expenses:</span>
                                                                            <span className="cat-spent" dir="ltr">{(cat.spent || 0).toLocaleString()}</span>
                                                                        </span>
                                                                        <span className="cat-separator">|</span>
                                                                        <span className="cat-stat-item">
                                                                            <span className="cat-stat-label">Remaining:</span>
                                                                            <span className={`cat-remaining ${catRemaining < 0 ? 'negative' : 'positive'}`} dir="ltr">
                                                                                {catRemaining < 0 ? `${Math.abs(catRemaining).toLocaleString()}-` : catRemaining.toLocaleString()}
                                                                            </span>
                                                                        </span>
                                                                    </div>
                                                                    <div className="manager-category-progress">
                                                                        <div
                                                                            className={`manager-cat-progress-fill ${catUsage >= 100 ? 'over' : catUsage >= 80 ? 'warning' : ''}`}
                                                                            style={{ width: `${Math.min(catUsage, 100)}%` }}
                                                                        ></div>
                                                                    </div>

                                                                    {/* Subcategories */}
                                                                    {cat.subcategories.length > 0 && (
                                                                        <div className="manager-subcategories">
                                                                            {cat.subcategories.map(sub => {
                                                                                const subRemaining = sub.budget - (sub.spent || 0);
                                                                                return (
                                                                                    <div key={sub.id} className="manager-subcategory-item">
                                                                                        <span className="sub-name">
                                                                                            <i className="fas fa-file-alt"></i>
                                                                                            {sub.name}
                                                                                        </span>
                                                                                        <span className="sub-stats">
                                                                                            <span className="sub-stat-item">
                                                                                                <span className="sub-stat-label">Budget:</span>
                                                                                                <span className="sub-budget" dir="ltr">{sub.budget.toLocaleString()}</span>
                                                                                            </span>
                                                                                            <span className="sub-separator">|</span>
                                                                                            <span
                                                                                                className="sub-stat-item actionable"
                                                                                                onClick={() => navigate(`/manager/expense-history?subcategory_id=${sub.id}`)}
                                                                                                title="View expenses"
                                                                                            >
                                                                                                <span className="sub-stat-label">Expenses:</span>
                                                                                                <span className="sub-spent" dir="ltr">{(sub.spent || 0).toLocaleString()}</span>
                                                                                            </span>
                                                                                            <span className="sub-separator">|</span>
                                                                                            <span className="sub-stat-item">
                                                                                                <span className="sub-stat-label">Remaining:</span>
                                                                                                <span className={`sub-remaining ${subRemaining < 0 ? 'negative' : 'positive'}`} dir="ltr">
                                                                                                    {subRemaining < 0 ? `${Math.abs(subRemaining).toLocaleString()}-` : subRemaining.toLocaleString()}
                                                                                                </span>
                                                                                            </span>
                                                                                        </span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Quick Action */}
                                            <div className="manager-dept-actions">
                                                <Button
                                                    variant="ghost"
                                                    size="small"
                                                    icon="fas fa-list"
                                                    onClick={() => navigate(`/manager/expense-history?department_id=${dept.id}`)}
                                                >
                                                    View All Expenses
                                                </Button>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </main>
                )}
            </div>
        );
    }

    // Calculate summary totals
    const totalBudget = structure.reduce((sum, d) => sum + (d.budget || 0), 0);
    const totalSpent = structure.reduce((sum, d) => sum + (d.spent || 0), 0);
    const totalRemaining = totalBudget - totalSpent;
    const overallUsage = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;

    // Admin View - Full management interface
    return (
        <div className="department-manager-container">

            {loading ? (
                <div className="loading-container">
                    <Skeleton variant="title" width="40%" />
                    <Skeleton variant="text" count={5} />
                </div>
            ) : (
                <main className="department-manager">
                    <PageHeader
                        title="Organization Structure"
                        subtitle="Manage departments, categories & budgets"
                        icon="fas fa-sitemap"
                        variant="purple"
                        actions={
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                <div className="year-selector" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <Select
                                        value={selectedYear?.id || ''}
                                        onChange={(e) => {
                                            const yearObj = years.find(y => y.id === parseInt(e.target.value));
                                            setSelectedYear(yearObj);
                                        }}
                                        style={{ minWidth: '120px' }}
                                    >
                                        {years.map(y => (
                                            <option key={y.id} value={y.id}>
                                                {y.name} {y.is_current ? '(Current)' : ''}
                                            </option>
                                        ))}
                                    </Select>
                                    <Button
                                        variant="ghost"
                                        size="small"
                                        icon="fas fa-calendar-plus"
                                        onClick={() => openModal('year', 'create')}
                                        title="Add new year"
                                    />
                                </div>
                                <Button variant="secondary" icon="fas fa-plus" onClick={() => openModal('department', 'create')}>
                                    Add Department
                                </Button>
                            </div>
                        }
                    />

                    {/* Summary Dashboard */}
                    <div className="org-summary">
                        <div className="summary-card">
                            <div className="summary-icon-wrap summary-icon--departments">
                                <i className="fas fa-building"></i>
                            </div>
                            <div className="summary-data">
                                <span className="summary-value">{structure.length}</span>
                                <span className="summary-label">Departments</span>
                            </div>
                        </div>
                        <div className="summary-card">
                            <div className="summary-icon-wrap summary-icon--budget">
                                <i className="fas fa-wallet"></i>
                            </div>
                            <div className="summary-data">
                                <span className="summary-value">{totalBudget.toLocaleString()}</span>
                                <span className="summary-label">Total Budget</span>
                            </div>
                        </div>
                        <div className="summary-card">
                            <div className="summary-icon-wrap summary-icon--spent">
                                <i className="fas fa-receipt"></i>
                            </div>
                            <div className="summary-data">
                                <span className="summary-value">{totalSpent.toLocaleString()}</span>
                                <span className="summary-label">Total Expenses</span>
                            </div>
                        </div>
                        <div className="summary-card">
                            <div className={`summary-icon-wrap ${totalRemaining >= 0 ? 'summary-icon--remaining' : 'summary-icon--over'}`}>
                                <i className={`fas ${totalRemaining >= 0 ? 'fa-piggy-bank' : 'fa-exclamation-triangle'}`}></i>
                            </div>
                            <div className="summary-data">
                                <span className={`summary-value ${totalRemaining < 0 ? 'summary-value--negative' : ''}`}>{totalRemaining.toLocaleString()}</span>
                                <span className="summary-label">Remaining</span>
                            </div>
                        </div>
                        <div className="summary-card summary-card--wide">
                            <div className="summary-progress-wrap">
                                <div className="summary-progress-header">
                                    <span className="summary-progress-title">Overall Budget Usage</span>
                                    <span className="summary-progress-pct">{overallUsage.toFixed(0)}%</span>
                                </div>
                                <div className="summary-progress-track">
                                    <div
                                        className={`summary-progress-fill ${overallUsage >= 100 ? 'over' : overallUsage >= 80 ? 'warning' : ''}`}
                                        style={{ width: `${Math.min(overallUsage, 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="search-container">
                        <Input
                            type="text"
                            placeholder="Search departments, categories or subcategories..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            icon="fas fa-search"
                        />
                    </div>

                    {/* Department List */}
                    <div className="org-tree">
                        {filteredStructure.length === 0 && (
                            <div className="empty-state">
                                <i className="fas fa-folder-open"></i>
                                <h3>{searchQuery ? `No results found for "${searchQuery}"` : 'No departments yet'}</h3>
                                <p>{searchQuery ? 'Try a different search term' : 'Click "Add Department" to get started'}</p>
                            </div>
                        )}
                        {filteredStructure.map(dept => {
                            const deptRemaining = dept.budget - (dept.spent || 0);
                            const deptUsage = getBudgetUsage(dept.spent || 0, dept.budget);
                            const isOverBudget = deptRemaining < 0;
                            const isExpanded = expandedDepts[dept.id];

                            return (
                                <div key={dept.id} className={`dept-card ${isExpanded ? 'dept-card--expanded' : ''} ${isOverBudget ? 'dept-card--over' : ''}`} ref={getItemRef(dept.id)}>
                                    {/* Department Header */}
                                    <div className="dept-header" onClick={() => toggleDept(dept.id)}>
                                        <div className="dept-header-main">
                                            <button className="dept-expand-btn" type="button">
                                                <i className={`fas fa-chevron-down ${isExpanded ? 'rotated' : ''}`}></i>
                                            </button>
                                            <div className="dept-name-group">
                                                <h3 className="dept-name">{dept.name}</h3>
                                                <span className="dept-meta">{dept.categories.length} categories</span>
                                            </div>
                                        </div>
                                        <div className="dept-header-stats">
                                            <div className="dept-stat">
                                                <span className="dept-stat-label">Budget</span>
                                                <span className="dept-stat-value">{dept.budget.toLocaleString()} <small>{getCurrencyLabel(dept.currency)}</small></span>
                                            </div>
                                            <div
                                                className="dept-stat dept-stat--clickable"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/admin/expense-history?department_id=${dept.id}`);
                                                }}
                                                title="Click to view expense details"
                                            >
                                                <span className="dept-stat-label">Expenses</span>
                                                <span className="dept-stat-value dept-stat-value--spent">{(dept.spent || 0).toLocaleString()} <small>{getCurrencyLabel(dept.currency)}</small></span>
                                            </div>
                                            <div className="dept-stat">
                                                <span className="dept-stat-label">Remaining</span>
                                                <span className={`dept-stat-value ${isOverBudget ? 'dept-stat-value--negative' : 'dept-stat-value--positive'}`}>
                                                    {isOverBudget && <i className="fas fa-exclamation-circle"></i>}
                                                    {deptRemaining.toLocaleString()} <small>{getCurrencyLabel(dept.currency)}</small>
                                                </span>
                                            </div>
                                        </div>
                                        <div className="dept-header-actions" onClick={e => e.stopPropagation()}>
                                            <Button variant="ghost" size="small" icon="fas fa-pen" onClick={() => openModal('department', 'edit', dept)} title="Edit department" />
                                            <Button variant="ghost" size="small" icon="fas fa-plus" onClick={() => openModal('category', 'create', null, dept.id)} title="Add category" />
                                            <Button variant="ghost" size="small" icon="fas fa-trash-alt" onClick={() => handleDelete('department', dept.id)} title="Delete department" className="btn-delete" />
                                        </div>
                                    </div>

                                    {/* Progress Bar - Always visible */}
                                    <div className="dept-progress-row">
                                        <div className="dept-progress-track">
                                            <div
                                                className={`dept-progress-fill ${isOverBudget ? 'over' : deptUsage >= 80 ? 'warning' : ''}`}
                                                style={{ width: `${Math.min(deptUsage, 100)}%` }}
                                            ></div>
                                        </div>
                                        <span className="dept-progress-pct">{deptUsage.toFixed(0)}%</span>
                                    </div>

                                    {/* Expanded Content - Categories */}
                                    {isExpanded && (
                                        <div className="dept-body">
                                            {dept.categories.length === 0 ? (
                                                <div className="empty-state empty-state--compact">
                                                    <i className="fas fa-folder-plus"></i>
                                                    <p>No categories yet. Click <strong>+</strong> to add one</p>
                                                </div>
                                            ) : (
                                                <div className="cat-list">
                                                    {dept.categories.map(cat => {
                                                        const catRemaining = cat.budget - (cat.spent || 0);
                                                        const catUsage = getBudgetUsage(cat.spent || 0, cat.budget);
                                                        const catOver = catRemaining < 0;
                                                        const catExpanded = expandedCats[cat.id];

                                                        return (
                                                            <div key={cat.id} className={`cat-card ${catExpanded ? 'cat-card--expanded' : ''}`}>
                                                                <div className="cat-header" onClick={() => toggleCat(cat.id)}>
                                                                    <div className="cat-header-main">
                                                                        <i className={`fas fa-chevron-left cat-expand-icon ${catExpanded ? 'rotated' : ''}`}></i>
                                                                        <span className="cat-name">
                                                                            {cat.name}
                                                                            {cat.is_welfare && <i className="fas fa-heart cat-welfare-icon" title="Welfare category"></i>}
                                                                        </span>
                                                                    </div>
                                                                    <div className="cat-header-stats">
                                                                        <span className="cat-chip">
                                                                            <span className="cat-chip-label">Budget</span>
                                                                            <strong>{cat.budget.toLocaleString()}</strong>
                                                                        </span>
                                                                        <span
                                                                            className="cat-chip cat-chip--clickable"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                navigate(`/admin/expense-history?category_id=${cat.id}`);
                                                                            }}
                                                                            title="Click to view expense details"
                                                                        >
                                                                            <span className="cat-chip-label">Expenses</span>
                                                                            <strong>{(cat.spent || 0).toLocaleString()}</strong>
                                                                        </span>
                                                                        <span className={`cat-chip ${catOver ? 'cat-chip--negative' : 'cat-chip--positive'}`}>
                                                                            <span className="cat-chip-label">Remaining</span>
                                                                            <strong>{catRemaining.toLocaleString()}</strong>
                                                                        </span>
                                                                    </div>
                                                                    <div className="cat-progress-inline">
                                                                        <div className="cat-progress-track">
                                                                            <div
                                                                                className={`cat-progress-fill ${catOver ? 'over' : catUsage >= 80 ? 'warning' : ''}`}
                                                                                style={{ width: `${Math.min(catUsage, 100)}%` }}
                                                                            ></div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="cat-actions" onClick={e => e.stopPropagation()}>
                                                                        <Button variant="ghost" size="small" icon="fas fa-pen" onClick={() => openModal('category', 'edit', cat)} title="Edit category" />
                                                                        <Button variant="ghost" size="small" icon="fas fa-plus" onClick={() => openModal('subcategory', 'create', null, cat.id)} title="Add subcategory" />
                                                                        <Button variant="ghost" size="small" icon="fas fa-trash-alt" onClick={() => handleDelete('category', cat.id)} title="Delete category" className="btn-delete" />
                                                                    </div>
                                                                </div>

                                                                {/* Subcategories */}
                                                                {catExpanded && (
                                                                    <div className="sub-list">
                                                                        {cat.subcategories.length === 0 ? (
                                                                            <div className="empty-state empty-state--compact">
                                                                                <p>No subcategories. Click <strong>+</strong> to add one</p>
                                                                            </div>
                                                                        ) : (
                                                                            cat.subcategories.map(sub => {
                                                                                const subRemaining = sub.budget - (sub.spent || 0);
                                                                                const subOver = subRemaining < 0;
                                                                                return (
                                                                                    <div key={sub.id} className="sub-item">
                                                                                        <div className="sub-item-main">
                                                                                            <i className="fas fa-file-alt sub-icon"></i>
                                                                                            <span className="sub-name">{sub.name}</span>
                                                                                        </div>
                                                                                        <div className="sub-item-stats">
                                                                                            <span className="sub-chip">
                                                                                                <span className="sub-chip-label">Budget</span>
                                                                                                <strong>{sub.budget.toLocaleString()}</strong>
                                                                                            </span>
                                                                                            <span
                                                                                                className="sub-chip sub-chip--clickable"
                                                                                                onClick={() => navigate(`/admin/expense-history?subcategory_id=${sub.id}`)}
                                                                                                title="Click to view expense details"
                                                                                            >
                                                                                                <span className="sub-chip-label">Expenses</span>
                                                                                                <strong>{(sub.spent || 0).toLocaleString()}</strong>
                                                                                            </span>
                                                                                            <span className={`sub-chip ${subOver ? 'sub-chip--negative' : 'sub-chip--positive'}`}>
                                                                                                <span className="sub-chip-label">Remaining</span>
                                                                                                <strong>{subRemaining.toLocaleString()}</strong>
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="sub-actions">
                                                                                            <Button variant="ghost" size="small" icon="fas fa-pen" onClick={() => openModal('subcategory', 'edit', sub)} title="Edit subcategory" />
                                                                                            <Button variant="ghost" size="small" icon="fas fa-trash-alt" onClick={() => handleDelete('subcategory', sub.id)} title="Delete subcategory" className="btn-delete" />
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <Modal
                        isOpen={modalOpen}
                        onClose={closeModal}
                        title={modalType === 'year' ? 'Add Budget Year' : `${modalMode === 'create' ? 'Add' : 'Edit'} ${modalType === 'department' ? 'Department' : modalType === 'category' ? 'Category' : 'Subcategory'}`}
                        size="medium"
                    >
                        <form onSubmit={handleSubmit} className="modal-form">
                            {modalType === 'year' ? (
                                <Input
                                    label="Year"
                                    icon="fas fa-calendar"
                                    type="number"
                                    name="year"
                                    value={formData.year}
                                    onChange={handleInputChange}
                                    required
                                    autoFocus
                                    placeholder="Enter year (e.g. 2026)"
                                    min="2020"
                                    max="2100"
                                />
                            ) : (
                                <>
                                    <Input
                                        label="Name"
                                        icon="fas fa-tag"
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        required
                                        autoFocus
                                        placeholder={`Enter ${modalType === 'department' ? 'department' : modalType === 'category' ? 'category' : 'subcategory'} name`}
                                    />

                                    <Input
                                        label="Budget"
                                        icon="fas fa-wallet"
                                        type="number"
                                        name="budget"
                                        value={formData.budget}
                                        onChange={handleInputChange}
                                        min="0"
                                        step="0.01"
                                        placeholder="Enter budget amount"
                                    />

                                    {modalType === 'department' && (
                                        <Select
                                            label="Currency"
                                            icon="fas fa-dollar-sign"
                                            name="currency"
                                            value={formData.currency}
                                            onChange={handleInputChange}
                                        >
                                            <option value="ILS">₪ Israeli Shekel</option>
                                            <option value="USD">$ US Dollar</option>
                                            <option value="EUR">€ Euro</option>
                                        </Select>
                                    )}

                                    {modalType === 'category' && (
                                        <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                name="is_welfare"
                                                checked={formData.is_welfare}
                                                onChange={handleInputChange}
                                            />
                                            <i className="fas fa-heart" style={{ color: '#10b981' }}></i>
                                            <span>Welfare Category</span>
                                        </label>
                                    )}
                                </>
                            )}

                            <div className="modal-actions">
                                <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
                                <Button type="submit" variant="primary">Save</Button>
                            </div>
                        </form>
                    </Modal>
                </main>
            )}
        </div>
    );
};

export default DepartmentManager;
