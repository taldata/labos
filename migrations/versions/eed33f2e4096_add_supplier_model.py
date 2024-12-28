"""add supplier model

Revision ID: eed33f2e4096
Revises: 
Create Date: 2024-12-28 23:01:52.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision = 'eed33f2e4096'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Create supplier table
    op.create_table('supplier',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('address', sa.String(length=500), nullable=True),
        sa.Column('tax_id', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id', name='pk_supplier')
    )

    # Create expense table with supplier_id foreign key
    op.create_table('expense',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('description', sa.String(length=200), nullable=True),
        sa.Column('date', sa.DateTime(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('subcategory_id', sa.Integer(), nullable=False),
        sa.Column('manager_id', sa.Integer(), nullable=True),
        sa.Column('handled_at', sa.DateTime(), nullable=True),
        sa.Column('quote_filename', sa.String(length=255), nullable=True),
        sa.Column('invoice_filename', sa.String(length=255), nullable=True),
        sa.Column('receipt_filename', sa.String(length=255), nullable=True),
        sa.Column('reason', sa.String(length=500), nullable=True),
        sa.Column('type', sa.String(length=50), nullable=False, server_default='needs_approval'),
        sa.Column('rejection_reason', sa.String(length=500), nullable=True),
        sa.Column('is_paid', sa.Boolean(), nullable=True, server_default='0'),
        sa.Column('paid_by_id', sa.Integer(), nullable=True),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
        sa.Column('purchase_date', sa.DateTime(), nullable=True),
        sa.Column('payment_method', sa.String(length=50), nullable=True, server_default='credit'),
        sa.Column('supplier_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['supplier_id'], ['supplier.id'], name='fk_expense_supplier_id'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    # Drop tables in reverse order
    op.drop_table('expense')
    op.drop_table('supplier')
