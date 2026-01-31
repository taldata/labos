"""Add multi-currency support: amount_ils, exchange_rate fields on Expense, ExchangeRateCache table

Revision ID: a1b2c3d4e5f6
Revises: 2351dde2b346
Create Date: 2026-01-30

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '2351dde2b346'
branch_labels = None
depends_on = None


def upgrade():
    # Add amount_ils and exchange_rate columns to expense table (if not already present)
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_columns = [c['name'] for c in inspector.get_columns('expense')]

    with op.batch_alter_table('expense', schema=None) as batch_op:
        if 'amount_ils' not in existing_columns:
            batch_op.add_column(sa.Column('amount_ils', sa.Float(), nullable=True))
        if 'exchange_rate' not in existing_columns:
            batch_op.add_column(sa.Column('exchange_rate', sa.Float(), nullable=True))

    # Create exchange_rate_cache table (if not already created by db.create_all)
    inspector = inspect(conn)
    if 'exchange_rate_cache' not in inspector.get_table_names():
        op.create_table('exchange_rate_cache',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('currency', sa.String(length=3), nullable=False),
            sa.Column('date', sa.Date(), nullable=False),
            sa.Column('rate_to_ils', sa.Float(), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('currency', 'date')
        )

    # Backfill existing expenses: assume all are ILS
    op.execute("UPDATE expense SET amount_ils = amount, exchange_rate = 1.0 WHERE amount_ils IS NULL")


def downgrade():
    op.drop_table('exchange_rate_cache')
    with op.batch_alter_table('expense', schema=None) as batch_op:
        batch_op.drop_column('exchange_rate')
        batch_op.drop_column('amount_ils')
