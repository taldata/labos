import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import './UserManagement.css'

function UserManagement({ user, setUser }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [error, setError] = useState('')

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create')
  const [currentUser, setCurrentUser] = useState(null)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    is_admin: false,
    is_manager: false,
    is_accounting: false,
    status: 'active',
    can_use_modern_version: true,
    department_id: ''
  })
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/dashboard')
      return
    }
    fetchData()
  }, [statusFilter, roleFilter, departmentFilter])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Build query string
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (roleFilter !== 'all') params.append('role', roleFilter)
      if (departmentFilter !== 'all') params.append('department_id', departmentFilter)
      if (searchQuery) params.append('search', searchQuery)

      // Fetch users
      const usersRes = await fetch(`/api/v1/admin/users?${params.toString()}`, {
        credentials: 'include'
      })
      if (usersRes.ok) {
        const data = await usersRes.json()
        setUsers(data.users)
      }

      // Fetch departments for filter and form
      const deptRes = await fetch('/api/v1/organization/structure', {
        credentials: 'include'
      })
      if (deptRes.ok) {
        const data = await deptRes.json()
        setDepartments(data.structure)
      }
    } catch (err) {
      setError('Failed to load data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    setSearchQuery(e.target.value)
  }

  const doSearch = () => {
    fetchData()
  }

  const openModal = (mode, userToEdit = null) => {
    setModalMode(mode)
    setCurrentUser(userToEdit)
    setFormError('')

    if (mode === 'edit' && userToEdit) {
      setFormData({
        username: userToEdit.username,
        email: userToEdit.email,
        first_name: userToEdit.first_name || '',
        last_name: userToEdit.last_name || '',
        password: '',
        is_admin: userToEdit.is_admin,
        is_manager: userToEdit.is_manager,
        is_accounting: userToEdit.is_accounting,
        status: userToEdit.status,
        can_use_modern_version: userToEdit.can_use_modern_version,
        department_id: userToEdit.department_id || ''
      })
    } else {
      setFormData({
        username: '',
        email: '',
        first_name: '',
        last_name: '',
        password: '',
        is_admin: false,
        is_manager: false,
        is_accounting: false,
        status: 'active',
        can_use_modern_version: true,
        department_id: ''
      })
    }
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setCurrentUser(null)
    setFormError('')
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    try {
      const url = modalMode === 'create' 
        ? '/api/v1/admin/users' 
        : `/api/v1/admin/users/${currentUser.id}`
      
      const method = modalMode === 'create' ? 'POST' : 'PUT'
      
      const payload = { ...formData }
      if (!payload.password) delete payload.password
      if (!payload.department_id) payload.department_id = null

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        closeModal()
        fetchData()
      } else {
        const data = await res.json()
        setFormError(data.error || 'Operation failed')
      }
    } catch (err) {
      setFormError('An error occurred')
      console.error(err)
    }
  }

  const handleDelete = async (userToDelete) => {
    if (!window.confirm(`Are you sure you want to delete/deactivate ${userToDelete.username}?`)) {
      return
    }

    try {
      const res = await fetch(`/api/v1/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (res.ok) {
        fetchData()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete user')
      }
    } catch (err) {
      alert('An error occurred')
      console.error(err)
    }
  }

  const getRoleBadges = (u) => {
    const badges = []
    if (u.is_admin) badges.push(<span key="admin" className="role-badge admin">Admin</span>)
    if (u.is_manager) badges.push(<span key="manager" className="role-badge manager">Manager</span>)
    if (u.is_accounting) badges.push(<span key="accounting" className="role-badge accounting">Accounting</span>)
    if (badges.length === 0) badges.push(<span key="employee" className="role-badge employee">Employee</span>)
    return badges
  }

  const getStatusBadge = (status) => {
    const statusClasses = {
      active: 'status-active',
      inactive: 'status-inactive',
      pending: 'status-pending'
    }
    return <span className={`status-badge ${statusClasses[status] || ''}`}>{status}</span>
  }

  if (!user?.is_admin) {
    return null
  }

  return (
    <div className="user-management-container">
      <Header user={user} setUser={setUser} currentPage="admin" />

      <main className="user-management-main">
        <div className="page-header-section">
          <div>
            <h1>User Management</h1>
            <p className="subtitle">Manage user accounts and permissions</p>
          </div>
          <button className="btn-primary" onClick={() => openModal('create')}>
            <i className="fas fa-user-plus"></i> Add User
          </button>
        </div>

        {/* Filters */}
        <div className="filters-section card">
          <div className="search-box">
            <i className="fas fa-search"></i>
            <input
              type="text"
              placeholder="Search by name, username, or email..."
              value={searchQuery}
              onChange={handleSearch}
              onKeyPress={(e) => e.key === 'Enter' && doSearch()}
            />
            <button className="btn-search" onClick={doSearch}>Search</button>
          </div>
          <div className="filter-group">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="admin">Admins</option>
              <option value="manager">Managers</option>
              <option value="accounting">Accounting</option>
              <option value="employee">Employees Only</option>
            </select>
            <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
              <option value="all">All Departments</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading users...</p>
          </div>
        ) : error ? (
          <div className="error-message card">{error}</div>
        ) : (
          <div className="users-table-container card">
            <table className="users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Roles</th>
                  <th>Status</th>
                  <th>Modern UI</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-state">No users found</td>
                  </tr>
                ) : (
                  users.map(u => (
                    <tr key={u.id} className={u.status === 'inactive' ? 'inactive-row' : ''}>
                      <td className="user-cell">
                        <div className="user-avatar">
                          {(u.first_name?.[0] || u.username[0]).toUpperCase()}
                        </div>
                        <div className="user-info">
                          <span className="user-name">{u.first_name} {u.last_name}</span>
                          <span className="user-username">@{u.username}</span>
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td>{u.department_name || <span className="no-dept">No department</span>}</td>
                      <td className="roles-cell">{getRoleBadges(u)}</td>
                      <td>{getStatusBadge(u.status)}</td>
                      <td>
                        {u.can_use_modern_version ? (
                          <span className="modern-enabled"><i className="fas fa-check-circle"></i></span>
                        ) : (
                          <span className="modern-disabled"><i className="fas fa-times-circle"></i></span>
                        )}
                      </td>
                      <td className="actions-cell">
                        <button 
                          className="btn-icon" 
                          onClick={() => openModal('edit', u)}
                          title="Edit user"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        {u.id !== user.id && (
                          <button 
                            className="btn-icon delete" 
                            onClick={() => handleDelete(u)}
                            title="Delete user"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="table-footer">
              <span>{users.length} user(s) found</span>
            </div>
          </div>
        )}
      </main>

      {/* User Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal user-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'create' ? 'Add New User' : 'Edit User'}</h2>
              <button className="btn-icon" onClick={closeModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            {formError && <div className="form-error">{formError}</div>}
            
            <form onSubmit={handleSubmit} className="user-form">
              <div className="form-row">
                <div className="form-group">
                  <label><i className="fas fa-user"></i> Username</label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                    disabled={modalMode === 'edit'}
                    placeholder="Enter username"
                  />
                </div>
                <div className="form-group">
                  <label><i className="fas fa-envelope"></i> Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter email"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label><i className="fas fa-id-card"></i> First Name</label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    placeholder="Enter first name"
                  />
                </div>
                <div className="form-group">
                  <label><i className="fas fa-id-card"></i> Last Name</label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label><i className="fas fa-lock"></i> Password {modalMode === 'edit' && '(leave blank to keep)'}</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder={modalMode === 'create' ? 'Enter password' : 'Leave blank to keep current'}
                  />
                </div>
                <div className="form-group">
                  <label><i className="fas fa-building"></i> Department</label>
                  <select
                    name="department_id"
                    value={formData.department_id}
                    onChange={handleInputChange}
                  >
                    <option value="">No Department</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label><i className="fas fa-toggle-on"></i> Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              <div className="form-group checkbox-group">
                <label className="section-label"><i className="fas fa-shield-alt"></i> Permissions</label>
                <div className="checkbox-row">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="is_admin"
                      checked={formData.is_admin}
                      onChange={handleInputChange}
                    />
                    <span>Administrator</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="is_manager"
                      checked={formData.is_manager}
                      onChange={handleInputChange}
                    />
                    <span>Manager</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="is_accounting"
                      checked={formData.is_accounting}
                      onChange={handleInputChange}
                    />
                    <span>Accounting</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="can_use_modern_version"
                      checked={formData.can_use_modern_version}
                      onChange={handleInputChange}
                    />
                    <span>Modern UI Access</span>
                  </label>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {modalMode === 'create' ? 'Create User' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserManagement
