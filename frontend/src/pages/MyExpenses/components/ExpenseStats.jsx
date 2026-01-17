
import React from 'react';
import { Card } from '../../../components/ui';

const ExpenseStats = ({ totalExpenses, loading }) => {
  return (
    <div className="me-stats">
      <div className="me-stat-card">
        <span className="me-stat-label">Total Expenses</span>
        <div className="me-stat-value">
          {loading ? '...' : totalExpenses}
        </div>
      </div>
      {/* 
        Future enhancement: Add more stats here like "Pending Approval", "This Month", etc.
        For now, we stick to what was available in the original page to ensure data consistency.
      */}
    </div>
  );
};

export default ExpenseStats;
