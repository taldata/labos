"""Add submit_date to expense

Revision ID: 2351dde2b346
Revises: 459d54f789bf
Create Date: 2026-01-27

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '2351dde2b346'
down_revision = '459d54f789bf'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('expense', schema=None) as batch_op:
        batch_op.add_column(sa.Column('submit_date', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('expense', schema=None) as batch_op:
        batch_op.drop_column('submit_date')
