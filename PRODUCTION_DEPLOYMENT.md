# Production Deployment Guide

This guide explains how to deploy the application in production.

## Architecture

The React frontend is built and served as static files by Flask. All routes are served from the root path `/`.

## Deployment Steps

### 1. Build the React Frontend

**For Local Testing:**
```bash
cd frontend
npm install
npm run build
```

**For Production Deployment (Recommended):**
```bash
./build.sh
```

This creates a `frontend/dist/` directory with the production build.

### 2. Deploy to Production

**Important:** The `frontend/dist/` folder must be included in your deployment!

#### For Render.com:

1. **Add Build Command** (in Render dashboard):
   ```bash
   ./build.sh
   ```
   Or manually:
   ```bash
   cd frontend && npm install && npm run build
   ```

2. **Ensure frontend/dist is included:**
   - The `dist` folder should be committed to git OR
   - Build it during Render's build process

3. **Start Command:**
   ```
   gunicorn app:app
   ```

Flask serves the built React app for all non-API routes.

### 3. Verify Deployment

- App: `https://your-domain.com/dashboard`
- API: `https://your-domain.com/api/v1`
- Health: `https://your-domain.com/health`

## How It Works

1. **Development**: React runs on `http://localhost:3000` (Vite dev server), Flask API on `http://localhost:5001`
2. **Production**: React is built and served by Flask from the root path

### Flask Routes

- `/<path>` - Serves the React app (catch-all)
- `/api/v1/*` - REST API endpoints
- `/api/expense/*` - OCR processing endpoints
- `/download/*` - File downloads
- `/health` - Health check
- Static assets are served from `frontend/dist/`

## Troubleshooting

### "Frontend dist folder not found"

Run the build command:
```bash
cd frontend && npm run build
```

### UI shows blank page

1. Check that `frontend/dist/index.html` exists
2. Check browser console for errors
3. Verify API endpoints are accessible at `/api/v1/*`

### Assets not loading

Ensure the build was done with `base: '/'` in `vite.config.js`.

## Build Configuration

The `vite.config.js` is configured with:
- `base: '/'` - All assets are served from the root
- `build.outDir: 'dist'` - Build output directory

## Notes

- The React app uses relative API paths (`/api/v1/*`), so they work in both dev and production
- CORS is configured to allow requests from the same origin in production
