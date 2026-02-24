from flask import jsonify, request
from flask_login import login_required, current_user
from models import db, Department, Category, Subcategory, Expense, BudgetYear, User, manager_departments
from services.manager_access import get_manager_access, build_category_access_filter
from sqlalchemy import func, case, or_
from . import api_v1
import logging
from datetime import datetime

# --- Budget Years ---

@api_v1.route('/organization/years', methods=['GET'])
@login_required
def get_budget_years():
    """Get all budget years"""
    try:
        if not current_user.is_admin and not current_user.is_manager and not current_user.is_hr:
            return jsonify({'error': 'Not authorized'}), 403

        years = BudgetYear.query.order_by(BudgetYear.year.desc()).all()

        # Get the actual current year from system
        current_year = datetime.now().year

        return jsonify({
            'years': [{
                'id': y.id,
                'year': y.year,
                'name': y.name or str(y.year),
                'is_active': y.is_active,
                'is_current': y.year == current_year,  # Calculate based on actual current year
                'created_at': y.created_at.isoformat() if y.created_at else None
            } for y in years]
        }), 200
    except Exception as e:
        logging.error(f"Error getting budget years: {str(e)}")
        return jsonify({'error': 'Failed to fetch budget years'}), 500


@api_v1.route('/organization/years', methods=['POST'])
@login_required
def create_budget_year():
    """Create a new budget year"""
    try:
        if not current_user.is_admin:
            return jsonify({'error': 'Not authorized'}), 403
        
        data = request.get_json()
        if not data or 'year' not in data:
            return jsonify({'error': 'Year is required'}), 400
        
        year_num = int(data['year'])
        
        # Check if year already exists
        existing = BudgetYear.query.filter_by(year=year_num).first()
        if existing:
            return jsonify({'error': f'Budget year {year_num} already exists'}), 400
        
        budget_year = BudgetYear(
            year=year_num,
            name=data.get('name', str(year_num)),
            is_active=data.get('is_active', True),
            is_current=False
        )
        
        db.session.add(budget_year)
        db.session.commit()
        
        logging.info(f"Budget year {year_num} created by {current_user.username}")
        
        return jsonify({
            'message': 'Budget year created successfully',
            'year': {
                'id': budget_year.id,
                'year': budget_year.year,
                'name': budget_year.name,
                'is_active': budget_year.is_active,
                'is_current': budget_year.is_current
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating budget year: {str(e)}")
        return jsonify({'error': 'Failed to create budget year'}), 500


@api_v1.route('/organization/years/<int:year_id>', methods=['PUT'])
@login_required
def update_budget_year(year_id):
    """Update a budget year"""
    try:
        if not current_user.is_admin:
            return jsonify({'error': 'Not authorized'}), 403
        
        budget_year = BudgetYear.query.get(year_id)
        if not budget_year:
            return jsonify({'error': 'Budget year not found'}), 404
        
        data = request.get_json()
        
        if 'name' in data:
            budget_year.name = data['name']
        if 'is_active' in data:
            budget_year.is_active = data['is_active']
        if 'is_current' in data and data['is_current']:
            # Set all other years to not current
            BudgetYear.query.update({'is_current': False})
            budget_year.is_current = True
        
        db.session.commit()
        
        logging.info(f"Budget year {year_id} updated by {current_user.username}")
        
        return jsonify({
            'message': 'Budget year updated successfully',
            'year': {
                'id': budget_year.id,
                'year': budget_year.year,
                'name': budget_year.name,
                'is_active': budget_year.is_active,
                'is_current': budget_year.is_current
            }
        }), 200
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating budget year: {str(e)}")
        return jsonify({'error': 'Failed to update budget year'}), 500


@api_v1.route('/organization/years/<int:year_id>/copy-from/<int:source_id>', methods=['POST'])
@login_required
def copy_structure_from_year(year_id, source_id):
    """Copy organization structure from one year to another"""
    try:
        if not current_user.is_admin:
            return jsonify({'error': 'Not authorized'}), 403
        
        target_year = BudgetYear.query.get(year_id)
        source_year = BudgetYear.query.get(source_id)
        
        if not target_year or not source_year:
            return jsonify({'error': 'Budget year not found'}), 404
        
        # Get source departments
        source_depts = Department.query.filter_by(year_id=source_id).all()

        # Track source dept ID -> new dept ID for manager assignment copying
        dept_id_map = {}
        skipped_depts = []

        for src_dept in source_depts:
            # Skip if department with same name already exists in target year
            existing = Department.query.filter_by(name=src_dept.name, year_id=year_id).first()
            if existing:
                dept_id_map[src_dept.id] = existing.id
                skipped_depts.append(src_dept.name)
                continue

            # Create new department
            new_dept = Department(
                name=src_dept.name,
                budget=0.0,  # Reset budget for new year
                currency=src_dept.currency,
                year_id=year_id
            )
            db.session.add(new_dept)
            db.session.flush()  # Get the new dept ID
            dept_id_map[src_dept.id] = new_dept.id

            # Copy categories
            for src_cat in src_dept.categories:
                new_cat = Category(
                    name=src_cat.name,
                    budget=0.0,
                    is_welfare=src_cat.is_welfare,
                    department_id=new_dept.id
                )
                db.session.add(new_cat)
                db.session.flush()

                # Copy subcategories
                for src_sub in src_cat.subcategories:
                    new_sub = Subcategory(
                        name=src_sub.name,
                        budget=0.0,
                        category_id=new_cat.id
                    )
                    db.session.add(new_sub)

        # Copy manager-department assignments to new year's departments
        managers_copied = 0
        for src_dept_id, new_dept_id in dept_id_map.items():
            if src_dept_id == new_dept_id:
                continue  # Skip already-existing departments
            # Get managers of source department
            src_managers = db.session.query(manager_departments.c.user_id).filter(
                manager_departments.c.department_id == src_dept_id
            ).all()
            for (user_id,) in src_managers:
                # Check if assignment already exists
                exists = db.session.query(manager_departments).filter(
                    manager_departments.c.user_id == user_id,
                    manager_departments.c.department_id == new_dept_id
                ).first()
                if not exists:
                    db.session.execute(manager_departments.insert().values(
                        user_id=user_id, department_id=new_dept_id
                    ))
                    managers_copied += 1

        # Optionally migrate user department assignments to the new year
        migrate_users = request.get_json() and request.get_json().get('migrate_users', False)
        users_migrated = 0
        if migrate_users:
            users_with_dept = User.query.filter(User.department_id.isnot(None)).all()
            for user in users_with_dept:
                if user.department_id in dept_id_map:
                    new_dept_id = dept_id_map[user.department_id]
                    if new_dept_id != user.department_id:
                        user.department_id = new_dept_id
                        users_migrated += 1
                else:
                    # User's department wasn't in source year - try matching by name
                    old_dept = Department.query.get(user.department_id)
                    if old_dept:
                        target_dept = Department.query.filter_by(
                            name=old_dept.name, year_id=year_id
                        ).first()
                        if target_dept and target_dept.id != user.department_id:
                            user.department_id = target_dept.id
                            users_migrated += 1

        db.session.commit()

        logging.info(f"Structure copied from year {source_id} to {year_id} by {current_user.username}. "
                     f"Managers copied: {managers_copied}, Users migrated: {users_migrated}, "
                     f"Skipped existing depts: {skipped_depts}")

        msg = f'Structure copied successfully from {source_year.name} to {target_year.name}'
        if skipped_depts:
            msg += f'. Skipped {len(skipped_depts)} existing department(s): {", ".join(skipped_depts)}'
        if managers_copied:
            msg += f'. {managers_copied} manager assignment(s) copied.'
        if users_migrated:
            msg += f' {users_migrated} user(s) migrated to new year.'

        return jsonify({
            'message': msg
        }), 200
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error copying structure: {str(e)}")
        return jsonify({'error': 'Failed to copy structure'}), 500


@api_v1.route('/organization/years/<int:year_id>/migrate-users', methods=['POST'])
@login_required
def migrate_users_to_year(year_id):
    """Migrate user department assignments to a target budget year.

    For each user with a department_id, find the matching department (by name)
    in the target year and update the user's department_id.
    """
    try:
        if not current_user.is_admin:
            return jsonify({'error': 'Not authorized'}), 403

        target_year = BudgetYear.query.get(year_id)
        if not target_year:
            return jsonify({'error': 'Budget year not found'}), 404

        # Get all departments in the target year, indexed by name
        target_depts = Department.query.filter_by(year_id=year_id).all()
        target_dept_by_name = {d.name: d for d in target_depts}

        users_migrated = 0
        users_skipped = []
        users_with_dept = User.query.filter(User.department_id.isnot(None)).all()

        for user in users_with_dept:
            current_dept = Department.query.get(user.department_id)
            if not current_dept:
                continue
            # Already pointing to a department in the target year
            if current_dept.year_id == year_id:
                continue
            # Find matching department by name in target year
            target_dept = target_dept_by_name.get(current_dept.name)
            if target_dept:
                user.department_id = target_dept.id
                users_migrated += 1
            else:
                users_skipped.append({
                    'user': user.username,
                    'department': current_dept.name
                })

        db.session.commit()

        logging.info(f"User migration to year {year_id}: {users_migrated} migrated, "
                     f"{len(users_skipped)} skipped by {current_user.username}")

        return jsonify({
            'message': f'{users_migrated} user(s) migrated to {target_year.name}',
            'migrated': users_migrated,
            'skipped': users_skipped
        }), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error migrating users to year {year_id}: {str(e)}")
        return jsonify({'error': 'Failed to migrate users'}), 500


@api_v1.route('/organization/structure', methods=['GET'])
@login_required
def get_organization_structure():
    """Get full organization structure (Departments -> Categories -> Subcategories)"""
    try:
        # Check if user is admin, manager, or HR
        if not current_user.is_admin and not current_user.is_manager and not current_user.is_hr:
            return jsonify({'error': 'Not authorized'}), 403

        # Filter by year if provided
        year_id = request.args.get('year_id', type=int)
        all_years = request.args.get('all_years', '').lower() == 'true'

        query = Department.query
        if all_years:
            # Skip year filtering - return departments from all years
            pass
        elif year_id:
            query = query.filter_by(year_id=year_id)
        else:
            # Default to current year or all if no current year set
            current_year = BudgetYear.query.filter_by(is_current=True).first()
            if current_year:
                query = query.filter_by(year_id=current_year.id)
        
        # For managers (non-admins), filter to only their managed departments
        # (cross-department categories are accessible via expense submission, not here)
        if current_user.is_manager and not current_user.is_admin:
            managed_depts = list(current_user.managed_departments)
            managed_dept_ids = [d.id for d in managed_depts]
            managed_dept_names = [d.name for d in managed_depts]

            logging.info(f"Manager {current_user.username} (id={current_user.id}): managed_dept_ids={managed_dept_ids}, managed_dept_names={managed_dept_names}, department_id={current_user.department_id}")

            # Also include the manager's home department as a fallback
            if current_user.department_id:
                if current_user.department_id not in managed_dept_ids:
                    managed_dept_ids.append(current_user.department_id)
                # Get the home department name for cross-year matching
                home_dept = Department.query.get(current_user.department_id)
                if home_dept and home_dept.name not in managed_dept_names:
                    managed_dept_names.append(home_dept.name)

            if managed_dept_ids or managed_dept_names:
                # Build filter conditions
                conditions = []
                if managed_dept_ids:
                    conditions.append(Department.id.in_(managed_dept_ids))
                if managed_dept_names:
                    conditions.append(Department.name.in_(managed_dept_names))

                # Filter by name OR id to support both same-year and cross-year access
                query = query.filter(or_(*conditions))
            else:
                # Manager has no assigned departments - return empty
                logging.warning(f"Manager {current_user.username} has no assigned departments")
                return jsonify({'structure': [], 'view_only': True}), 200

        departments = query.order_by(Department.name).all()

        # Pre-calculate all budget usage in 3 queries instead of N*M*K queries
        # Get all department IDs for filtering
        dept_ids = [d.id for d in departments]

        # 1. Calculate department spending (approved expenses only)
        dept_spending = {}
        if dept_ids:
            dept_query = db.session.query(
                Category.department_id,
                func.sum(func.coalesce(Expense.amount_ils, Expense.amount)).label('spent')
            ).join(Subcategory, Expense.subcategory_id == Subcategory.id)\
             .join(Category, Subcategory.category_id == Category.id)\
             .filter(Category.department_id.in_(dept_ids))\
             .filter(Expense.status == 'approved')\
             .group_by(Category.department_id).all()

            for dept_id, spent in dept_query:
                dept_spending[dept_id] = float(spent) if spent else 0.0

        # 2. Calculate category spending
        cat_spending = {}
        if dept_ids:
            cat_query = db.session.query(
                Subcategory.category_id,
                func.sum(func.coalesce(Expense.amount_ils, Expense.amount)).label('spent')
            ).join(Subcategory, Expense.subcategory_id == Subcategory.id)\
             .join(Category, Subcategory.category_id == Category.id)\
             .filter(Category.department_id.in_(dept_ids))\
             .filter(Expense.status == 'approved')\
             .group_by(Subcategory.category_id).all()

            for cat_id, spent in cat_query:
                cat_spending[cat_id] = float(spent) if spent else 0.0

        # 3. Calculate subcategory spending
        subcat_spending = {}
        if dept_ids:
            subcat_query = db.session.query(
                Expense.subcategory_id,
                func.sum(func.coalesce(Expense.amount_ils, Expense.amount)).label('spent')
            ).join(Subcategory, Expense.subcategory_id == Subcategory.id)\
             .join(Category, Subcategory.category_id == Category.id)\
             .filter(Category.department_id.in_(dept_ids))\
             .filter(Expense.status == 'approved')\
             .group_by(Expense.subcategory_id).all()

            for subcat_id, spent in subcat_query:
                subcat_spending[subcat_id] = float(spent) if spent else 0.0

        # Fetch all categories and subcategories in bulk
        all_categories = []
        all_subcategories = []
        if dept_ids:
            all_categories = Category.query.filter(Category.department_id.in_(dept_ids)).order_by(Category.name).all()
            if all_categories:
                cat_ids = [c.id for c in all_categories]
                all_subcategories = Subcategory.query.filter(Subcategory.category_id.in_(cat_ids)).order_by(Subcategory.name).all()

        # Map categories to departments
        cats_by_dept = {}
        for cat in all_categories:
            if cat.department_id not in cats_by_dept:
                cats_by_dept[cat.department_id] = []
            cats_by_dept[cat.department_id].append(cat)
            
        # Map subcategories to categories
        subcats_by_cat = {}
        for sub in all_subcategories:
            if sub.category_id not in subcats_by_cat:
                subcats_by_cat[sub.category_id] = []
            subcats_by_cat[sub.category_id].append(sub)

        # Build structure using pre-calculated spending data and in-memory maps
        structure = []
        for dept in departments:
            dept_data = {
                'id': dept.id,
                'name': dept.name,
                'budget': dept.budget,
                'spent': dept_spending.get(dept.id, 0.0),
                'currency': dept.currency,
                'is_fully_managed': True,
                'categories': []
            }

            for cat in cats_by_dept.get(dept.id, []):
                cat_data = {
                    'id': cat.id,
                    'name': cat.name,
                    'budget': cat.budget,
                    'spent': cat_spending.get(cat.id, 0.0),
                    'is_welfare': cat.is_welfare,
                    'department_id': cat.department_id,
                    'is_cross_department': False,
                    'subcategories': []
                }

                for sub in subcats_by_cat.get(cat.id, []):
                    sub_data = {
                        'id': sub.id,
                        'name': sub.name,
                        'budget': sub.budget,
                        'spent': subcat_spending.get(sub.id, 0.0),
                        'category_id': sub.category_id
                    }
                    cat_data['subcategories'].append(sub_data)

                dept_data['categories'].append(cat_data)

            structure.append(dept_data)

        # Include view_only flag for managers and HR users (non-admins)
        response_data = {'structure': structure}
        if (current_user.is_manager or current_user.is_hr) and not current_user.is_admin:
            response_data['view_only'] = True
        
        return jsonify(response_data), 200

    except Exception as e:
        logging.error(f"Error getting organization structure: {str(e)}")
        return jsonify({'error': 'Failed to fetch organization structure'}), 500

# --- Departments ---

@api_v1.route('/organization/departments', methods=['POST'])
@login_required
def create_department():
    """Create a new department"""
    try:
        if not current_user.is_admin:
            return jsonify({'error': 'Not authorized'}), 403

        data = request.get_json()
        if not data or 'name' not in data:
            return jsonify({'error': 'Missing required fields'}), 400

        # Get year_id from request or use current year
        year_id = data.get('year_id')
        if not year_id:
            current_year = BudgetYear.query.filter_by(is_current=True).first()
            year_id = current_year.id if current_year else None

        # Check for duplicate department name within the same year
        existing = Department.query.filter_by(name=data['name'], year_id=year_id).first()
        if existing:
            return jsonify({'error': f'Department "{data["name"]}" already exists for this budget year'}), 400

        budget_val = data.get('budget')
        if budget_val == '' or budget_val is None:
            budget_val = 0.0
        else:
            budget_val = float(budget_val)

        department = Department(
            name=data['name'],
            budget=budget_val,
            currency=data.get('currency', 'ILS'),
            year_id=year_id
        )
        
        db.session.add(department)
        db.session.commit()
        
        logging.info(f"Department {department.name} created by {current_user.username}")
        
        return jsonify({
            'message': 'Department created successfully',
            'department': {
                'id': department.id,
                'name': department.name,
                'budget': department.budget,
                'currency': department.currency
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating department: {str(e)}")
        return jsonify({'error': 'Failed to create department'}), 500

@api_v1.route('/organization/departments/<int:dept_id>', methods=['PUT'])
@login_required
def update_department(dept_id):
    """Update a department"""
    try:
        if not current_user.is_admin:
            return jsonify({'error': 'Not authorized'}), 403

        department = Department.query.get(dept_id)
        if not department:
            return jsonify({'error': 'Department not found'}), 404

        data = request.get_json()
        
        if 'name' in data:
            department.name = data['name']
        if 'budget' in data:
            budget_val = data['budget']
            if budget_val == '' or budget_val is None:
                department.budget = 0.0
            else:
                department.budget = float(budget_val)
        if 'currency' in data:
            department.currency = data['currency']
            
        db.session.commit()
        
        logging.info(f"Department {department.id} updated by {current_user.username}")
        
        return jsonify({
            'message': 'Department updated successfully',
            'department': {
                'id': department.id,
                'name': department.name,
                'budget': department.budget,
                'currency': department.currency
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating department: {str(e)}")
        return jsonify({'error': 'Failed to update department'}), 500

@api_v1.route('/organization/departments/<int:dept_id>', methods=['DELETE'])
@login_required
def delete_department(dept_id):
    """Delete a department"""
    try:
        if not current_user.is_admin:
            return jsonify({'error': 'Not authorized'}), 403

        department = Department.query.get(dept_id)
        if not department:
            return jsonify({'error': 'Department not found'}), 404

        # Check if department has categories or users
        if department.categories or department.employees:
            return jsonify({'error': 'Cannot delete department with associated categories or employees'}), 400

        db.session.delete(department)
        db.session.commit()
        
        logging.info(f"Department {dept_id} deleted by {current_user.username}")
        
        return jsonify({'message': 'Department deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deleting department: {str(e)}")
        return jsonify({'error': 'Failed to delete department'}), 500

# --- Categories ---

@api_v1.route('/organization/categories', methods=['POST'])
@login_required
def create_category():
    """Create a new category"""
    try:
        if not current_user.is_admin:
            return jsonify({'error': 'Not authorized'}), 403

        data = request.get_json()
        if not data or 'name' not in data or 'department_id' not in data:
            return jsonify({'error': 'Missing required fields'}), 400

        budget_val = data.get('budget')
        if budget_val == '' or budget_val is None:
            budget_val = 0.0
        else:
            budget_val = float(budget_val)

        category = Category(
            name=data['name'],
            budget=budget_val,
            is_welfare=data.get('is_welfare', False),
            department_id=int(data['department_id'])
        )
        
        db.session.add(category)
        db.session.commit()
        
        logging.info(f"Category {category.name} created by {current_user.username}")
        
        return jsonify({
            'message': 'Category created successfully',
            'category': {
                'id': category.id,
                'name': category.name,
                'budget': category.budget,
                'is_welfare': category.is_welfare,
                'department_id': category.department_id
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating category: {str(e)}")
        return jsonify({'error': 'Failed to create category'}), 500

@api_v1.route('/organization/categories/<int:cat_id>', methods=['PUT'])
@login_required
def update_category(cat_id):
    """Update a category"""
    try:
        if not current_user.is_admin:
            return jsonify({'error': 'Not authorized'}), 403

        category = Category.query.get(cat_id)
        if not category:
            return jsonify({'error': 'Category not found'}), 404

        data = request.get_json()
        
        if 'name' in data:
            category.name = data['name']
        if 'budget' in data:
            budget_val = data['budget']
            if budget_val == '' or budget_val is None:
                category.budget = 0.0
            else:
                category.budget = float(budget_val)
        if 'is_welfare' in data:
            category.is_welfare = data['is_welfare']

        db.session.commit()

        logging.info(f"Category {category.id} updated by {current_user.username}")

        return jsonify({
            'message': 'Category updated successfully',
            'category': {
                'id': category.id,
                'name': category.name,
                'budget': category.budget,
                'is_welfare': category.is_welfare,
                'department_id': category.department_id
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating category: {str(e)}")
        return jsonify({'error': 'Failed to update category'}), 500

@api_v1.route('/organization/categories/<int:cat_id>', methods=['DELETE'])
@login_required
def delete_category(cat_id):
    """Delete a category"""
    try:
        if not current_user.is_admin:
            return jsonify({'error': 'Not authorized'}), 403

        category = Category.query.get(cat_id)
        if not category:
            return jsonify({'error': 'Category not found'}), 404

        # Check if category has subcategories
        if category.subcategories:
            return jsonify({'error': 'Cannot delete category with associated subcategories'}), 400

        db.session.delete(category)
        db.session.commit()
        
        logging.info(f"Category {cat_id} deleted by {current_user.username}")
        
        return jsonify({'message': 'Category deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deleting category: {str(e)}")
        return jsonify({'error': 'Failed to delete category'}), 500

# --- Subcategories ---

@api_v1.route('/organization/subcategories', methods=['POST'])
@login_required
def create_subcategory():
    """Create a new subcategory"""
    try:
        if not current_user.is_admin:
            return jsonify({'error': 'Not authorized'}), 403

        data = request.get_json()
        if not data or 'name' not in data or 'category_id' not in data:
            return jsonify({'error': 'Missing required fields'}), 400

        budget_val = data.get('budget')
        if budget_val == '' or budget_val is None:
            budget_val = 0.0
        else:
            budget_val = float(budget_val)

        subcategory = Subcategory(
            name=data['name'],
            budget=budget_val,
            category_id=int(data['category_id'])
        )
        
        db.session.add(subcategory)
        db.session.commit()
        
        logging.info(f"Subcategory {subcategory.name} created by {current_user.username}")
        
        return jsonify({
            'message': 'Subcategory created successfully',
            'subcategory': {
                'id': subcategory.id,
                'name': subcategory.name,
                'budget': subcategory.budget,
                'category_id': subcategory.category_id
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating subcategory: {str(e)}")
        return jsonify({'error': 'Failed to create subcategory'}), 500

@api_v1.route('/organization/subcategories/<int:sub_id>', methods=['PUT'])
@login_required
def update_subcategory(sub_id):
    """Update a subcategory"""
    try:
        if not current_user.is_admin:
            return jsonify({'error': 'Not authorized'}), 403

        subcategory = Subcategory.query.get(sub_id)
        if not subcategory:
            return jsonify({'error': 'Subcategory not found'}), 404

        data = request.get_json()
        
        if 'name' in data:
            subcategory.name = data['name']
        if 'budget' in data:
            budget_val = data['budget']
            if budget_val == '' or budget_val is None:
                subcategory.budget = 0.0
            else:
                subcategory.budget = float(budget_val)
            
        db.session.commit()
        
        logging.info(f"Subcategory {subcategory.id} updated by {current_user.username}")
        
        return jsonify({
            'message': 'Subcategory updated successfully',
            'subcategory': {
                'id': subcategory.id,
                'name': subcategory.name,
                'budget': subcategory.budget,
                'category_id': subcategory.category_id
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating subcategory: {str(e)}")
        return jsonify({'error': 'Failed to update subcategory'}), 500

@api_v1.route('/organization/subcategories/<int:sub_id>', methods=['DELETE'])
@login_required
def delete_subcategory(sub_id):
    """Delete a subcategory"""
    try:
        if not current_user.is_admin:
            return jsonify({'error': 'Not authorized'}), 403

        subcategory = Subcategory.query.get(sub_id)
        if not subcategory:
            return jsonify({'error': 'Subcategory not found'}), 404

        # Check if subcategory has expenses
        if subcategory.expenses:
            return jsonify({'error': 'Cannot delete subcategory with associated expenses'}), 400

        db.session.delete(subcategory)
        db.session.commit()
        
        logging.info(f"Subcategory {sub_id} deleted by {current_user.username}")
        
        return jsonify({'message': 'Subcategory deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deleting subcategory: {str(e)}")
        return jsonify({'error': 'Failed to delete subcategory'}), 500
