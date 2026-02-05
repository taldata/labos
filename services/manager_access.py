"""Helper utilities for manager cross-department category access."""
from sqlalchemy import or_
from models import Category


def get_manager_access(user):
    """Get the department IDs and category IDs a manager has access to.

    Returns:
        tuple: (managed_dept_ids, managed_category_ids)
    """
    managed_dept_ids = [d.id for d in user.managed_departments]
    managed_cat_ids = [c.id for c in user.managed_categories]
    if user.department_id and user.department_id not in managed_dept_ids:
        managed_dept_ids.append(user.department_id)
    return managed_dept_ids, managed_cat_ids


def build_category_access_filter(managed_dept_ids, managed_cat_ids):
    """Build a SQLAlchemy OR filter for category-level access.

    This produces a filter like:
        Category.department_id IN (dept_ids) OR Category.id IN (cat_ids)

    Returns None if no access at all.
    """
    conditions = []
    if managed_dept_ids:
        conditions.append(Category.department_id.in_(managed_dept_ids))
    if managed_cat_ids:
        conditions.append(Category.id.in_(managed_cat_ids))
    if conditions:
        return or_(*conditions)
    return None


def has_category_access(user, category_id, dept_id=None):
    """Check if a manager has access to a specific category (by dept or direct assignment).

    Args:
        user: The current user
        category_id: The category ID to check
        dept_id: Optional department_id of the category (to avoid extra query)
    """
    managed_dept_ids, managed_cat_ids = get_manager_access(user)

    # Check direct category access
    if category_id in managed_cat_ids:
        return True

    # Check department-level access
    if dept_id is not None:
        return dept_id in managed_dept_ids

    # Fallback: query the category's department
    cat = Category.query.get(category_id)
    if cat:
        return cat.department_id in managed_dept_ids
    return False
