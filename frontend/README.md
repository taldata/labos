# LabOS Modern Frontend

A modern, professional React-based frontend for the LabOS Expense Management System.

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Shadcn/ui** - Modern, accessible UI components
- **TanStack Query (React Query)** - Data fetching and caching
- **Zustand** - State management
- **React Router v6** - Client-side routing
- **React Hook Form + Zod** - Form handling and validation
- **Axios** - HTTP client
- **Sonner** - Toast notifications
- **Lucide React** - Icon library
- **Recharts** - Data visualization

## Features

- Modern, clean UI with professional design
- Mobile-first responsive design
- Role-based access control (Employee, Manager, Admin, Accounting)
- Real-time data updates with React Query
- Form validation with Zod
- OCR document processing integration
- Excel export functionality
- Toast notifications for user feedback
- Loading states and error handling
- Dark mode ready (Tailwind dark mode configured)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.x with Flask backend running

### Installation

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
frontend/
├── src/
│   ├── components/          # Reusable React components
│   │   ├── ui/             # Shadcn/ui components
│   │   └── Layout.tsx      # Main app layout with navigation
│   ├── pages/              # Page components
│   │   ├── LoginPage.tsx
│   │   ├── EmployeeDashboard.tsx
│   │   ├── ManagerDashboard.tsx
│   │   ├── AdminDashboard.tsx
│   │   ├── AccountingDashboard.tsx
│   │   ├── SubmitExpense.tsx
│   │   ├── ExpenseHistory.tsx
│   │   ├── ManageDepartments.tsx
│   │   ├── ManageUsers.tsx
│   │   └── ManageSuppliers.tsx
│   ├── hooks/              # Custom React hooks
│   │   └── useAuthStore.ts # Authentication state management
│   ├── services/           # API client and services
│   │   └── api.ts          # Axios API client
│   ├── types/              # TypeScript type definitions
│   │   └── index.ts        # All type definitions
│   ├── lib/                # Utility functions
│   │   └── utils.ts        # Helper functions
│   ├── styles/             # Global styles
│   │   └── globals.css     # Tailwind base styles
│   ├── App.tsx             # Main app component with routing
│   └── main.tsx            # App entry point
├── public/                 # Static assets
├── index.html              # HTML template
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── vite.config.ts          # Vite config
├── tailwind.config.js      # Tailwind CSS config
└── postcss.config.js       # PostCSS config
```

## API Integration

The frontend communicates with the Flask backend via REST API at `/api/v1/`.

### Available API Endpoints

#### Authentication
- `POST /api/v1/auth/login` - Login with username/password
- `POST /api/v1/auth/logout` - Logout
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/change-password` - Change password

#### Expenses
- `GET /api/v1/expenses` - Get all expenses (filtered by permissions)
- `GET /api/v1/expenses/:id` - Get single expense
- `POST /api/v1/expenses` - Create expense (multipart/form-data)
- `PUT /api/v1/expenses/:id` - Update expense
- `DELETE /api/v1/expenses/:id` - Delete expense
- `POST /api/v1/expenses/:id/approve` - Approve expense (manager)
- `POST /api/v1/expenses/:id/reject` - Reject expense (manager)
- `POST /api/v1/expenses/process-document` - OCR document processing

#### Departments, Categories, Subcategories
- `GET /api/v1/departments` - Get all departments
- `POST /api/v1/departments` - Create department
- `GET /api/v1/categories?department_id=X` - Get categories
- `GET /api/v1/subcategories?category_id=X` - Get subcategories

#### Users (Admin only)
- `GET /api/v1/users` - Get all users
- `POST /api/v1/users` - Create user
- `PUT /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Delete user

#### Suppliers
- `GET /api/v1/suppliers` - Get all suppliers
- `GET /api/v1/suppliers/search?q=query` - Search suppliers

#### Dashboards
- `GET /api/v1/dashboard/employee` - Employee dashboard data
- `GET /api/v1/dashboard/manager` - Manager dashboard data
- `GET /api/v1/dashboard/admin` - Admin dashboard data
- `GET /api/v1/dashboard/accounting` - Accounting dashboard data

## Development

### Running in Parallel with Old Frontend

The application is configured to run both the old Jinja2 frontend and new React frontend simultaneously:

- **Old Frontend**: `http://localhost:5000/` (default Flask routes)
- **New Frontend (Dev)**: `http://localhost:3000/` (Vite dev server)
- **New Frontend (Built)**: `http://localhost:5000/app/` (served by Flask)

### Environment Variables

The frontend proxies API requests to the backend. Configure in `vite.config.ts`:

```typescript
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:5000',
      changeOrigin: true,
    },
  },
}
```

## Deployment

1. Build the frontend:
```bash
cd frontend
npm run build
```

2. The Flask app will automatically serve the built frontend at `/app` route

3. Users can access:
   - Old UI: `https://your-domain.com/`
   - New UI: `https://your-domain.com/app/`

## Next Steps (To Complete)

The foundation is complete! Here are the remaining tasks:

1. **Complete Expense Submission Form**
   - Multi-step form with validation
   - File upload with drag-and-drop
   - OCR integration with preview
   - Real-time supplier search
   - Category/subcategory cascading selects

2. **Complete Manager Dashboard**
   - Pending approvals list with filtering
   - Budget overview with charts
   - Approve/reject modal with reason
   - Department management interface

3. **Complete Admin Dashboard**
   - System-wide analytics
   - User management CRUD
   - Supplier management
   - Credit card management
   - Advanced reporting

4. **Complete Accounting Dashboard**
   - Payment tracking interface
   - Batch payment operations
   - External accounting integration
   - Excel export functionality

5. **Polish & Testing**
   - Loading skeletons
   - Error boundaries
   - Toast notifications for all actions
   - Mobile responsive refinements
   - End-to-end testing
   - Performance optimization

## Contributing

When adding new features:

1. Create components in `src/components/`
2. Add pages in `src/pages/`
3. Define types in `src/types/index.ts`
4. Add API methods in `src/services/api.ts`
5. Use React Query for data fetching
6. Follow the existing component patterns

## License

Private - Internal use only
