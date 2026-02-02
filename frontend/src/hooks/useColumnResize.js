import { useState, useCallback, useEffect, useRef } from 'react'

/**
 * Hook for resizable table columns with localStorage persistence.
 *
 * @param {string} tableId - Unique ID for localStorage key
 * @param {Object} defaultWidths - Map of column key to default width in px, e.g. { date: 110, name: 180 }
 * @returns {{ columnWidths, onResizeStart, resetWidths }}
 */
export function useColumnResize(tableId, defaultWidths) {
  const storageKey = `table-col-widths:${tableId}`

  const [columnWidths, setColumnWidths] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Merge with defaults in case new columns were added
        return { ...defaultWidths, ...parsed }
      }
    } catch {}
    return { ...defaultWidths }
  })

  const dragState = useRef(null)

  // Persist to localStorage whenever widths change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(columnWidths))
    } catch {}
  }, [columnWidths, storageKey])

  const onResizeStart = useCallback((columnKey, e) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = columnWidths[columnKey] || defaultWidths[columnKey] || 100

    const onMouseMove = (moveEvent) => {
      const diff = moveEvent.clientX - startX
      const newWidth = Math.max(40, startWidth + diff)
      setColumnWidths(prev => ({ ...prev, [columnKey]: newWidth }))
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      dragState.current = null
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    dragState.current = { columnKey }
  }, [columnWidths, defaultWidths])

  const resetWidths = useCallback(() => {
    setColumnWidths({ ...defaultWidths })
    try { localStorage.removeItem(storageKey) } catch {}
  }, [defaultWidths, storageKey])

  return { columnWidths, onResizeStart, resetWidths }
}
