"""Replace is_admin/is_manager/is_accounting/is_hr boolean flags with single role column

Revision ID: c1d2e3f4g5h6
Revises: f831eb5c8b3a
Create Date: 2026-02-16

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c1d2e3f4g5h6'
down_revision = 'f831eb5c8b3a'
branch_labels = None
depends_on = None


def upgrade():
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('user')]

    # Step 1: Add role column if not exists
    if 'role' not in columns:
        with op.batch_alter_table('user', schema=None) as batch_op:
            batch_op.add_column(sa.Column('role', sa.String(20), nullable=True, server_default='user'))

    # Step 2: Populate role from existing boolean flags
    # Priority: admin > manager > accounting > hr > user
    op.execute("UPDATE \"user\" SET role = 'admin' WHERE is_admin = true OR is_admin = 1")
    op.execute("UPDATE \"user\" SET role = 'manager' WHERE (is_manager = true OR is_manager = 1) AND (role IS NULL OR role = 'user')")
    op.execute("UPDATE \"user\" SET role = 'accounting' WHERE (is_accounting = true OR is_accounting = 1) AND (role IS NULL OR role = 'user')")
    op.execute("UPDATE \"user\" SET role = 'hr' WHERE (is_hr = true OR is_hr = 1) AND (role IS NULL OR role = 'user')")
    op.execute("UPDATE \"user\" SET role = 'user' WHERE role IS NULL")

    # Step 3: Make role non-nullable
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.alter_column('role', nullable=False, server_default='user')

    # Step 4: Drop the boolean columns
    with op.batch_alter_table('user', schema=None) as batch_op:
        if 'is_admin' in columns:
            batch_op.drop_column('is_admin')
        if 'is_manager' in columns:
            batch_op.drop_column('is_manager')
        if 'is_accounting' in columns:
            batch_op.drop_column('is_accounting')
        if 'is_hr' in columns:
            batch_op.drop_column('is_hr')


def downgrade():
    # Re-create boolean columns from role
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_admin', sa.Boolean(), nullable=True, server_default='0'))
        batch_op.add_column(sa.Column('is_manager', sa.Boolean(), nullable=True, server_default='0'))
        batch_op.add_column(sa.Column('is_accounting', sa.Boolean(), nullable=True, server_default='0'))
        batch_op.add_column(sa.Column('is_hr', sa.Boolean(), nullable=True, server_default='0'))

    # Populate boolean flags from role
    op.execute("UPDATE \"user\" SET is_admin = 1 WHERE role = 'admin'")
    op.execute("UPDATE \"user\" SET is_manager = 1 WHERE role = 'manager'")
    op.execute("UPDATE \"user\" SET is_accounting = 1 WHERE role = 'accounting'")
    op.execute("UPDATE \"user\" SET is_hr = 1 WHERE role = 'hr'")

    # Drop role column
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.drop_column('role')
