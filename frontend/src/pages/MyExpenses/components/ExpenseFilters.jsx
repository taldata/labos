
import React from 'react';
import { Input, Select, Button, DateRangeFilter } from '../../../components/ui';

const ExpenseFilters = ({ 
  filters, 
  setFilters, 
  categories, 
  onClearFilters, 
  isOpen, 
  setIsOpen,
  activeFilterCount 
}) => {
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="me-filters-card">
      <div className="me-filters-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="me-filters-title">
          <i className="fas fa-filter"></i>
          <span>Filters & Search</span>
          {activeFilterCount > 0 && (
            <span className="me-badge pending" style={{fontSize: '0.7rem'}}>
              {activeFilterCount} active
            </span>
          )}
        </div>
        <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`} style={{color: 'var(--me-text-sub)'}}></i>
      </div>

      {activeFilterCount > 0 && (
        <div className="me-active-filters">
          {filters.search && (
            <span className="me-filter-chip">
              Search: "{filters.search}"
              <button onClick={() => setFilters(prev => ({ ...prev, search: '' }))}><i className="fas fa-times"></i></button>
            </span>
          )}
          {filters.status && (
            <span className="me-filter-chip">
              Status: {filters.status.charAt(0).toUpperCase() + filters.status.slice(1)}
              <button onClick={() => setFilters(prev => ({ ...prev, status: '' }))}><i className="fas fa-times"></i></button>
            </span>
          )}
          {filters.category_id && (
            <span className="me-filter-chip">
              Category: {categories.find(c => String(c.id) === String(filters.category_id))?.name || filters.category_id}
              <button onClick={() => setFilters(prev => ({ ...prev, category_id: '' }))}><i className="fas fa-times"></i></button>
            </span>
          )}
          {filters.start_date && (
            <span className="me-filter-chip">
              From: {filters.start_date}
              <button onClick={() => setFilters(prev => ({ ...prev, start_date: '' }))}><i className="fas fa-times"></i></button>
            </span>
          )}
          {filters.end_date && (
            <span className="me-filter-chip">
              To: {filters.end_date}
              <button onClick={() => setFilters(prev => ({ ...prev, end_date: '' }))}><i className="fas fa-times"></i></button>
            </span>
          )}
        </div>
      )}

      {isOpen && (
        <div className="me-filters-body me-animate-fade">
          <div className="me-filters-grid">
            <Input
              label="Search"
              name="search"
              value={filters.search}
              onChange={handleChange}
              placeholder="Description, reason, supplier..."
              icon="fas fa-search"
            />

            <Select
              label="Status"
              name="status"
              value={filters.status}
              onChange={handleChange}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="paid">Paid</option>
            </Select>

            <Select
              label="Category"
              name="category_id"
              value={filters.category_id}
              onChange={handleChange}
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </Select>
            
            <Select
               label="Sort By"
               name="sort_by"
               value={filters.sort_by}
               onChange={handleChange}
            >
               <option value="id">Recently Added</option>
               <option value="date">Date</option>
               <option value="amount">Amount</option>
               <option value="status">Status</option>
            </Select>
          </div>

          <div className="me-filters-grid" style={{ marginTop: '1.5rem' }}>
             <DateRangeFilter filters={filters} setFilters={setFilters} />
             <Select
               label="Order"
               name="sort_order"
               value={filters.sort_order}
               onChange={handleChange}
             >
               <option value="desc">Descending</option>
               <option value="asc">Ascending</option>
             </Select>
          </div>

          <div className="me-filters-footer">
            <Button variant="secondary" icon="fas fa-times" onClick={onClearFilters}>
              Clear Filters
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseFilters;
