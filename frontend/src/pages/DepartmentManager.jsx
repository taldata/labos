import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import { Card, Button, Input, Select, Modal, Skeleton, useToast } from '../components/ui';
import './DepartmentManager.css';

const api = axios.create({
    withCredentials: true
});

const DepartmentManager = ({ user, setUser }) => {
    const navigate = useNavigate();
    const { success, error: showError } = useToast();
    const [structure, setStructure] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState(null); // 'department', 'category', 'subcategory'
    const [modalMode, setModalMode] = useState('create'); // 'create', 'edit'
    const [currentItem, setCurrentItem] = useState(null);
    const [parentId, setParentId] = useState(null); // For creating child items

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        budget: '',
        currency: 'ILS'
    });

    // Expanded State
    const [expandedDepts, setExpandedDepts] = useState({});
    const [expandedCats, setExpandedCats] = useState({});

    // Search State
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!user?.is_admin) {
            navigate('/dashboard');
            return;
        }
        fetchStructure();
    }, []);

    const fetchStructure = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/v1/organization/structure');
            setStructure(response.data.structure);
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

        if (mode === 'edit' && item) {
            setFormData({
                name: item.name,
                budget: item.budget || 0,
                currency: item.currency || 'ILS'
            });
        } else {
            setFormData({
                name: '',
                budget: '',
                currency: 'ILS'
            });
        }

        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setFormData({ name: '', budget: '', currency: 'ILS' });
        setCurrentItem(null);
        setParentId(null);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            let url = '';
            let method = modalMode === 'create' ? 'post' : 'put';
            let data = { ...formData };

            // Construct URL and Data based on type
            if (modalType === 'department') {
                url = modalMode === 'create'
                    ? '/api/v1/organization/departments'
                    : `/api/v1/organization/departments/${currentItem.id}`;
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

            await api[method](url, data);
            success(modalMode === 'create' ? `${modalType} created successfully` : `${modalType} updated successfully`);
            await fetchStructure();
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
            fetchStructure();
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

    if (!user?.is_admin) {
        return null;
    }

    return (
        <div className="department-manager-container">
            <Header user={user} setUser={setUser} currentPage="admin" />
            
            {loading ? (
                <div className="loading-container">
                    <Skeleton variant="title" width="40%" />
                    <Skeleton variant="text" count={5} />
                </div>
            ) : (
            <main className="department-manager">
            <div className="manager-header">
                <h1>Organization Structure</h1>
                <Button variant="primary" icon="fas fa-plus" onClick={() => openModal('department', 'create')}>
                    Add Department
                </Button>
            </div>

            {/* Search Bar */}
            <div className="search-container">
                <Input
                    type="text"
                    placeholder="Search departments, categories, or subcategories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    icon="fas fa-search"
                />
            </div>

            <div className="org-tree">
                {filteredStructure.length === 0 && (
                    <div className="empty-state">
                        {searchQuery ? `No results found for "${searchQuery}"` : 'No departments yet. Click "Add Department" to get started!'}
                    </div>
                )}
                {filteredStructure.map(dept => (
                    <div key={dept.id} className="dept-card">
                        <div className="dept-header" onClick={() => toggleDept(dept.id)}>
                            <div className="dept-info">
                                <i className={`fas fa-chevron-down expand-icon ${expandedDepts[dept.id] ? 'expanded' : ''}`}></i>
                                <div className="dept-icon">🏢</div>
                                <span className="dept-name">{dept.name}</span>
                                <span className="dept-budget">{dept.budget.toLocaleString()} {dept.currency}</span>
                            </div>
                            <div className="actions" onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="small" icon="fas fa-edit" onClick={() => openModal('department', 'edit', dept)} title="Edit Department" />
                                <Button variant="ghost" size="small" icon="fas fa-plus-circle" onClick={() => openModal('category', 'create', null, dept.id)} title="Add Category" />
                                <Button variant="ghost" size="small" icon="fas fa-trash" onClick={() => handleDelete('department', dept.id)} title="Delete Department" className="btn-delete" />
                            </div>
                        </div>

                        {expandedDepts[dept.id] && (
                            <div className="dept-content">
                                {/* Department Budget Progress */}
                                <div className="budget-progress">
                                    <div className="budget-progress-label">
                                        <span>Budget Usage</span>
                                        <span>{dept.spent?.toLocaleString() || 0} / {dept.budget.toLocaleString()} {dept.currency}</span>
                                    </div>
                                    <div className="budget-progress-bar">
                                        <div
                                            className="budget-progress-fill"
                                            style={{ width: `${getBudgetUsage(dept.spent || 0, dept.budget)}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div className="category-list">
                                    {dept.categories.length === 0 && <div className="empty-state">No categories yet. Click the + button above to add one!</div>}
                                    {dept.categories.map(cat => (
                                        <div key={cat.id} className="category-item">
                                            <div className="category-header" onClick={() => toggleCat(cat.id)}>
                                                <div className="dept-info">
                                                    <i className={`fas fa-chevron-right expand-icon ${expandedCats[cat.id] ? 'expanded' : ''}`}></i>
                                                    <div className="category-icon">📁</div>
                                                    <span className="category-name">{cat.name}</span>
                                                    <span className="dept-budget">{cat.budget.toLocaleString()} {dept.currency}</span>
                                                </div>
                                                <div className="actions" onClick={e => e.stopPropagation()}>
                                                    <Button variant="ghost" size="small" icon="fas fa-edit" onClick={() => openModal('category', 'edit', cat)} title="Edit Category" />
                                                    <Button variant="ghost" size="small" icon="fas fa-plus-circle" onClick={() => openModal('subcategory', 'create', null, cat.id)} title="Add Subcategory" />
                                                    <Button variant="ghost" size="small" icon="fas fa-trash" onClick={() => handleDelete('category', cat.id)} title="Delete Category" className="btn-delete" />
                                                </div>
                                            </div>

                                            {expandedCats[cat.id] && (
                                                <div className="subcategory-list">
                                                    {cat.subcategories.length === 0 && <div className="empty-state">No subcategories yet. Click the + button above to add one!</div>}
                                                    {cat.subcategories.map(sub => (
                                                        <div key={sub.id} className="subcategory-item">
                                                            <div className="dept-info">
                                                                <div className="subcategory-icon">📄</div>
                                                                <span className="subcategory-name">{sub.name}</span>
                                                                <span className="dept-budget">{sub.budget.toLocaleString()} {dept.currency}</span>
                                                            </div>
                                                            <div className="actions">
                                                                <Button variant="ghost" size="small" icon="fas fa-edit" onClick={() => openModal('subcategory', 'edit', sub)} title="Edit Subcategory" />
                                                                <Button variant="ghost" size="small" icon="fas fa-trash" onClick={() => handleDelete('subcategory', sub.id)} title="Delete Subcategory" className="btn-delete" />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <Modal
                isOpen={modalOpen}
                onClose={closeModal}
                title={`${modalMode === 'create' ? 'Add' : 'Edit'} ${modalType.charAt(0).toUpperCase() + modalType.slice(1)}`}
                size="medium"
            >
                <form onSubmit={handleSubmit} className="modal-form">
                    <Input
                        label="Name"
                        icon="fas fa-tag"
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        autoFocus
                        placeholder={`Enter ${modalType} name`}
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
                            <option value="ILS">₪ ILS (Israeli Shekel)</option>
                            <option value="USD">$ USD (US Dollar)</option>
                            <option value="EUR">€ EUR (Euro)</option>
                        </Select>
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
