"""Roll up parent budgets: category = sum of subcategories, department = sum of categories

Revision ID: f6g7h8i9j0k1
Revises: e5f6g7h8i9j0
Create Date: 2026-11-15

Data-only migration. Parents without children keep their current budget.
Every changed value is logged (old -> new) so it can be restored by hand.
"""
from alembic import op
import sqlalchemy as sa
import logging

revision = 'f6g7h8i9j0k1'
down_revision = 'e5f6g7h8i9j0'
branch_labels = None
depends_on = None

log = logging.getLogger('alembic.runtime.migration')

CATEGORY_DIFFS = sa.text("""
    SELECT c.id, d.name AS dept, c.name, c.budget AS old_budget, s.total AS new_budget
    FROM category c
    JOIN department d ON d.id = c.department_id
    JOIN (SELECT category_id, COALESCE(SUM(budget), 0) AS total
          FROM subcategory GROUP BY category_id) s ON s.category_id = c.id
    WHERE ABS(COALESCE(c.budget, 0) - s.total) > 0.005
""")

DEPARTMENT_DIFFS = sa.text("""
    SELECT d.id, d.name, d.budget AS old_budget, c.total AS new_budget
    FROM department d
    JOIN (SELECT department_id, COALESCE(SUM(budget), 0) AS total
          FROM category GROUP BY department_id) c ON c.department_id = d.id
    WHERE ABS(COALESCE(d.budget, 0) - c.total) > 0.005
""")


def upgrade():
    conn = op.get_bind()

    # Categories first, so department totals use the rolled-up category values
    for row in conn.execute(CATEGORY_DIFFS).mappings().all():
        log.info("Budget roll-up: category id=%s %r / %r: %s -> %s",
                 row['id'], row['dept'], row['name'], row['old_budget'], row['new_budget'])
        conn.execute(sa.text("UPDATE category SET budget = :b WHERE id = :id"),
                     {'b': float(row['new_budget']), 'id': row['id']})

    for row in conn.execute(DEPARTMENT_DIFFS).mappings().all():
        log.info("Budget roll-up: department id=%s %r: %s -> %s",
                 row['id'], row['name'], row['old_budget'], row['new_budget'])
        conn.execute(sa.text("UPDATE department SET budget = :b WHERE id = :id"),
                     {'b': float(row['new_budget']), 'id': row['id']})


def downgrade():
    # Previous manual values are only preserved in the upgrade log
    pass
