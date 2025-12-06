import { useState } from 'react'
import PropTypes from 'prop-types'
import './BudgetImpactWidget.css'

function BudgetImpactWidget({ budgetData, expenseAmount, compact = false }) {
    const [expandedTiers, setExpandedTiers] = useState({
        department: false,
        category: false,
        subcategory: false
    })

    if (!budgetData || Object.keys(budgetData).length === 0) {
        return null
    }

    const toggleTier = (tier) => {
        setExpandedTiers(prev => ({
            ...prev,
            [tier]: !prev[tier]
        }))
    }

    const getUsageColor = (usagePercent) => {
        if (usagePercent >= 90) return 'danger'
        if (usagePercent >= 75) return 'warning'
        return 'success'
    }

    const renderBudgetTier = (tier, data) => {
        if (!data) return null

        const isExpanded = expandedTiers[tier]
        const usageColor = getUsageColor(data.usage_percent_after)
        const willExceed = data.will_exceed

        return (
            <div
                key={tier}
                className={`budget-tier ${isExpanded ? 'expanded' : 'collapsed'} ${willExceed ? 'exceeds' : ''}`}
                onClick={() => toggleTier(tier)}
            >
                <div className="budget-tier-preview">
                    <div className="tier-header">
                        <span className="tier-name">{data.name}</span>
                        {willExceed && (
                            <span className="warning-badge">
                                <i className="fas fa-exclamation-triangle"></i>
                                Will Exceed
                            </span>
                        )}
                        <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'} toggle-icon`}></i>
                    </div>

                    <div className="budget-bar">
                        <div
                            className={`budget-progress ${usageColor}`}
                            style={{ width: `${Math.min(data.usage_percent_after, 100)}%` }}
                        >
                            <span className="progress-label">
                                {data.usage_percent_after}%
                            </span>
                        </div>
                    </div>

                    <div className="budget-summary">
                        <span className="remaining-amount">
                            ₪{data.remaining_after.toLocaleString()} remaining
                        </span>
                    </div>
                </div>

                {isExpanded && (
                    <div className="budget-tier-details">
                        <div className="detail-row">
                            <span className="detail-label">Initial Budget:</span>
                            <span className="detail-value">₪{data.budget.toLocaleString()}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Already Used:</span>
                            <span className="detail-value">₪{data.used.toLocaleString()}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Before Approval:</span>
                            <span className="detail-value">
                                ₪{data.remaining_before.toLocaleString()} ({data.usage_percent_before}%)
                            </span>
                        </div>
                        <div className="detail-row highlight">
                            <span className="detail-label">After Approval:</span>
                            <span className={`detail-value ${willExceed ? 'danger-text' : ''}`}>
                                ₪{data.remaining_after.toLocaleString()} ({data.usage_percent_after}%)
                            </span>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className={`budget-impact-widget ${compact ? 'compact' : ''}`}>
            <div className="widget-header">
                <i className="fas fa-chart-pie"></i>
                <span>Budget Impact</span>
            </div>

            <div className="budget-tiers">
                {renderBudgetTier('department', budgetData.department)}
                {renderBudgetTier('category', budgetData.category)}
                {renderBudgetTier('subcategory', budgetData.subcategory)}
            </div>

            {(budgetData.department?.will_exceed || budgetData.category?.will_exceed || budgetData.subcategory?.will_exceed) && (
                <div className="budget-warning">
                    <i className="fas fa-exclamation-circle"></i>
                    <span>Approving this expense will exceed one or more budgets</span>
                </div>
            )}
        </div>
    )
}

BudgetImpactWidget.propTypes = {
    budgetData: PropTypes.shape({
        department: PropTypes.shape({
            id: PropTypes.number,
            name: PropTypes.string,
            budget: PropTypes.number,
            used: PropTypes.number,
            remaining_before: PropTypes.number,
            remaining_after: PropTypes.number,
            usage_percent_before: PropTypes.number,
            usage_percent_after: PropTypes.number,
            will_exceed: PropTypes.bool
        }),
        category: PropTypes.shape({
            id: PropTypes.number,
            name: PropTypes.string,
            budget: PropTypes.number,
            used: PropTypes.number,
            remaining_before: PropTypes.number,
            remaining_after: PropTypes.number,
            usage_percent_before: PropTypes.number,
            usage_percent_after: PropTypes.number,
            will_exceed: PropTypes.bool
        }),
        subcategory: PropTypes.shape({
            id: PropTypes.number,
            name: PropTypes.string,
            budget: PropTypes.number,
            used: PropTypes.number,
            remaining_before: PropTypes.number,
            remaining_after: PropTypes.number,
            usage_percent_before: PropTypes.number,
            usage_percent_after: PropTypes.number,
            will_exceed: PropTypes.bool
        })
    }),
    expenseAmount: PropTypes.number,
    compact: PropTypes.bool
}

export default BudgetImpactWidget
