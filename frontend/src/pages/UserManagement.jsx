import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Input, Select, TomSelectInput, Modal, Badge, Skeleton, useToast, PageHeader } from '../components/ui'
import { useScrollToItem } from '../hooks/useScrollToItem'
import logger from '../utils/logger'
import './UserManagement.css'

function UserManagement({ user, setUser }) {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [newUserId, setNewUserId] = useState(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
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
    is_admin: false,
    is_manager: false,
    is_accounting: false,
    status: 'active',
    can_use_modern_version: true,
    department_id: ''
  })
  const [formError, setFormError] = useState('')

  // Auto-scroll to newly created user
  const { getItemRef } = useScrollToItem(users, newUserId, () => setNewUserId(null))

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 400)
    return () => clearTimeout(handler)
  }, [searchQuery])

  useEffect(() => {
    // Fetch departments once on mount
    fetchDepartments()
  }, [])

  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/dashboard')
      return
    }
    fetchUsers()
  }, [statusFilter, roleFilter, departmentFilter, debouncedSearchQuery])

  const fetchDepartments = async () => {
    try {
      const deptRes = await fetch('/api/v1/organization/structure', {
        credentials: 'include'
      })
      if (deptRes.ok) {
        const data = await deptRes.json()
        setDepartments(data.structure)
      }
    } catch (err) {
      logger.error('Failed to load departments', { error: err.message })
    }
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)

      // Build query string
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (roleFilter !== 'all') params.append('role', roleFilter)
      if (departmentFilter !== 'all') params.append('department_id', departmentFilter)
      if (debouncedSearchQuery) params.append('search', debouncedSearchQuery)

      // Fetch users
      const usersRes = await fetch(`/api/v1/admin/users?${params.toString()}`, {
        credentials: 'include'
      })
      if (usersRes.ok) {
        const data = await usersRes.json()
        setUsers(data.users)
      }
    } catch (err) {
      showError('Failed to load users')
      logger.error('Failed to load users', { error: err.message })
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    setSearchQuery(e.target.value)
  }

  const doSearch = () => {
    setDebouncedSearchQuery(searchQuery)
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
      if (!payload.department_id) payload.department_id = null

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (res.ok) {
        success(modalMode === 'create' ? 'User created successfully' : 'User updated successfully')
        closeModal()
        // Store the new user ID for auto-scroll
        if (modalMode === 'create' && data.user?.id) {
          setNewUserId(data.user.id)
        }
        fetchData()
      } else {
        setFormError(data.error || 'Operation failed')
      }
    } catch (err) {
      setFormError('An error occurred')
      logger.error('User save operation failed', { error: err.message })
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
        success('User deleted successfully')
        fetchData()
      } else {
        const data = await res.json()
        showError(data.error || 'Failed to delete user')
      }
    } catch (err) {
      showError('An error occurred')
      logger.error('User delete operation failed', { userId: userToDelete?.id, error: err.message })
    }
  }

  const getRoleBadges = (u) => {
    const badges = []
    if (u.is_admin) badges.push(<Badge key="admin" variant="warning">Admin</Badge>)
    if (u.is_manager) badges.push(<Badge key="manager" variant="info">Manager</Badge>)
    if (u.is_accounting) badges.push(<Badge key="accounting" variant="success">Accounting</Badge>)
    if (badges.length === 0) badges.push(<Badge key="employee" variant="default">Employee</Badge>)
    return badges
  }

  const getStatusVariant = (status) => {
    if (status === 'active') return 'success'
    if (status === 'inactive') return 'danger'
    return 'warning'
  }

  if (!user?.is_admin) {
    return null
  }

  return (
    <div className="user-management-container">

      <main className="user-management-main">
        <PageHeader
          title="User Management"
          subtitle="Manage user accounts and permissions"
          icon="fas fa-users"
          variant="teal"
        />

        {/* Filters */}
        <Card className="filters-section">
          <Card.Body>
            <div className="search-box">
              <Input
                type="text"
                placeholder="Search by name, username, or email..."
                value={searchQuery}
                onChange={handleSearch}
                onKeyPress={(e) => e.key === 'Enter' && doSearch()}
                icon="fas fa-search"
              />
            </div>

          </Card.Body>
        </Card>

        {/* Users Table */}
        {loading ? (
          <div className="loading-container">
            <Skeleton variant="title" width="40%" />
            <Skeleton variant="text" count={8} />
          </div>
        ) : (
          <Card className="users-table-container">
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
                    <tr
                      key={u.id}
                      ref={getItemRef(u.id)}
                      data-item-id={u.id}
                      className={u.status === 'inactive' ? 'inactive-row' : ''}
                    >
                      <td>
                        <div className="user-cell">
                          <div className="user-avatar" style={u.profile_pic ? { padding: 0, overflow: 'hidden' } : {}}>
                            {u.profile_pic ? (
                              <img
                                src={u.profile_pic}
                                alt={`${u.first_name} ${u.last_name}`}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              (u.first_name?.[0] || u.username[0]).toUpperCase()
                            )}
                          </div>
                          <div className="user-details-info">
                            <span className="user-name">{u.first_name} {u.last_name}</span>
                            <span className="user-username">@{u.username}</span>
                          </div>
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td>{u.department_name || <span className="no-dept">No department</span>}</td>
                      <td><div className="roles-cell">{getRoleBadges(u)}</div></td>
                      <td><Badge variant={getStatusVariant(u.status)}>{u.status}</Badge></td>
                      <td>
                        {u.can_use_modern_version ? (
                          <span className="modern-enabled"><i className="fas fa-check-circle"></i></span>
                        ) : (
                          <span className="modern-disabled"><i className="fas fa-times-circle"></i></span>
                        )}
                      </td>
                      <td>
                        <div className="actions-cell">
                          <Button
                            variant="ghost"
                            size="small"
                            icon="fas fa-edit"
                            onClick={() => openModal('edit', u)}
                            title="Edit user"
                          />
                          {u.id !== user.id && (
                            <Button
                              variant="ghost"
                              size="small"
                              icon="fas fa-trash"
                              onClick={() => handleDelete(u)}
                              title="Delete user"
                              className="btn-delete"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="table-footer">
              <span>{users.length} user(s) found</span>
            </div>
          </Card>
        )}
      </main>

      {/* User Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={modalMode === 'create' ? 'Add New User' : 'Edit User'}
        size="large"
      >
        {formError && <div className="form-error">{formError}</div>}

        <form onSubmit={handleSubmit} className="user-form">
          <div className="form-row">
            <Input
              label="Username"
              icon="fas fa-user"
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              required
              disabled={modalMode === 'edit'}
              placeholder="Enter username"
            />
            <Input
              label="Email"
              icon="fas fa-envelope"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              placeholder="Enter email"
            />
          </div>

          <div className="form-row">
            <Input
              label="First Name"
              icon="fas fa-id-card"
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleInputChange}
              placeholder="Enter first name"
            />
            <Input
              label="Last Name"
              icon="fas fa-id-card"
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleInputChange}
              placeholder="Enter last name"
            />
          </div>

          <TomSelectInput
            label="Department"
            name="department_id"
            value={formData.department_id}
            onChange={handleInputChange}
            options={departments}
            displayKey="name"
            valueKey="id"
            placeholder="No Department"
          />

          <Select
            label="Status"
            icon="fas fa-toggle-on"
            name="status"
            value={formData.status}
            onChange={handleInputChange}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </Select>

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
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {modalMode === 'create' ? 'Create User' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default UserManagement
