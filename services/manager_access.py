"""Helper utilities for manager cross-department category access."""
from sqlalchemy import or_
from models import Category, Department, Subcategory


def get_manager_access(user):
    """Get the department IDs, category IDs, and subcategory IDs a manager has access to.

    When a manager has explicit managed_categories or managed_subcategories,
    the home department is NOT auto-granted as a full-access department —
    access is scoped to the targeted assignments. Managers without targeted
    cat/subcat assignments keep backwards-compatible home-department access.

    Without this distinction, a DBA team lead assigned only to their team's
    welfare subcategory would still see every sibling team's subcategories
    (and expenses) whenever the welfare category lived in the home department.

    Full-access departments are expanded by name across all budget years,
    so a manager assigned to "Engineering" in 2025 also has access to
    "Engineering" in 2026 (and any other year).

    Returns:
        tuple: (managed_dept_ids, managed_category_ids, managed_subcategory_ids)
    """
    managed_dept_ids = [d.id for d in user.managed_departments]
    managed_cat_ids = [c.id for c in user.managed_categories]
    managed_subcat_ids = [s.id for s in user.managed_subcategories]

    has_targeted_assignment = bool(managed_cat_ids or managed_subcat_ids)
    if (not has_targeted_assignment
            and user.department_id
            and user.department_id not in managed_dept_ids):
        managed_dept_ids.append(user.department_id)

    # Expand to include all departments with matching names across all budget years.
    # The manager_departments table links to specific department rows (year-scoped),
    # but departments sharing a name across years should be treated as the same entity.
    if managed_dept_ids:
        assigned_depts = Department.query.filter(Department.id.in_(managed_dept_ids)).all()
        managed_names = list({d.name for d in assigned_depts})
        if managed_names:
            all_matching = Department.query.filter(Department.name.in_(managed_names)).all()
            managed_dept_ids = list({d.id for d in all_matching})

    return managed_dept_ids, managed_cat_ids, managed_subcat_ids


def build_category_access_filter(managed_dept_ids, managed_cat_ids, managed_subcat_ids=None):
    """Build a SQLAlchemy OR filter for category-level access.

    This produces a filter like:
        Category.department_id IN (dept_ids) OR Category.id IN (cat_ids)

    If managed_subcat_ids is provided, categories containing those subcategories
    are also included.

    Returns None if no access at all.
    """
    conditions = []
    if managed_dept_ids:
        conditions.append(Category.department_id.in_(managed_dept_ids))
    if managed_cat_ids:
        conditions.append(Category.id.in_(managed_cat_ids))
    if managed_subcat_ids:
        # Find parent category IDs for the managed subcategories
        subcat_cat_ids = [s.category_id for s in
                          Subcategory.query.filter(Subcategory.id.in_(managed_subcat_ids)).all()]
        if subcat_cat_ids:
            conditions.append(Category.id.in_(subcat_cat_ids))
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
    managed_dept_ids, managed_cat_ids, managed_subcat_ids = get_manager_access(user)

    # Check direct category access
    if category_id in managed_cat_ids:
        return True

    # Check department-level access
    if dept_id is not None:
        if dept_id in managed_dept_ids:
            return True
    else:
        # Fallback: query the category's department
        cat = Category.query.get(category_id)
        if cat and cat.department_id in managed_dept_ids:
            return True

    # Check subcategory-level access: if any subcategory of this category is managed
    if managed_subcat_ids and category_id:
        subcats = Subcategory.query.filter(
            Subcategory.category_id == category_id,
            Subcategory.id.in_(managed_subcat_ids)
        ).first()
        if subcats:
            return True

    return False


def has_subcategory_access(user, subcategory_id, category_id=None, dept_id=None):
    """Check if a manager has access to a specific subcategory.

    Access is granted if:
    - The subcategory is directly assigned (managed_subcategories)
    - The parent category is directly assigned (managed_categories)
    - The parent department is managed (managed_departments)

    Args:
        user: The current user
        subcategory_id: The subcategory ID to check
        category_id: Optional category_id (to avoid extra query)
        dept_id: Optional department_id (to avoid extra query)
    """
    managed_dept_ids, managed_cat_ids, managed_subcat_ids = get_manager_access(user)

    # Check direct subcategory access
    if subcategory_id in managed_subcat_ids:
        return True

    # Resolve category_id and dept_id if not provided
    if category_id is None or dept_id is None:
        sub = Subcategory.query.get(subcategory_id)
        if not sub:
            return False
        category_id = sub.category_id
        if dept_id is None:
            cat = Category.query.get(category_id)
            dept_id = cat.department_id if cat else None

    # Check category-level access
    if category_id in managed_cat_ids:
        return True

    # Check department-level access
    if dept_id is not None and dept_id in managed_dept_ids:
        return True

    return False
