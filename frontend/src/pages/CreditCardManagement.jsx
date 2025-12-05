import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import './CreditCardManagement.css'

function CreditCardManagement({ user, setUser }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [cards, setCards] = useState([])
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create')
  const [currentCard, setCurrentCard] = useState(null)
  const [formData, setFormData] = useState({
    last_four_digits: '',
    description: '',
    status: 'active'
  })
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!user?.is_admin) {
      navigate('/dashboard')
      return
    }
    fetchCards()
  }, [statusFilter])

  const fetchCards = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)

      const res = await fetch(`/api/v1/admin/credit-cards?${params.toString()}`, {
        credentials: 'include'
      })
      if (res.ok) {
        const data = await res.json()
        setCards(data.credit_cards)
      }
    } catch (err) {
      setError('Failed to load credit cards')
    } finally {
      setLoading(false)
    }
  }

  const openModal = (mode, card = null) => {
    setModalMode(mode)
    setCurrentCard(card)
    setFormError('')

    if (mode === 'edit' && card) {
      setFormData({
        last_four_digits: card.last_four_digits || '',
        description: card.description || '',
        status: card.status || 'active'
      })
    } else {
      setFormData({
        last_four_digits: '',
        description: '',
        status: 'active'
      })
    }
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setCurrentCard(null)
    setFormError('')
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    if (name === 'last_four_digits') {
      // Only allow digits and max 4 characters
      const cleaned = value.replace(/\D/g, '').slice(0, 4)
      setFormData(prev => ({ ...prev, [name]: cleaned }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    if (formData.last_four_digits.length !== 4) {
      setFormError('Please enter exactly 4 digits')
      return
    }

    try {
      const url = modalMode === 'create'
        ? '/api/v1/admin/credit-cards'
        : `/api/v1/admin/credit-cards/${currentCard.id}`

      const res = await fetch(url, {
        method: modalMode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        closeModal()
        fetchCards()
      } else {
        const data = await res.json()
        setFormError(data.error || 'Operation failed')
      }
    } catch (err) {
      setFormError('An error occurred')
    }
  }

  const handleDelete = async (card) => {
    if (!window.confirm(`Delete credit card ending in ${card.last_four_digits}?`)) return

    try {
      const res = await fetch(`/api/v1/admin/credit-cards/${card.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (res.ok) {
        fetchCards()
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
    <div className="credit-card-management-container">
      <Header user={user} setUser={setUser} currentPage="admin" />

      <main className="credit-card-management-main">
        <div className="page-header-section">
          <div>
            <h1>Credit Card Management</h1>
            <p className="subtitle">Manage company credit cards</p>
          </div>
          <button className="btn-primary" onClick={() => openModal('create')}>
            <i className="fas fa-plus"></i> Add Card
          </button>
        </div>

        {/* Filters */}
        <div className="filters-section card">
          <div className="filter-label">
            <i className="fas fa-filter"></i> Filter by status:
          </div>
          <div className="filter-buttons">
            <button 
              className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All
            </button>
            <button 
              className={`filter-btn ${statusFilter === 'active' ? 'active' : ''}`}
              onClick={() => setStatusFilter('active')}
            >
              Active
            </button>
            <button 
              className={`filter-btn ${statusFilter === 'inactive' ? 'active' : ''}`}
              onClick={() => setStatusFilter('inactive')}
            >
              Inactive
            </button>
          </div>
        </div>

        {/* Cards Grid */}
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading credit cards...</p>
          </div>
        ) : error ? (
          <div className="error-message card">{error}</div>
        ) : (
          <div className="cards-grid">
            {cards.length === 0 ? (
              <div className="empty-state card">
                <i className="fas fa-credit-card"></i>
                <h3>No credit cards found</h3>
                <p>Add your first credit card to get started</p>
              </div>
            ) : (
              cards.map(card => (
                <div key={card.id} className={`credit-card-item card ${card.status === 'inactive' ? 'inactive' : ''}`}>
                  <div className="card-visual">
                    <div className="card-chip"></div>
                    <div className="card-number">
                      <span>••••</span>
                      <span>••••</span>
                      <span>••••</span>
                      <span>{card.last_four_digits}</span>
                    </div>
                    <div className="card-brand">
                      <i className="fab fa-cc-visa"></i>
                    </div>
                  </div>
                  
                  <div className="card-details">
                    <div className="card-info">
                      <span className="card-label">Card ending in</span>
                      <span className="card-digits">**** {card.last_four_digits}</span>
                    </div>
                    {card.description && (
                      <div className="card-description">{card.description}</div>
                    )}
                    <div className="card-meta">
                      <span className={`status-badge ${card.status}`}>{card.status}</span>
                      <span className="expense-count">
                        <i className="fas fa-receipt"></i> {card.expense_count} expenses
                      </span>
                    </div>
                  </div>

                  <div className="card-actions">
                    <button className="btn-icon" onClick={() => openModal('edit', card)} title="Edit">
                      <i className="fas fa-edit"></i>
                    </button>
                    <button className="btn-icon delete" onClick={() => handleDelete(card)} title="Delete">
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal credit-card-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modalMode === 'create' ? 'Add Credit Card' : 'Edit Credit Card'}</h2>
              <button className="btn-icon" onClick={closeModal}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            {formError && <div className="form-error">{formError}</div>}

            <form onSubmit={handleSubmit} className="credit-card-form">
              <div className="form-group">
                <label>Last 4 Digits *</label>
                <div className="digits-input">
                  <span className="prefix">**** **** ****</span>
                  <input
                    type="text"
                    name="last_four_digits"
                    value={formData.last_four_digits}
                    onChange={handleInputChange}
                    placeholder="0000"
                    maxLength={4}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="e.g., Company Visa, Marketing Card"
                />
              </div>

              <div className="form-group">
                <label>Status</label>
                <select name="status" value={formData.status} onChange={handleInputChange}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary">
                  {modalMode === 'create' ? 'Add Card' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CreditCardManagement
