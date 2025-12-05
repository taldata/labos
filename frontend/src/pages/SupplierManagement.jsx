import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import './SupplierManagement.css'

function SupplierManagement({ user, setUser }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState([])
  const [error, setError] = useState('')

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create')
  const [currentSupplier, setCurrentSupplier] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    tax_id: '',
    bank_name: '',
    bank_account_number: '',
    bank_branch: '',
    bank_swift: '',
    notes: '',
    status: 'active'
  })
  const [formError, setFormError] = useState('')

  // Expanded view
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/dashboard')
      return
    }
    fetchSuppliers()
  }, [statusFilter])

  const fetchSuppliers = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (searchQuery) params.append('search', searchQuery)

      const res = await fetch(`/api/v1/admin/suppliers?${params.toString()}`, {
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        setSuppliers(data.suppliers)
      }
    } catch (err) {
      setError('Failed to load suppliers')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    fetchSuppliers()
  }

  const openModal = (mode, supplier = null) => {
    setModalMode(mode)
    setCurrentSupplier(supplier)
    setFormError('')

    if (mode === 'edit' && supplier) {
      setFormData({
        name: supplier.name || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
        tax_id: supplier.tax_id || '',
        bank_name: supplier.bank_name || '',
        bank_account_number: supplier.bank_account_number || '',
        bank_branch: supplier.bank_branch || '',
        bank_swift: supplier.bank_swift || '',
        notes: supplier.notes || '',
        status: supplier.status || 'active'
      })
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        tax_id: '',
        bank_name: '',
        bank_account_number: '',
        bank_branch: '',
        bank_swift: '',
        notes: '',
        status: 'active'
      })
    }
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setCurrentSupplier(null)
    setFormError('')
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    try {
      const url = modalMode === 'create'
        ? '/api/v1/admin/suppliers'
        : `/api/v1/admin/suppliers/${currentSupplier.id}`

      const res = await fetch(url, {
        method: modalMode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        closeModal()
        fetchSuppliers()
      } else {
        const data = await res.json()
        setFormError(data.error || 'Operation failed')
      }
    } catch (err) {
      setFormError('An error occurred')
    }
  }

  const handleDelete = async (supplier) => {
    if (!window.confirm(`Delete supplier "${supplier.name}"?`)) return

    try {
      const res = await fetch(`/api/v1/admin/suppliers/${supplier.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (res.ok) {
        fetchSuppliers()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete')
      }
    } catch (err) {
      alert('An error occurred')
    }
  }

  if (!user?.is_admin) return null

  return (
    <div className="supplier-management-container">
      <Header user={user} setUser={setUser} currentPage="admin" />

      <main className="supplier-management-main">
        <div className="page-header-section">
          <div>
            <h1>Supplier Management</h1>
            <p className="subtitle">Manage vendors and suppliers</p>
          </div>
          <button className="btn-primary" onClick={() => openModal('create')}>
            <i className="fas fa-plus"></i> Add Supplier
          </button>
        </div>

        {/* Filters */}
        <div className="filters-section card">
          <div className="search-box">
            <i className="fas fa-search"></i>
            <input
              type="text"
              placeholder="Search by name, email, or tax ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button className="btn-search" onClick={handleSearch}>Search</button>
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Suppliers List */}
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading suppliers...</p>
          </div>
        ) : error ? (
          <div className="error-message card">{error}</div>
        ) : (
          <div className="suppliers-grid">
            {suppliers.length === 0 ? (
              <div className="empty-state card">
                <i className="fas fa-building"></i>
                <h3>No suppliers found</h3>
                <p>Add your first supplier to get started</p>
              </div>
            ) : (
              suppliers.map(supplier => (
                <div key={supplier.id} className={`supplier-card card ${supplier.status === 'inactive' ? 'inactive' : ''}`}>
                  <div className="supplier-header">
                    <div className="supplier-avatar">
                      {supplier.name[0].toUpperCase()}
                    </div>
                    <div className="supplier-title">
                      <h3>{supplier.name}</h3>
                      <span className={`status-badge ${supplier.status}`}>{supplier.status}</span>
                    </div>
                    <div className="supplier-actions">
                      <button className="btn-icon" onClick={() => openModal('edit', supplier)} title="Edit">
                        <i className="fas fa-edit"></i>
                      </button>
                      <button className="btn-icon delete" onClick={() => handleDelete(supplier)} title="Delete">
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>

                  <div className="supplier-info">
                    {supplier.email && (
                      <div className="info-row">
                        <i className="fas fa-envelope"></i>
                        <span>{supplier.email}</span>
                      </div>
                    )}
                    {supplier.phone && (
                      <div className="info-row">
                        <i className="fas fa-phone"></i>
                        <span>{supplier.phone}</span>
                      </div>
                    )}
                    {supplier.tax_id && (
                      <div className="info-row">
                        <i className="fas fa-id-card"></i>
                        <span>Tax ID: {supplier.tax_id}</span>
                      </div>
                    )}
                  </div>

                  <div className="supplier-footer">
                    <span className="expense-count">
                      <i className="fas fa-receipt"></i> {supplier.expense_count} expenses
                    </span>
                    <button 
                      className="btn-expand"
                      onClick={() => setExpandedId(expandedId === supplier.id ? null : supplier.id)}
                    >
                      {expandedId === supplier.id ? 'Less' : 'More'} <i className={`fas fa-chevron-${expandedId === supplier.id ? 'up' : 'down'}`}></i>
                    </button>
                  </div>

                  {expandedId === supplier.id && (
                    <div className="supplier-details">
                      {supplier.address && (
                        <div className="detail-row">
                          <label>Address</label>
                          <span>{supplier.address}</span>
                        </div>
                      )}
                      {supplier.bank_name && (
                        <div className="detail-row">
                          <label>Bank</label>
                          <span>{supplier.bank_name}</span>
                        </div>
                      )}
                      {supplier.bank_account_number && (
                        <div className="detail-row">
                          <label>Account</label>
                          <span>{supplier.bank_account_number}</span>
                        </div>
                      )}
                      {supplier.bank_branch && (
                        <div className="detail-row">
                          <label>Branch</label>
                          <span>{supplier.bank_branch}</span>
                        </div>
                      )}
                      {supplier.notes && (
                        <div className="detail-row">
                          <label>Notes</label>
                          <span>{supplier.notes}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal supplier-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'create' ? 'Add Supplier' : 'Edit Supplier'}</h2>
              <button className="btn-icon" onClick={closeModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            {formError && <div className="form-error">{formError}</div>}

            <form onSubmit={handleSubmit} className="supplier-form">
              <div className="form-section">
                <h4>Basic Information</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Supplier Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      placeholder="Company name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Tax ID</label>
                    <input
                      type="text"
                      name="tax_id"
                      value={formData.tax_id}
                      onChange={handleInputChange}
                      placeholder="Tax identification number"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="contact@company.com"
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+972-XX-XXX-XXXX"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Address</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Full address"
                  />
                </div>
              </div>

              <div className="form-section">
                <h4>Banking Details</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Bank Name</label>
                    <input
                      type="text"
                      name="bank_name"
                      value={formData.bank_name}
                      onChange={handleInputChange}
                      placeholder="Bank name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Branch</label>
                    <input
                      type="text"
                      name="bank_branch"
                      value={formData.bank_branch}
                      onChange={handleInputChange}
                      placeholder="Branch number"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Account Number</label>
                    <input
                      type="text"
                      name="bank_account_number"
                      value={formData.bank_account_number}
                      onChange={handleInputChange}
                      placeholder="Account number"
                    />
                  </div>
                  <div className="form-group">
                    <label>SWIFT Code</label>
                    <input
                      type="text"
                      name="bank_swift"
                      value={formData.bank_swift}
                      onChange={handleInputChange}
                      placeholder="SWIFT/BIC code"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h4>Additional</h4>
                <div className="form-group">
                  <label>Status</label>
                  <select name="status" value={formData.status} onChange={handleInputChange}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary">
                  {modalMode === 'create' ? 'Add Supplier' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default SupplierManagement
