-- Add external accounting entry tracking fields to expense table
ALTER TABLE expense 
ADD COLUMN external_accounting_entry BOOLEAN DEFAULT FALSE,
ADD COLUMN external_accounting_entry_by_id INTEGER REFERENCES "user"(id),
ADD COLUMN external_accounting_entry_at TIMESTAMP;

-- Add comment to document the purpose of these fields
COMMENT ON COLUMN expense.external_accounting_entry IS 'Indicates if this expense was entered in external accounting system';
COMMENT ON COLUMN expense.external_accounting_entry_by_id IS 'ID of the accounting user who marked this as entered in external system';
COMMENT ON COLUMN expense.external_accounting_entry_at IS 'Timestamp when the expense was marked as entered in external accounting system'; 