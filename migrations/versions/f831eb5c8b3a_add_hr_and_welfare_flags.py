"""Add is_hr to user and is_welfare to category

Revision ID: f831eb5c8b3a
Revises: a1b2c3d4e5f6
Create Date: 2026-02-05

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f831eb5c8b3a'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_hr', sa.Boolean(), nullable=True, server_default='0'))

    with op.batch_alter_table('category', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_welfare', sa.Boolean(), nullable=True, server_default='0'))


def downgrade():
    with op.batch_alter_table('category', schema=None) as batch_op:
        batch_op.drop_column('is_welfare')

    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.drop_column('is_hr')
