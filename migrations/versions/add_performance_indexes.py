"""Add performance indexes for N+1 query optimization

Revision ID: add_performance_indexes
Revises: add_budget_years
Create Date: 2026-01-14 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_performance_indexes'
down_revision = 'add_budget_years'
branch_labels = None
depends_on = None


def upgrade():
    # Add indexes for expenses table - critical for query performance
    op.create_index('idx_expenses_status', 'expenses', ['status'], unique=False)
    op.create_index('idx_expenses_user_id', 'expenses', ['user_id'], unique=False)
    op.create_index('idx_expenses_date', 'expenses', ['date'], unique=False)
    op.create_index('idx_expenses_subcategory_id', 'expenses', ['subcategory_id'], unique=False)
    op.create_index('idx_expenses_supplier_id', 'expenses', ['supplier_id'], unique=False)
    op.create_index('idx_expenses_credit_card_id', 'expenses', ['credit_card_id'], unique=False)

    # Add composite index for common query patterns
    op.create_index('idx_expenses_user_status', 'expenses', ['user_id', 'status'], unique=False)
    op.create_index('idx_expenses_status_date', 'expenses', ['status', 'date'], unique=False)

    # Add indexes for foreign key relationships
    op.create_index('idx_users_department_id', 'users', ['department_id'], unique=False)
    op.create_index('idx_subcategories_category_id', 'subcategories', ['category_id'], unique=False)
    op.create_index('idx_categories_department_id', 'categories', ['department_id'], unique=False)

    # Add indexes for search queries
    op.create_index('idx_users_username', 'users', ['username'], unique=False)
    op.create_index('idx_users_email', 'users', ['email'], unique=False)
    op.create_index('idx_suppliers_name', 'suppliers', ['name'], unique=False)


def downgrade():
    # Remove all indexes in reverse order
    op.drop_index('idx_suppliers_name', table_name='suppliers')
    op.drop_index('idx_users_email', table_name='users')
    op.drop_index('idx_users_username', table_name='users')

    op.drop_index('idx_categories_department_id', table_name='categories')
    op.drop_index('idx_subcategories_category_id', table_name='subcategories')
    op.drop_index('idx_users_department_id', table_name='users')

    op.drop_index('idx_expenses_status_date', table_name='expenses')
    op.drop_index('idx_expenses_user_status', table_name='expenses')

    op.drop_index('idx_expenses_credit_card_id', table_name='expenses')
    op.drop_index('idx_expenses_supplier_id', table_name='expenses')
    op.drop_index('idx_expenses_subcategory_id', table_name='expenses')
    op.drop_index('idx_expenses_date', table_name='expenses')
    op.drop_index('idx_expenses_user_id', table_name='expenses')
    op.drop_index('idx_expenses_status', table_name='expenses')
