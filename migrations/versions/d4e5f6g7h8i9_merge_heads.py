"""Merge migration branches

Revision ID: d4e5f6g7h8i9
Revises: b2c3d4e5f6g7, f831eb5c8b3a
Create Date: 2026-02-16

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd4e5f6g7h8i9'
down_revision = ('b2c3d4e5f6g7', 'f831eb5c8b3a')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
