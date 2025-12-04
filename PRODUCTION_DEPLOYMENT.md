# Production Deployment Guide - Modern UI

This guide explains how to deploy the modern React frontend in production.

## Problem

In production, the React frontend needs to be built and served as static files by Flask, not as a separate Vite dev server. The modern UI is now served at `/modern/*` routes.

## Solution

The React app is built and served from Flask at the `/modern/` route. This allows both legacy and modern UIs to run on the same domain.

## Deployment Steps

### 1. Build the React Frontend

Before deploying, build the React frontend:

```bash
cd frontend
npm install
npm run build
```

Or use the build script:

```bash
./build-frontend.sh
```

This creates a `frontend/dist/` directory with the production build.

### 2. Deploy to Production

The Flask app will automatically serve the built React app from `/modern/*` routes.

### 3. Verify Deployment

- Legacy UI: `https://your-domain.com/`
- Modern UI: `https://your-domain.com/modern/dashboard`
- API: `https://your-domain.com/api/v1`

## How It Works

1. **Development**: React runs on `http://localhost:3000` (Vite dev server)
2. **Production**: React is built and served by Flask at `/modern/*`

### Flask Routes

- `/modern/` - Serves the React app
- `/modern/<path>` - Handles React Router client-side routes
- Static assets are served from `frontend/dist/`

### Environment Detection

The app automatically detects the environment:
- **Development** (`FLASK_ENV=development`): Redirects to `localhost:3000`
- **Production**: Serves from `/modern/` route

## User Access

Users with `can_use_modern_version = True` will be automatically redirected to `/modern/dashboard` when they log in (if their `preferred_version = 'modern'`).

## Troubleshooting

### "Frontend dist folder not found"

Run the build command:
```bash
cd frontend && npm run build
```

### Modern UI shows blank page

1. Check that `frontend/dist/index.html` exists
2. Check browser console for errors
3. Verify API endpoints are accessible at `/api/v1/*`

### Assets not loading

Ensure the build was done with the correct base path (`/modern/` in `vite.config.js`).

## Build Configuration

The `vite.config.js` is configured with:
- `base: '/modern/'` - All assets are served from `/modern/`
- `build.outDir: 'dist'` - Build output directory

## Notes

- The React app uses relative API paths (`/api/v1/*`), so they work in both dev and production
- CORS is configured to allow requests from the same origin in production
- The modern UI is only accessible to users with `can_use_modern_version = True`

