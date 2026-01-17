"""Sync

Revision ID: 459d54f789bf
Revises: 
Create Date: 2026-01-18 00:48:27.867118

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '459d54f789bf'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Only adding the missing profile_pic column
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.add_column(sa.Column('profile_pic', sa.String(length=255), nullable=True))


def downgrade():
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.drop_column('profile_pic')
