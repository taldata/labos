"""Add budget years support

Revision ID: add_budget_years
Revises: 
Create Date: 2025-12-21

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers, used by Alembic.
revision = 'add_budget_years'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Create budget_year table
    op.create_table('budget_year',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(50), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('is_current', sa.Boolean(), nullable=True, default=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('year')
    )
    
    # Add year_id column to department table
    op.add_column('department', sa.Column('year_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_department_year', 'department', 'budget_year', ['year_id'], ['id'])
    
    # Create default budget year for existing data (current year)
    current_year = datetime.now().year
    
    # Insert default budget year
    op.execute(f"""
        INSERT INTO budget_year (year, name, is_active, is_current, created_at) 
        VALUES ({current_year}, '{current_year}', true, true, datetime('now'))
    """)
    
    # Update existing departments to link to the new budget year
    op.execute(f"""
        UPDATE department SET year_id = (SELECT id FROM budget_year WHERE year = {current_year})
    """)


def downgrade():
    # Remove foreign key and column from department
    op.drop_constraint('fk_department_year', 'department', type_='foreignkey')
    op.drop_column('department', 'year_id')
    
    # Drop budget_year table
    op.drop_table('budget_year')
