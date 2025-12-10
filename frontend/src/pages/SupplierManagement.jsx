import { useState, useEffect, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { Card, Button, Input, Select, Textarea, Modal, Badge, Skeleton, useToast } from '../components/ui'
import './SupplierManagement.css'

function SupplierManagement({ user, setUser }) {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState([])

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
      } else {
        showError('Failed to load suppliers')
      }
    } catch (err) {
      showError('Failed to load suppliers')
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
        success(modalMode === 'create' ? 'Supplier added successfully' : 'Supplier updated successfully')
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
        success('Supplier deleted successfully')
        fetchSuppliers()
      } else {
        const data = await res.json()
        showError(data.error || 'Failed to delete')
      }
    } catch (err) {
      showError('An error occurred')
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
          <Button variant="primary" icon="fas fa-plus" onClick={() => openModal('create')}>
            Add Supplier
          </Button>
        </div>

        {/* Filters */}
        <Card className="filters-section">
          <Card.Body>
            <div className="search-box">
              <Input
                type="text"
                placeholder="Search by name, email, or tax ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                icon="fas fa-search"
              />
              <Button variant="primary" onClick={handleSearch}>Search</Button>
            </div>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Card.Body>
        </Card>

        {/* Suppliers Table */}
        {loading ? (
          <div className="loading-container">
            <Skeleton variant="title" width="40%" />
            <Skeleton variant="text" count={6} />
          </div>
        ) : (
          <Card className="suppliers-table-container">
            <table className="suppliers-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Contact</th>
                  <th>Tax ID</th>
                  <th>Bank</th>
                  <th>Expenses</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-state">
                      <i className="fas fa-building"></i>
                      <h3>No suppliers found</h3>
                      <p>Add your first supplier to get started</p>
                    </td>
                  </tr>
                ) : (
                  suppliers.map(supplier => (
                    <Fragment key={supplier.id}>
                      <tr className={supplier.status === 'inactive' ? 'inactive-row' : ''}>
                        <td className="supplier-cell">
                          <div className="supplier-avatar">
                            {supplier.name[0].toUpperCase()}
                          </div>
                          <span className="supplier-name">{supplier.name}</span>
                        </td>
                        <td className="contact-cell">
                          {supplier.email ? (
                            <span className="email"><i className="fas fa-envelope"></i> {supplier.email}</span>
                          ) : null}
                          {supplier.phone ? (
                            <span className="phone"><i className="fas fa-phone"></i> {supplier.phone}</span>
                          ) : null}
                          {!supplier.email && !supplier.phone && <span className="no-data">—</span>}
                        </td>
                        <td>
                          {supplier.tax_id || <span className="no-data">—</span>}
                        </td>
                        <td className="bank-cell">
                          {supplier.bank_name ? (
                            <div className="bank-info">
                              <span className="bank-name-text">{supplier.bank_name}</span>
                              {supplier.bank_account_number && (
                                <span className="bank-account">Acc: {supplier.bank_account_number}</span>
                              )}
                            </div>
                          ) : (
                            <span className="no-data">—</span>
                          )}
                        </td>
                        <td>
                          <span className="expense-count">
                            <i className="fas fa-receipt"></i> {supplier.expense_count || 0}
                          </span>
                        </td>
                        <td>
                          <Badge variant={supplier.status === 'active' ? 'success' : 'danger'}>
                            {supplier.status}
                          </Badge>
                        </td>
                        <td className="actions-cell">
                          <Button
                            variant="ghost"
                            size="small"
                            icon={`fas fa-chevron-${expandedId === supplier.id ? 'up' : 'down'}`}
                            onClick={() => setExpandedId(expandedId === supplier.id ? null : supplier.id)}
                            title={expandedId === supplier.id ? 'Collapse' : 'Expand'}
                          />
                          <Button
                            variant="ghost"
                            size="small"
                            icon="fas fa-edit"
                            onClick={() => openModal('edit', supplier)}
                            title="Edit"
                          />
                          <Button
                            variant="ghost"
                            size="small"
                            icon="fas fa-trash"
                            onClick={() => handleDelete(supplier)}
                            title="Delete"
                            className="btn-delete"
                          />
                        </td>
                      </tr>
                      {expandedId === supplier.id && (
                        <tr key={`${supplier.id}-expanded`} className="expanded-content">
                          <td colSpan="7">
                            <div className="expanded-details">
                              {supplier.address && (
                                <div className="detail-item">
                                  <span className="label">Address</span>
                                  <span className="value">{supplier.address}</span>
                                </div>
                              )}
                              {supplier.bank_branch && (
                                <div className="detail-item">
                                  <span className="label">Bank Branch</span>
                                  <span className="value">{supplier.bank_branch}</span>
                                </div>
                              )}
                              {supplier.bank_swift && (
                                <div className="detail-item">
                                  <span className="label">SWIFT Code</span>
                                  <span className="value">{supplier.bank_swift}</span>
                                </div>
                              )}
                              {supplier.notes && (
                                <div className="detail-item">
                                  <span className="label">Notes</span>
                                  <span className="value">{supplier.notes}</span>
                                </div>
                              )}
                              {!supplier.address && !supplier.bank_branch && !supplier.bank_swift && !supplier.notes && (
                                <span className="no-data">No additional details</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
            <div className="table-footer">
              <span>{suppliers.length} supplier(s) found</span>
            </div>
          </Card>
        )}
      </main>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={modalMode === 'create' ? 'Add Supplier' : 'Edit Supplier'}
        size="large"
      >
        {formError && <div className="form-error">{formError}</div>}

        <form onSubmit={handleSubmit} className="supplier-form">
          <div className="form-section">
            <h4>Basic Information</h4>
            <div className="form-row">
              <Input
                label="Supplier Name *"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="Company name"
              />
              <Input
                label="Tax ID"
                type="text"
                name="tax_id"
                value={formData.tax_id}
                onChange={handleInputChange}
                placeholder="Tax identification number"
              />
            </div>

            <div className="form-row">
              <Input
                label="Email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="contact@company.com"
              />
              <Input
                label="Phone"
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="+972-XX-XXX-XXXX"
              />
            </div>

            <Input
              label="Address"
              type="text"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="Full address"
            />
          </div>

          <div className="form-section">
            <h4>Banking Details</h4>
            <div className="form-row">
              <Input
                label="Bank Name"
                type="text"
                name="bank_name"
                value={formData.bank_name}
                onChange={handleInputChange}
                placeholder="Bank name"
              />
              <Input
                label="Branch"
                type="text"
                name="bank_branch"
                value={formData.bank_branch}
                onChange={handleInputChange}
                placeholder="Branch number"
              />
            </div>

            <div className="form-row">
              <Input
                label="Account Number"
                type="text"
                name="bank_account_number"
                value={formData.bank_account_number}
                onChange={handleInputChange}
                placeholder="Account number"
              />
              <Input
                label="SWIFT Code"
                type="text"
                name="bank_swift"
                value={formData.bank_swift}
                onChange={handleInputChange}
                placeholder="SWIFT/BIC code"
              />
            </div>
          </div>

          <div className="form-section">
            <h4>Additional</h4>
            <Select
              label="Status"
              name="status"
              value={formData.status}
              onChange={handleInputChange}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
            <Textarea
              label="Notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              placeholder="Additional notes..."
            />
          </div>

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" variant="primary">
              {modalMode === 'create' ? 'Add Supplier' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default SupplierManagement
