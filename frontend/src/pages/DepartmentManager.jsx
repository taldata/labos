import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './DepartmentManager.css';

const api = axios.create({
    withCredentials: true
});

const DepartmentManager = () => {
    const [structure, setStructure] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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

    useEffect(() => {
        fetchStructure();
    }, []);

    const fetchStructure = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/v1/organization/structure');
            setStructure(response.data.structure);
            setLoading(false);
        } catch (err) {
            setError('Failed to load organization structure');
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
            await fetchStructure();
            closeModal();
        } catch (err) {
            alert(err.response?.data?.error || 'An error occurred');
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
            fetchStructure();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete item');
        }
    };

    if (loading) return <div className="loading-container"><div className="spinner"></div></div>;
    if (error) return <div className="error-message">{error}</div>;

    return (
        <div className="department-manager">
            <div className="manager-header">
                <h1>Organization Structure</h1>
                <button className="btn-primary" onClick={() => openModal('department', 'create')}>
                    <i className="fas fa-plus"></i> Add Department
                </button>
            </div>

            <div className="org-tree">
                {structure.map(dept => (
                    <div key={dept.id} className="dept-card">
                        <div className="dept-header" onClick={() => toggleDept(dept.id)}>
                            <div className="dept-info">
                                <i className={`fas fa-chevron-down expand-icon ${expandedDepts[dept.id] ? 'expanded' : ''}`}></i>
                                <span className="dept-name">{dept.name}</span>
                                <span className="dept-budget">{dept.currency} {dept.budget.toLocaleString()}</span>
                            </div>
                            <div className="actions" onClick={e => e.stopPropagation()}>
                                <button className="btn-icon" onClick={() => openModal('department', 'edit', dept)} title="Edit Department">
                                    <i className="fas fa-edit"></i>
                                </button>
                                <button className="btn-icon" onClick={() => openModal('category', 'create', null, dept.id)} title="Add Category">
                                    <i className="fas fa-plus-circle"></i>
                                </button>
                                <button className="btn-icon delete" onClick={() => handleDelete('department', dept.id)} title="Delete Department">
                                    <i className="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>

                        {expandedDepts[dept.id] && (
                            <div className="dept-content">
                                <div className="category-list">
                                    {dept.categories.length === 0 && <div className="empty-state">No categories yet</div>}
                                    {dept.categories.map(cat => (
                                        <div key={cat.id} className="category-item">
                                            <div className="category-header" onClick={() => toggleCat(cat.id)}>
                                                <div className="dept-info">
                                                    <i className={`fas fa-chevron-right expand-icon ${expandedCats[cat.id] ? 'expanded' : ''}`}></i>
                                                    <span className="category-name">{cat.name}</span>
                                                    <span className="dept-budget">{dept.currency} {cat.budget.toLocaleString()}</span>
                                                </div>
                                                <div className="actions" onClick={e => e.stopPropagation()}>
                                                    <button className="btn-icon" onClick={() => openModal('category', 'edit', cat)} title="Edit Category">
                                                        <i className="fas fa-edit"></i>
                                                    </button>
                                                    <button className="btn-icon" onClick={() => openModal('subcategory', 'create', null, cat.id)} title="Add Subcategory">
                                                        <i className="fas fa-plus-circle"></i>
                                                    </button>
                                                    <button className="btn-icon delete" onClick={() => handleDelete('category', cat.id)} title="Delete Category">
                                                        <i className="fas fa-trash"></i>
                                                    </button>
                                                </div>
                                            </div>

                                            {expandedCats[cat.id] && (
                                                <div className="subcategory-list">
                                                    {cat.subcategories.length === 0 && <div className="empty-state">No subcategories yet</div>}
                                                    {cat.subcategories.map(sub => (
                                                        <div key={sub.id} className="subcategory-item">
                                                            <div className="dept-info">
                                                                <span className="subcategory-name">{sub.name}</span>
                                                                <span className="dept-budget">{dept.currency} {sub.budget.toLocaleString()}</span>
                                                            </div>
                                                            <div className="actions">
                                                                <button className="btn-icon" onClick={() => openModal('subcategory', 'edit', sub)} title="Edit Subcategory">
                                                                    <i className="fas fa-edit"></i>
                                                                </button>
                                                                <button className="btn-icon delete" onClick={() => handleDelete('subcategory', sub.id)} title="Delete Subcategory">
                                                                    <i className="fas fa-trash"></i>
                                                                </button>
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

            {modalOpen && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{modalMode === 'create' ? 'Add' : 'Edit'} {modalType.charAt(0).toUpperCase() + modalType.slice(1)}</h2>
                            <button className="btn-icon" onClick={closeModal}><i className="fas fa-times"></i></button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-form">
                            <div className="form-group">
                                <label>Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label>Budget</label>
                                <input
                                    type="number"
                                    name="budget"
                                    value={formData.budget}
                                    onChange={handleInputChange}
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                            {modalType === 'department' && (
                                <div className="form-group">
                                    <label>Currency</label>
                                    <select name="currency" value={formData.currency} onChange={handleInputChange}>
                                        <option value="ILS">ILS</option>
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                    </select>
                                </div>
                            )}
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="btn-primary">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DepartmentManager;
