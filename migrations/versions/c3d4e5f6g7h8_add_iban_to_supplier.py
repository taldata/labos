"""Add IBAN field to supplier

Revision ID: c3d4e5f6g7h8
Revises: b2c3d4e5f6g7
Create Date: 2026-02-16

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c3d4e5f6g7h8'
down_revision = 'b2c3d4e5f6g7'
branch_labels = None
depends_on = None


def upgrade():
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)

    supplier_columns = [c['name'] for c in inspector.get_columns('supplier')]
    if 'iban' not in supplier_columns:
        with op.batch_alter_table('supplier', schema=None) as batch_op:
            batch_op.add_column(sa.Column('iban', sa.String(length=34), nullable=True))


def downgrade():
    with op.batch_alter_table('supplier', schema=None) as batch_op:
        batch_op.drop_column('iban')
