
import React from 'react';
import { Button, Badge, Skeleton, EmptyState, FilePreviewButton } from '../../../components/ui';

const ExpenseList = ({ 
  expenses, 
  loading, 
  error, 
  user,
  onDelete, 
  onView,
  pagination,
  onPageChange
}) => {
  
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    // Use consistent date formatting
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'ILS'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="me-list-card" style={{ padding: '2rem' }}>
        <Skeleton.Table rows={5} columns={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="me-error">
        <i className="fas fa-exclamation-circle"></i>
        {error}
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="me-list-card">
        <EmptyState
          icon="fas fa-inbox"
          title="No expenses found"
          description="Try adjusting your filters or create a new expense."
        />
      </div>
    );
  }

  return (
    <div className="me-list-card me-animate-fade">
      {/* Desktop Table View */}
      <div className="me-table-wrapper">
        <table className="me-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'center' }}>Files</th>
              {(user?.is_manager || user?.is_admin) && (
                <th style={{ textAlign: 'center' }}>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr 
                key={expense.id} 
                onClick={() => onView(expense.id)} 
                style={{ cursor: 'pointer' }}
              >
                <td className="me-cell-date">{formatDate(expense.date)}</td>
                <td>
                  <span className="me-cell-desc-title">{expense.description || 'No description'}</span>
                  {expense.reason && <span className="me-cell-desc-reason">{expense.reason}</span>}
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {expense.category?.name && (
                       <Badge variant="default" size="small">{expense.category.name}</Badge>
                    )}
                    {expense.subcategory?.name && (
                       <span style={{ fontSize: '0.75rem', color: 'var(--me-text-sub)' }}>{expense.subcategory.name}</span>
                    )}
                  </div>
                </td>
                <td className="me-cell-amount" style={{ textAlign: 'right' }}>
                  {formatCurrency(expense.amount, expense.currency)}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`me-badge ${expense.status}`}>
                    {expense.status}
                  </span>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="me-cell-files">
                    {expense.invoice_filename && (
                      <div className="me-file-item">
                        <FilePreviewButton
                          fileUrl={`/download/${expense.invoice_filename}`}
                          fileName={expense.invoice_filename}
                          icon="fas fa-file-invoice-dollar"
                          title="Invoice"
                          variant="ghost"
                        />
                        <span className="me-file-label">חשבונית</span>
                      </div>
                    )}
                    {expense.receipt_filename && (
                      <div className="me-file-item">
                        <FilePreviewButton
                          fileUrl={`/download/${expense.receipt_filename}`}
                          fileName={expense.receipt_filename}
                          icon="fas fa-receipt"
                          title="Receipt"
                          variant="ghost"
                        />
                        <span className="me-file-label">קבלה</span>
                      </div>
                    )}
                    {expense.quote_filename && (
                      <div className="me-file-item">
                        <FilePreviewButton
                          fileUrl={`/download/${expense.quote_filename}`}
                          fileName={expense.quote_filename}
                          icon="fas fa-file-alt"
                          title="Quote"
                          variant="ghost"
                        />
                        <span className="me-file-label">הצעה</span>
                      </div>
                    )}
                    {!expense.invoice_filename && !expense.receipt_filename && !expense.quote_filename && (
                      <span style={{ color: 'var(--me-text-sub)', opacity: 0.3 }}>-</span>
                    )}
                  </div>
                </td>
                {(user?.is_manager || user?.is_admin) && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="me-cell-actions">
                      <Button
                        variant="ghost"
                        size="small"
                        icon="fas fa-trash"
                        onClick={(e) => onDelete(e, expense)}
                        title="Delete"
                        className="text-red-500 hover:bg-red-50"
                      />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View (Hidden on desktop via CSS) */}
      <div className="me-mobile-only">
         {/* implemented in styles.css with media queries to show/hide */}
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="me-pagination">
          <Button
            variant="secondary"
            size="small"
            icon="fas fa-chevron-left"
            onClick={() => onPageChange(pagination.current - 1)}
            disabled={pagination.current === 1}
          >
            Previous
          </Button>

          <span style={{ fontSize: '0.9rem', color: 'var(--me-text-sub)' }}>
            Page <strong>{pagination.current}</strong> of <strong>{pagination.pages}</strong>
          </span>

          <Button
            variant="secondary"
            size="small"
            iconPosition="right"
            icon="fas fa-chevron-right"
            onClick={() => onPageChange(pagination.current + 1)}
            disabled={pagination.current === pagination.pages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default ExpenseList;
