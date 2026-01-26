"""Add performance indexes for expense queries

Revision ID: a1b2c3d4e5f6
Revises: 459d54f789bf
Create Date: 2026-01-26

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '459d54f789bf'
branch_labels = None
depends_on = None


def upgrade():
    # Add indexes to improve expense query performance

    # Index on expense date for date range queries
    op.create_index('ix_expense_date', 'expense', ['date'], unique=False)

    # Index on expense status for status filtering
    op.create_index('ix_expense_status', 'expense', ['status'], unique=False)

    # Composite index on user_id + date for user expense history queries
    op.create_index('ix_expense_user_date', 'expense', ['user_id', 'date'], unique=False)

    # Composite index on status + date for admin expense list queries
    op.create_index('ix_expense_status_date', 'expense', ['status', 'date'], unique=False)

    # Index on external_accounting_entry for filtering
    op.create_index('ix_expense_external_accounting', 'expense', ['external_accounting_entry'], unique=False)

    # Index on subcategory_id for category-based queries
    op.create_index('ix_expense_subcategory', 'expense', ['subcategory_id'], unique=False)

    # Index on supplier_id for supplier-based queries
    op.create_index('ix_expense_supplier', 'expense', ['supplier_id'], unique=False)


def downgrade():
    # Remove indexes
    op.drop_index('ix_expense_supplier', table_name='expense')
    op.drop_index('ix_expense_subcategory', table_name='expense')
    op.drop_index('ix_expense_external_accounting', table_name='expense')
    op.drop_index('ix_expense_status_date', table_name='expense')
    op.drop_index('ix_expense_user_date', table_name='expense')
    op.drop_index('ix_expense_status', table_name='expense')
    op.drop_index('ix_expense_date', table_name='expense')
