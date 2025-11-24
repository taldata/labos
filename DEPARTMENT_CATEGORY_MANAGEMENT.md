# Department & Category Management Implementation Plan

## Objective
Merge the department and category management functionalities into a single, hierarchical page within the new React frontend. This will allow admins to manage the organizational structure (Departments -> Categories -> Subcategories) in one place.

## Backend Implementation

### 1. Create `routes/api_v1/organization.py`
Implement CRUD endpoints for:
- **Departments**: GET, POST, PUT, DELETE
- **Categories**: GET, POST, PUT, DELETE
- **Subcategories**: GET, POST, PUT, DELETE

**Endpoints:**
- `GET /api/v1/organization/structure` - Get full hierarchy (Departments -> Categories -> Subcategories)
- `POST /api/v1/organization/departments` - Create department
- `PUT /api/v1/organization/departments/<id>` - Update department
- `DELETE /api/v1/organization/departments/<id>` - Delete department
- `POST /api/v1/organization/categories` - Create category
- `PUT /api/v1/organization/categories/<id>` - Update category
- `DELETE /api/v1/organization/categories/<id>` - Delete category
- `POST /api/v1/organization/subcategories` - Create subcategory
- `PUT /api/v1/organization/subcategories/<id>` - Update subcategory
- `DELETE /api/v1/organization/subcategories/<id>` - Delete subcategory

### 2. Register Blueprint
- Update `routes/api_v1/__init__.py` to register the `organization` blueprint.

## Frontend Implementation

### 1. Create `DepartmentManager.jsx`
- **Layout**: Tree/Accordion view.
- **Features**:
    - List all departments.
    - Expand department to see categories.
    - Expand category to see subcategories.
    - "Add Department" button at top.
    - "Add Category" button on Department row.
    - "Add Subcategory" button on Category row.
    - Edit/Delete actions for each item.
    - Budget management for each level.

### 2. Create `DepartmentManager.css`
- Styling for the hierarchical view.
- Modals for Add/Edit forms.

### 3. Update Routing
- Add `/admin/departments` route to `App.jsx`.
- Add link in `Dashboard.jsx` (for admins only).

## Security
- Ensure all endpoints are protected with `@login_required`.
- Ensure only Admins (or Managers with permission) can access these endpoints.
