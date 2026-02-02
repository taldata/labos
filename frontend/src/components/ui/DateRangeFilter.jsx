import React, { useState, useCallback, useEffect } from 'react'
import { Select, Input, Button } from './index'

// Compute start_date and end_date (as DD/MM/YYYY) for a given period
function computeDateRange(period) {
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth() // 0-based
  let start, end

  switch (period) {
    case 'this_month':
      start = new Date(y, m, 1)
      end = today
      break
    case 'last_month': {
      const lm = m === 0 ? 11 : m - 1
      const ly = m === 0 ? y - 1 : y
      start = new Date(ly, lm, 1)
      end = new Date(ly, lm + 1, 0) // last day of last month
      break
    }
    case 'this_quarter': {
      const qStart = Math.floor(m / 3) * 3
      start = new Date(y, qStart, 1)
      end = today
      break
    }
    case 'this_year':
      start = new Date(y, 0, 1)
      end = today
      break
    case 'last_year':
      start = new Date(y - 1, 0, 1)
      end = new Date(y - 1, 11, 31)
      break
    case 'last_6_months': {
      start = new Date(y, m - 6, today.getDate())
      end = today
      break
    }
    default:
      return null // custom or unknown
  }

  return {
    start_date: formatDate(start),
    end_date: formatDate(end)
  }
}

function formatDate(d) {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

const DateRangeFilter = ({ filters, setFilters, style }) => {
  const [timePeriod, setTimePeriod] = useState('all')

  // On mount, if filters already have dates set, default to custom
  const [initialized, setInitialized] = useState(false)
  useEffect(() => {
    if (!initialized) {
      setInitialized(true)
      if (filters.start_date || filters.end_date) {
        setTimePeriod('custom')
      }
      // Default is 'all' — no date filtering applied
    }
  }, [initialized, filters.start_date, filters.end_date, setFilters])

  const handlePeriodChange = useCallback((e) => {
    const period = e.target.value
    setTimePeriod(period)

    if (period === 'all') {
      setFilters(prev => ({ ...prev, start_date: '', end_date: '' }))
      return
    }

    if (period === 'custom') {
      // Don't clear dates - let user set them manually
      return
    }

    const range = computeDateRange(period)
    if (range) {
      setFilters(prev => ({ ...prev, ...range }))
    }
  }, [setFilters])

  const handleDateChange = useCallback((e) => {
    const { name, value } = e.target
    setFilters(prev => ({ ...prev, [name]: value }))
  }, [setFilters])

  return (
    <div style={{ display: 'contents', ...style }}>
      <Select
        label="Time Period"
        name="time_period"
        value={timePeriod}
        onChange={handlePeriodChange}
      >
        <option value="all">All Dates</option>
        <option value="this_month">This Month</option>
        <option value="last_month">Last Month</option>
        <option value="this_quarter">This Quarter</option>
        <option value="this_year">This Year</option>
        <option value="last_year">Last Year</option>
        <option value="last_6_months">Last 6 Months</option>
        <option value="custom">Custom Date Range</option>
      </Select>

      {timePeriod === 'custom' && (
        <>
          <Input
            type="text"
            label="Start Date"
            name="start_date"
            value={filters.start_date}
            onChange={handleDateChange}
            placeholder="DD/MM/YYYY"
            pattern="\d{2}/\d{2}/\d{4}"
          />
          <Input
            type="text"
            label="End Date"
            name="end_date"
            value={filters.end_date}
            onChange={handleDateChange}
            placeholder="DD/MM/YYYY"
            pattern="\d{2}/\d{2}/\d{4}"
          />
        </>
      )}
    </div>
  )
}

export default DateRangeFilter
