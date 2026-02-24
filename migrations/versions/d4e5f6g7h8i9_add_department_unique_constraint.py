"""Add unique constraint on department (name, year_id) and migrate-users support

Revision ID: d4e5f6g7h8i9
Revises: c3d4e5f6g7h8
Create Date: 2026-02-24

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd4e5f6g7h8i9'
down_revision = 'c3d4e5f6g7h8'
branch_labels = None
depends_on = None


def upgrade():
    # First, clean up any existing duplicates within the same year
    # Keep the one with the lowest ID (oldest)
    conn = op.get_bind()
    conn.execute(sa.text("""
        DELETE FROM department
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM department
            GROUP BY name, year_id
        )
        AND id NOT IN (
            SELECT DISTINCT department_id FROM category
        )
        AND id NOT IN (
            SELECT DISTINCT department_id FROM "user" WHERE department_id IS NOT NULL
        )
        AND id NOT IN (
            SELECT DISTINCT department_id FROM manager_departments
        )
    """))

    # Add unique constraint
    with op.batch_alter_table('department', schema=None) as batch_op:
        batch_op.create_unique_constraint('uq_department_name_year', ['name', 'year_id'])


def downgrade():
    with op.batch_alter_table('department', schema=None) as batch_op:
        batch_op.drop_constraint('uq_department_name_year', type_='unique')
