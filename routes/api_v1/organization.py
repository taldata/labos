from flask import jsonify, request
from flask_login import login_required, current_user
from models import db, Department, Category, Subcategory, Expense
from . import api_v1
import logging

@api_v1.route('/organization/structure', methods=['GET'])
@login_required
def get_organization_structure():
    """Get full organization structure (Departments -> Categories -> Subcategories)"""
    try:
        # Check if user is admin or manager
        if not current_user.is_admin and not current_user.is_manager:
            return jsonify({'error': 'Not authorized'}), 403

        departments = Department.query.order_by(Department.name).all()

        structure = []
        for dept in departments:
            # Calculate actual expenses for the department (approved expenses only)
            dept_spent = db.session.query(db.func.sum(Expense.amount))\
                .join(Subcategory, Expense.subcategory_id == Subcategory.id)\
                .join(Category, Subcategory.category_id == Category.id)\
                .filter(Category.department_id == dept.id)\
                .filter(Expense.status == 'approved')\
                .scalar() or 0.0

            dept_data = {
                'id': dept.id,
                'name': dept.name,
                'budget': dept.budget,
                'spent': dept_spent,
                'currency': dept.currency,
                'categories': []
            }

            categories = Category.query.filter_by(department_id=dept.id).order_by(Category.name).all()
            for cat in categories:
                # Calculate actual expenses for the category
                cat_spent = db.session.query(db.func.sum(Expense.amount))\
                    .join(Subcategory, Expense.subcategory_id == Subcategory.id)\
                    .filter(Subcategory.category_id == cat.id)\
                    .filter(Expense.status == 'approved')\
                    .scalar() or 0.0

                cat_data = {
                    'id': cat.id,
                    'name': cat.name,
                    'budget': cat.budget,
                    'spent': cat_spent,
                    'department_id': cat.department_id,
                    'subcategories': []
                }

                subcategories = Subcategory.query.filter_by(category_id=cat.id).order_by(Subcategory.name).all()
                for sub in subcategories:
                    # Calculate actual expenses for the subcategory
                    sub_spent = db.session.query(db.func.sum(Expense.amount))\
                        .filter(Expense.subcategory_id == sub.id)\
                        .filter(Expense.status == 'approved')\
                        .scalar() or 0.0

                    sub_data = {
                        'id': sub.id,
                        'name': sub.name,
                        'budget': sub.budget,
                        'spent': sub_spent,
                        'category_id': sub.category_id
                    }
                    cat_data['subcategories'].append(sub_data)

                dept_data['categories'].append(cat_data)

            structure.append(dept_data)

        return jsonify({'structure': structure}), 200

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

        department = Department(
            name=data['name'],
            budget=float(data.get('budget', 0.0)),
            currency=data.get('currency', 'ILS')
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
            department.budget = float(data['budget'])
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

        category = Category(
            name=data['name'],
            budget=float(data.get('budget', 0.0)),
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
            category.budget = float(data['budget'])
            
        db.session.commit()
        
        logging.info(f"Category {category.id} updated by {current_user.username}")
        
        return jsonify({
            'message': 'Category updated successfully',
            'category': {
                'id': category.id,
                'name': category.name,
                'budget': category.budget,
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

        subcategory = Subcategory(
            name=data['name'],
            budget=float(data.get('budget', 0.0)),
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
            subcategory.budget = float(data['budget'])
            
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
