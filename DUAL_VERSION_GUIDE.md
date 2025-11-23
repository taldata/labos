# Dual-Version Setup Guide

This guide explains how to run both the **Legacy** and **Modern** versions of the Labos Expense Management System in parallel.

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│              Your System                         │
├─────────────────────────────────────────────────┤
│                                                 │
│  LEGACY (Port 5000)       MODERN (Port 3000)   │
│  ┌──────────────┐         ┌────────────┐       │
│  │ Flask        │         │ React +    │       │
│  │ Templates    │         │ Vite       │       │
│  │ (Jinja2)     │         │            │       │
│  └──────┬───────┘         └─────┬──────┘       │
│         │                       │              │
│         └───────┬───────────────┘              │
│                 ▼                              │
│       ┌──────────────────┐                     │
│       │  Flask Backend   │                     │
│       │  + REST API      │                     │
│       └────────┬─────────┘                     │
│                ▼                               │
│       ┌──────────────────┐                     │
│       │   PostgreSQL     │                     │
│       └──────────────────┘                     │
└─────────────────────────────────────────────────┘
```

## Quick Start

### 1. Run Both Versions Simultaneously

```bash
./dev.sh
```

This script will:
- Start Flask backend on `http://localhost:5000`
- Start React frontend on `http://localhost:3000`
- Both will share the same database and API

### 2. Access the Applications

- **Legacy Version**: [http://localhost:5000](http://localhost:5000)
- **Modern Version**: [http://localhost:3000](http://localhost:3000)
- **API Endpoints**: [http://localhost:5000/api/v1](http://localhost:5000/api/v1)

## User Access Control

### Admin: Granting Modern Version Access

1. Login to the legacy version as admin
2. Navigate to **Admin Dashboard** → **Manage Users**
3. Click the 🚀 rocket icon next to a user to grant/revoke modern UI access
4. Users with green rocket icons have access to the modern version

### Users: Switching Versions

Users can only access the modern version if:
1. ✅ Admin has granted them access (`can_use_modern_version = true`)
2. ✅ They're logged in

When both conditions are met:
- Users can switch between versions using the "Switch to Modern" / "Switch to Legacy" buttons
- Their preference is saved in the database

## Database Schema Changes

New fields added to the `user` table:
```sql
- can_use_modern_version: BOOLEAN (default: false)
  -- Admin permission to access modern UI

- preferred_version: VARCHAR(20) (default: 'legacy')
  -- User's preferred version: 'legacy' or 'modern'
```

## API Endpoints

### Authentication
- `GET /api/v1/auth/me` - Get current user info
- `GET /api/v1/auth/login/azure` - Initiate Azure AD login
- `GET /api/v1/auth/callback` - Azure AD callback
- `POST /api/v1/auth/logout` - Logout user
- `POST /api/v1/auth/set-version-preference` - Set user's version preference

### Admin
- `POST /admin/users/<id>/toggle-modern-access` - Grant/revoke modern UI access

## Development Workflow

### Gradual Migration Strategy

1. **Phase 1**: Setup (✅ Complete)
   - React + Vite frontend initialized
   - API endpoints created
   - Authentication working
   - Admin controls implemented

2. **Phase 2**: Feature Migration (🚧 In Progress)
   - Dashboard with real data
   - Expense submission
   - Expense history
   - Manager approvals

3. **Phase 3**: Full Migration
   - All features implemented
   - Testing and refinement
   - Gradual user migration

### Adding New Features to Modern UI

1. Create React components in `frontend/src/components/`
2. Create API endpoints in `routes/api_v1/`
3. Update Dashboard to show new features
4. Test with users who have modern access

## File Structure

```
labos/
├── app.py                    # Flask backend (serves both versions)
├── routes/
│   ├── api_v1/              # REST API for modern frontend
│   │   ├── __init__.py
│   │   └── auth.py          # Authentication endpoints
│   └── expense.py           # Legacy expense routes
├── frontend/                # Modern React frontend
│   ├── src/
│   │   ├── App.jsx         # Main React app
│   │   ├── pages/
│   │   │   ├── Login.jsx   # Login page
│   │   │   └── Dashboard.jsx # Dashboard page
│   │   └── index.css       # Global styles
│   ├── vite.config.js      # Vite configuration
│   └── package.json        # Frontend dependencies
├── templates/               # Legacy Jinja2 templates
├── dev.sh                   # Development script
└── DUAL_VERSION_GUIDE.md   # This file
```

## Configuration

### Vite Proxy (frontend/vite.config.js)

```javascript
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:5000',
      changeOrigin: true,
    }
  }
}
```

This forwards all `/api/*` requests from React to Flask backend.

### CORS (app.py)

```python
CORS(app, resources={
    r"/api/v1/*": {
        "origins": ["http://localhost:3000"],
        "supports_credentials": True
    }
})
```

Allows React frontend to make authenticated API calls.

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9

# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### React Not Connecting to API

1. Check that Flask is running on port 5000
2. Verify proxy configuration in `vite.config.js`
3. Check browser console for CORS errors

### User Can't Access Modern Version

1. Verify admin granted access (check rocket icon in Manage Users)
2. Check `can_use_modern_version` field in database:
   ```sql
   SELECT username, can_use_modern_version, preferred_version
   FROM "user";
   ```

## Manual Installation Steps

If `dev.sh` doesn't work:

### Backend
```bash
cd /Users/talsabag/labos
source venv/bin/activate
python app.py
```

### Frontend
```bash
cd /Users/talsabag/labos/frontend
npm install  # First time only
npm run dev
```

## Security Notes

- Modern version uses same authentication as legacy (Azure AD)
- Sessions are shared between both versions
- Admin controls prevent unauthorized access
- CORS is restricted to localhost:3000 in development

## Future Enhancements

- [ ] Production build configuration
- [ ] Environment-based proxy configuration
- [ ] User analytics (which version is more popular)
- [ ] Feature flags for gradual rollout
- [ ] A/B testing capabilities
