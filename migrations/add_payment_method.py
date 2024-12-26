from alembic import op
import sqlalchemy as sa

def upgrade():
    op.add_column('expense', sa.Column('payment_method', sa.String(50), nullable=True, server_default='credit'))

def downgrade():
    op.drop_column('expense', 'payment_method')
