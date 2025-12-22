import { useState, useEffect } from 'react'
import { Modal, Select, Button } from './ui'
import './MoveExpenseToYearModal.css'

function MoveExpenseToYearModal({ isOpen, onClose, expense, onSuccess }) {
  const [budgetYears, setBudgetYears] = useState([])
  const [selectedYearId, setSelectedYearId] = useState('')
  const [moveOptions, setMoveOptions] = useState(null)
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [error, setError] = useState('')

  // Fetch budget years on mount
  useEffect(() => {
    if (isOpen) {
      fetchBudgetYears()
    }
  }, [isOpen])

  // Fetch move options when year is selected
  useEffect(() => {
    if (selectedYearId && expense) {
      fetchMoveOptions()
    }
  }, [selectedYearId])

  const fetchBudgetYears = async () => {
    try {
      const response = await fetch('/api/v1/organization/years', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setBudgetYears(data.years)
      } else {
        setError('Failed to load budget years')
      }
    } catch (err) {
      setError('Error loading budget years')
      console.error(err)
    }
  }

  const fetchMoveOptions = async () => {
    setLoadingOptions(true)
    setError('')
    setMoveOptions(null)
    setSelectedSubcategoryId('')

    try {
      const response = await fetch(
        `/api/v1/admin/expenses/${expense.id}/move-options/${selectedYearId}`,
        { credentials: 'include' }
      )

      if (response.ok) {
        const data = await response.json()
        setMoveOptions(data)

        // Auto-select exact match if found
        if (data.exact_match) {
          setSelectedSubcategoryId(data.exact_match.subcategory_id.toString())
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to load move options')
      }
    } catch (err) {
      setError('Error loading move options')
      console.error(err)
    } finally {
      setLoadingOptions(false)
    }
  }

  const handleMove = async () => {
    if (!selectedSubcategoryId) {
      setError('Please select a target subcategory')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(
        `/api/v1/admin/expenses/${expense.id}/move-to-year`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            target_subcategory_id: parseInt(selectedSubcategoryId)
          })
        }
      )

      if (response.ok) {
        const data = await response.json()
        onSuccess(data)
        handleClose()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to move expense')
      }
    } catch (err) {
      setError('Error moving expense')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSelectedYearId('')
    setMoveOptions(null)
    setSelectedSubcategoryId('')
    setError('')
    onClose()
  }

  if (!expense) return null

  // Filter out current year from available years
  const availableYears = budgetYears.filter(
    year => moveOptions?.current?.budget_year?.id !== year.id
  )

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="העבר הוצאה לשנת תקציב אחרת" size="medium">
      <div className="move-expense-modal">
        {/* Current Location Info */}
        {moveOptions && (
          <div className="current-location">
            <h3>מיקום נוכחי:</h3>
            <div className="location-path">
              <span className="location-badge year">{moveOptions.current.budget_year.name}</span>
              <i className="fas fa-chevron-left"></i>
              <span className="location-badge dept">{moveOptions.current.department.name}</span>
              <i className="fas fa-chevron-left"></i>
              <span className="location-badge cat">{moveOptions.current.category.name}</span>
              <i className="fas fa-chevron-left"></i>
              <span className="location-badge sub">{moveOptions.current.subcategory.name}</span>
            </div>
          </div>
        )}

        {/* Select Target Year */}
        <div className="form-group">
          <label>בחר שנת יעד:</label>
          <Select
            value={selectedYearId}
            onChange={(e) => setSelectedYearId(e.target.value)}
            disabled={loading || loadingOptions}
          >
            <option value="">-- בחר שנת תקציב --</option>
            {availableYears.map(year => (
              <option key={year.id} value={year.id}>
                {year.name || year.year} {year.is_current ? '(שוטפת)' : ''}
              </option>
            ))}
          </Select>
        </div>

        {/* Loading Options */}
        {loadingOptions && (
          <div className="loading-options">
            <i className="fas fa-spinner fa-spin"></i>
            <span>טוען אפשרויות...</span>
          </div>
        )}

        {/* Exact Match Notification */}
        {moveOptions?.exact_match && (
          <div className="exact-match-info">
            <i className="fas fa-check-circle"></i>
            <div>
              <strong>נמצאה התאמה מדויקת!</strong>
              <p>
                {moveOptions.exact_match.department_name} &gt; {moveOptions.exact_match.category_name} &gt; {moveOptions.exact_match.subcategory_name}
              </p>
            </div>
          </div>
        )}

        {/* No Exact Match - Manual Selection */}
        {moveOptions && !moveOptions.exact_match && moveOptions.suggestions.length > 0 && (
          <div className="no-match-info">
            <i className="fas fa-info-circle"></i>
            <span>לא נמצאה התאמה מדויקת. אנא בחר תת-קטגוריה ידנית:</span>
          </div>
        )}

        {/* Subcategory Selection */}
        {moveOptions && moveOptions.suggestions.length > 0 && (
          <div className="form-group">
            <label>בחר תת-קטגוריה ביעד:</label>
            <Select
              value={selectedSubcategoryId}
              onChange={(e) => setSelectedSubcategoryId(e.target.value)}
              disabled={loading}
            >
              <option value="">-- בחר תת-קטגוריה --</option>
              {moveOptions.suggestions.map(suggestion => (
                <option key={suggestion.subcategory_id} value={suggestion.subcategory_id}>
                  {suggestion.full_path}
                </option>
              ))}
            </Select>
          </div>
        )}

        {/* No Suggestions Available */}
        {moveOptions && moveOptions.suggestions.length === 0 && (
          <div className="error-message">
            <i className="fas fa-exclamation-triangle"></i>
            <span>לא נמצאו תת-קטגוריות זמינות בשנת היעד</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="error-message">
            <i className="fas fa-exclamation-circle"></i>
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="modal-actions">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          >
            ביטול
          </Button>
          <Button
            variant="primary"
            onClick={handleMove}
            disabled={!selectedSubcategoryId || loading || loadingOptions}
            loading={loading}
          >
            העבר הוצאה
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default MoveExpenseToYearModal
