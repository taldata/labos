"""Fix supplier NULL status values and add server default

Revision ID: d4e5f6g7h8i9
Revises: c3d4e5f6g7h8
Create Date: 2026-02-16

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd4e5f6g7h8i9'
down_revision = 'c3d4e5f6g7h8'
branch_labels = None
depends_on = None


def upgrade():
    # Set all NULL status values to 'active'
    op.execute("UPDATE supplier SET status = 'active' WHERE status IS NULL")

    # Add server default so future inserts always get 'active'
    with op.batch_alter_table('supplier', schema=None) as batch_op:
        batch_op.alter_column('status',
                              existing_type=sa.String(length=20),
                              server_default='active')


def downgrade():
    with op.batch_alter_table('supplier', schema=None) as batch_op:
        batch_op.alter_column('status',
                              existing_type=sa.String(length=20),
                              server_default=None)
