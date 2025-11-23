# LabOS - New Frontend Setup Guide

## Overview

A modern React + TypeScript frontend has been created to replace the Jinja2 templates. Both frontends can run in parallel during the transition period.

## What's Been Done

### ✅ Frontend Setup
- React 18 + TypeScript + Vite project created
- Modern UI components using Shadcn/ui + Tailwind CSS
- Responsive layout with mobile-first design
- Authentication flow with login page
- Employee dashboard with expense overview
- Placeholder pages for all major features
- API client with TypeScript types
- State management with Zustand
- Data fetching with TanStack Query (React Query)

### ✅ Backend API
- New REST API Blueprint at `/api/v1/`
- Complete CRUD endpoints for:
  - Authentication (login, logout, get user)
  - Expenses (create, read, update, delete, approve, reject)
  - Departments, Categories, Subcategories
  - Users (admin only)
  - Suppliers
  - Credit Cards
  - Dashboard data
- Payment tracking endpoints (accounting)
- OCR document processing endpoint
- CORS configured for local development

### ✅ Parallel Deployment Setup
- Old frontend continues at `/` routes
- New frontend accessible at `/app` route (after build)
- Development server runs on `localhost:3000`

## Installation Steps

### 1. Install Backend Dependencies

```bash
# Install Flask-CORS
pip install Flask-CORS

# Or if using a virtual environment:
source venv/bin/activate  # or your virtualenv
pip install Flask-CORS
```

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 3. Start Development Servers

#### Terminal 1: Flask Backend
```bash
# From project root
python app.py
# Backend runs on http://localhost:5000
```

#### Terminal 2: React Frontend
```bash
cd frontend
npm run dev
# Frontend runs on http://localhost:3000
```

### 4. Access the Application

- **New Frontend (Dev)**: http://localhost:3000
- **Old Frontend**: http://localhost:5000
- **API Endpoints**: http://localhost:5000/api/v1/

## Development Workflow

### Testing the New Frontend

1. Navigate to http://localhost:3000
2. Login with existing credentials
3. The employee dashboard should load with your expense data
4. Navigation between pages should work
5. API calls are proxied to Flask backend automatically

### Making Changes

**Frontend Changes:**
```bash
cd frontend
# Edit files in src/
# Changes hot-reload automatically
```

**Backend API Changes:**
```bash
# Edit files in routes/api_v1/
# Restart Flask server to see changes
```

## Building for Production

### Build the Frontend

```bash
cd frontend
npm run build
```

This creates a `frontend/dist` directory with optimized production files.

### Serve Built Frontend from Flask

After building, the new frontend is automatically served at:
- http://localhost:5000/app

Users can then choose between:
- `/` - Old Jinja2 interface
- `/app` - New React interface

## Architecture

### Frontend Structure
```
frontend/src/
├── components/       # React components
│   ├── ui/          # Shadcn/ui primitives
│   └── Layout.tsx   # Main app layout
├── pages/           # Page components
├── services/        # API client
├── hooks/           # Custom hooks
├── types/           # TypeScript definitions
└── lib/             # Utilities
```

### Backend API Structure
```
routes/api_v1/
├── __init__.py      # Blueprint registration
├── auth.py          # Authentication endpoints
├── expenses.py      # Expense CRUD
├── departments.py   # Department management
├── categories.py    # Category endpoints
├── subcategories.py # Subcategory endpoints
├── users.py         # User management
├── suppliers.py     # Supplier endpoints
├── credit_cards.py  # Credit card endpoints
└── dashboard.py     # Dashboard data
```

## API Examples

### Login
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "your_username", "password": "your_password"}'
```

### Get Expenses
```bash
curl http://localhost:5000/api/v1/expenses \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

### Create Expense
```bash
curl -X POST http://localhost:5000/api/v1/expenses \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -F "amount=100" \
  -F "currency=ILS" \
  -F "description=Office Supplies" \
  -F "reason=Needed for project" \
  -F "type=needs_approval" \
  -F "subcategory_id=1" \
  -F "invoice_file=@/path/to/invoice.pdf"
```

## Current Status & Next Steps

### ✅ Completed
- [x] Project setup and configuration
- [x] Core UI components
- [x] Authentication flow
- [x] API client and types
- [x] Main layout with navigation
- [x] Employee dashboard (basic)
- [x] Complete API endpoints
- [x] CORS configuration
- [x] Parallel deployment setup

### 🚧 In Progress / To Do

1. **Complete Expense Submission Form**
   - Multi-step wizard
   - File upload with preview
   - OCR integration
   - Form validation with Zod
   - Real-time supplier search

2. **Manager Features**
   - Pending approvals table
   - Approve/reject modal
   - Budget management interface
   - Department CRUD operations
   - Expense filtering and search

3. **Admin Features**
   - User management (CRUD)
   - Supplier management
   - Credit card management
   - System-wide analytics
   - Advanced reporting

4. **Accounting Features**
   - Payment tracking interface
   - Batch operations
   - External accounting integration
   - Excel exports

5. **Polish & Testing**
   - Loading states
   - Error handling
   - Toast notifications
   - Mobile optimization
   - Performance tuning
   - End-to-end tests

## Troubleshooting

### Frontend won't start
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### API calls failing
1. Check Flask server is running on port 5000
2. Check CORS is configured (Flask-CORS installed)
3. Check browser console for errors
4. Verify session cookie is being sent

### Build fails
```bash
cd frontend
npm run build
# Check for TypeScript errors
# Fix any type issues before building
```

### CORS errors
- Ensure Flask-CORS is installed: `pip install Flask-CORS`
- Check `app.py` has CORS configured for `/api/v1/*`
- Verify `vite.config.ts` proxy is set correctly

## Migration Strategy

### Phase 1: Parallel Running (Current)
- Both UIs available
- Users can test new UI at `/app`
- Old UI remains default
- Collect feedback

### Phase 2: Feature Complete
- Complete all missing features
- User acceptance testing
- Fix bugs and polish

### Phase 3: Gradual Migration
- Make new UI default
- Old UI available at `/legacy`
- Monitor usage and issues

### Phase 4: Full Migration
- Deprecate old UI
- Remove Jinja2 templates
- New UI becomes only option

## Support

For questions or issues:
1. Check browser console for errors
2. Check Flask logs for backend errors
3. Review API responses in Network tab
4. Check this documentation

## Technology Decisions

### Why React?
- Industry standard with huge ecosystem
- Excellent TypeScript support
- Large community and resources
- Great developer experience

### Why Vite?
- Fast dev server with HMR
- Optimized production builds
- Better than Create React App
- Modern tooling

### Why Shadcn/ui?
- Modern, accessible components
- Full customization
- Copy-paste, not npm package
- Built on Radix UI primitives

### Why TanStack Query?
- Best data fetching library
- Built-in caching
- Automatic refetching
- Great DevTools

### Why Zustand?
- Simple state management
- Less boilerplate than Redux
- TypeScript friendly
- Small bundle size

## Performance

The new frontend is optimized for performance:
- Code splitting with React Router
- Lazy loading of routes
- React Query caching
- Optimized production builds
- Tree shaking unused code

## Security

- Session-based authentication (inherited from Flask)
- CORS properly configured
- No sensitive data in frontend
- API permissions enforced on backend
- Input validation with Zod

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

---

**Last Updated**: November 2024
**Status**: Foundation Complete - Feature Development In Progress
