"""Add manager_categories table for cross-department category access

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-05

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6g7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)

    if 'manager_categories' not in inspector.get_table_names():
        op.create_table('manager_categories',
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id'), primary_key=True),
            sa.Column('category_id', sa.Integer(), sa.ForeignKey('category.id'), primary_key=True)
        )


def downgrade():
    op.drop_table('manager_categories')
