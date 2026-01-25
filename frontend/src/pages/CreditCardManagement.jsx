import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Input, Select, Modal, Badge, Skeleton, useToast, PageHeader } from '../components/ui'
import { useScrollToItem } from '../hooks/useScrollToItem'
import './CreditCardManagement.css'

function CreditCardManagement({ user, setUser }) {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const [loading, setLoading] = useState(true)
  const [cards, setCards] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [newCardId, setNewCardId] = useState(null)

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

  // Delete confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [cardToDelete, setCardToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Auto-scroll to newly created credit card
  const { getItemRef } = useScrollToItem(cards, newCardId, () => setNewCardId(null))

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
      } else {
        showError('Failed to load credit cards')
      }
    } catch (err) {
      showError('Failed to load credit cards')
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

      const data = await res.json()
      if (res.ok) {
        success(modalMode === 'create' ? 'Credit card added successfully' : 'Credit card updated successfully')
        closeModal()
        // Store the new card ID for auto-scroll
        if (modalMode === 'create' && data.credit_card?.id) {
          setNewCardId(data.credit_card.id)
        }
        fetchCards()
      } else {
        setFormError(data.error || 'Operation failed')
      }
    } catch (err) {
      setFormError('An error occurred')
    }
  }

  const openDeleteModal = (card) => {
    setCardToDelete(card)
    setDeleteModalOpen(true)
  }

  const closeDeleteModal = () => {
    setDeleteModalOpen(false)
    setCardToDelete(null)
  }

  const handleDelete = async () => {
    if (!cardToDelete) return

    try {
      setDeleting(true)
      const res = await fetch(`/api/v1/admin/credit-cards/${cardToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (res.ok) {
        success('Credit card deleted successfully')
        closeDeleteModal()
        fetchCards()
      } else {
        const data = await res.json()
        showError(data.error || 'Failed to delete')
      }
    } catch (err) {
      showError('An error occurred')
    } finally {
      setDeleting(false)
    }
  }

  if (!user?.is_admin) return null

  return (
    <div className="credit-card-management-container">

      <main className="credit-card-management-main">
        <PageHeader
          title="Credit Card Management"
          subtitle="Manage company credit cards"
          icon="fas fa-credit-card"
          variant="green"
          actions={
            <Button variant="primary" icon="fas fa-plus" onClick={() => openModal('create')}>
              Add Card
            </Button>
          }
        />

        {/* Filters */}
        <Card className="filters-section">
          <Card.Body>
            <div className="filter-label">
              <i className="fas fa-filter"></i> Filter by status:
            </div>
            <div className="filter-buttons">
              <Button
                variant={statusFilter === 'all' ? 'primary' : 'ghost'}
                size="small"
                onClick={() => setStatusFilter('all')}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'active' ? 'primary' : 'ghost'}
                size="small"
                onClick={() => setStatusFilter('active')}
              >
                Active
              </Button>
              <Button
                variant={statusFilter === 'inactive' ? 'primary' : 'ghost'}
                size="small"
                onClick={() => setStatusFilter('inactive')}
              >
                Inactive
              </Button>
            </div>
          </Card.Body>
        </Card>

        {/* Cards Grid */}
        {loading ? (
          <div className="cards-grid">
            <Card><Card.Body><Skeleton variant="text" count={5} /></Card.Body></Card>
            <Card><Card.Body><Skeleton variant="text" count={5} /></Card.Body></Card>
            <Card><Card.Body><Skeleton variant="text" count={5} /></Card.Body></Card>
          </div>
        ) : (
          <div className="cards-grid">
            {cards.length === 0 ? (
              <Card className="empty-state">
                <Card.Body>
                  <i className="fas fa-credit-card"></i>
                  <h3>No credit cards found</h3>
                  <p>Add your first credit card to get started</p>
                </Card.Body>
              </Card>
            ) : (
              cards.map(card => (
                <Card
                  key={card.id}
                  ref={getItemRef(card.id)}
                  data-item-id={card.id}
                  className={`credit-card-item ${card.status === 'inactive' ? 'inactive' : ''}`}
                >
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
                      <Badge variant={card.status === 'active' ? 'success' : 'danger'}>
                        {card.status}
                      </Badge>
                      <span className="expense-count">
                        <i className="fas fa-receipt"></i> {card.expense_count} expenses
                      </span>
                    </div>
                  </div>

                  <div className="card-actions">
                    <Button variant="ghost" size="small" icon="fas fa-edit" onClick={() => openModal('edit', card)} title="Edit" />
                    <Button variant="ghost" size="small" icon="fas fa-trash" onClick={() => openDeleteModal(card)} title="Delete" className="btn-delete" />
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </main>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={modalMode === 'create' ? 'Add Credit Card' : 'Edit Credit Card'}
        size="small"
      >
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

          <Input
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="e.g., Company Visa, Marketing Card"
          />

          <Select
            label="Status"
            name="status"
            value={formData.status}
            onChange={handleInputChange}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {modalMode === 'create' ? 'Add Card' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        title="Delete Credit Card"
        size="small"
      >
        <div className="delete-modal-content">
          <div className="delete-modal-icon">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <p className="delete-modal-message">
            Are you sure you want to delete this credit card?
          </p>
          {cardToDelete && (
            <div className="delete-modal-summary">
              <p><strong>Card:</strong> **** **** **** {cardToDelete.last_four_digits}</p>
              {cardToDelete.description && (
                <p><strong>Description:</strong> {cardToDelete.description}</p>
              )}
              {cardToDelete.expense_count > 0 && (
                <p className="delete-modal-warning">
                  <i className="fas fa-info-circle"></i>
                  This card has {cardToDelete.expense_count} associated expenses.
                </p>
              )}
            </div>
          )}
          <p className="delete-modal-warning-text">
            This action cannot be undone.
          </p>
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={closeDeleteModal} disabled={deleting}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
              Delete Card
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default CreditCardManagement
