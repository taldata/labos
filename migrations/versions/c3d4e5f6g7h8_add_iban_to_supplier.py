"""Add IBAN field to supplier

Revision ID: c3d4e5f6g7h8
Revises: 2351dde2b346
Create Date: 2026-02-16

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c3d4e5f6g7h8'
down_revision = '2351dde2b346'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('supplier', schema=None) as batch_op:
        batch_op.add_column(sa.Column('iban', sa.String(length=34), nullable=True))


def downgrade():
    with op.batch_alter_table('supplier', schema=None) as batch_op:
        batch_op.drop_column('iban')
