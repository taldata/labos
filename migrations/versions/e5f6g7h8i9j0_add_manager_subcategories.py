"""Add manager_subcategories table for cross-department subcategory access

Revision ID: e5f6g7h8i9j0
Revises: d4e5f6g7h8i9
Create Date: 2026-03-04

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'e5f6g7h8i9j0'
down_revision = 'd4e5f6g7h8i9'
branch_labels = None
depends_on = None


def upgrade():
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)

    if 'manager_subcategories' not in inspector.get_table_names():
        op.create_table('manager_subcategories',
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id'), primary_key=True),
            sa.Column('subcategory_id', sa.Integer(), sa.ForeignKey('subcategory.id'), primary_key=True)
        )


def downgrade():
    op.drop_table('manager_subcategories')
