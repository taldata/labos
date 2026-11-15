# Render.com Deployment Guide

This guide explains how to deploy the Labos Expense Management System to Render.com.

## Prerequisites

- Render.com account
- Git repository with your code
- Node.js and npm (for building frontend)

## Deployment Steps

### 1. Dependencies

Python dependencies are managed with Poetry: `pyproject.toml` plus the committed
`poetry.lock`. The lockfile pins exact versions, so every deploy installs the same
packages. After changing a dependency, run `poetry lock` and commit `poetry.lock`.

### 2. Build, pre-deploy and start commands

`render.yaml` is the source of truth. **Commands set in the Render dashboard override
`render.yaml`**, so make sure the dashboard either matches these or is left empty:

- **Build:** `poetry install --no-root && cd frontend && npm ci && npm run build && rm -rf node_modules`
- **Pre-deploy:** `poetry run flask db upgrade`
- **Start:** `poetry run gunicorn --workers 2 --threads 4 --worker-class gthread --timeout 120 --graceful-timeout 30 --keep-alive 5 --max-requests 1000 --max-requests-jitter 50 --worker-tmp-dir /dev/shm --preload --access-logfile - --error-logfile - app:app`

A plain `poetry run gunicorn app:app` runs a single sync worker with a 30s timeout.

### 3. Environment Variables

Make sure these are set in Render:

- `FLASK_ENV=production` (or leave unset for production mode)
- `DATABASE_URL` (PostgreSQL connection string)
- `SECRET_KEY` (Flask secret key)
- Azure AD credentials (if using SSO):
  - `AZURE_AD_CLIENT_ID`
  - `AZURE_AD_CLIENT_SECRET`
  - `AZURE_AD_TENANT_ID`
- `RENDER=true` (if using Render-specific paths)

### 4. Important: Include frontend/dist in Deployment

**Option A: Build during deployment (Recommended)**

1. Set Build Command as shown above
2. Render will build the frontend automatically
3. The `dist` folder will be created during build

**Option B: Commit dist folder to git**

1. Build locally: `cd frontend && npm run build`
2. Commit the `frontend/dist/` folder to git
3. Deploy normally

### 5. Verify Deployment

After deployment, check:

- App: `https://your-app.onrender.com/dashboard`
- API: `https://your-app.onrender.com/api/v1`
- Health: `https://your-app.onrender.com/health`

## Troubleshooting

### Blank Page or 503

This means `frontend/dist/` doesn't exist. Solutions:

1. **Check Build Command**: Make sure it's set correctly in Render
2. **Check Build Logs**: Look for errors in the build process
3. **Manual Build**: SSH into your Render instance and run:
   ```bash
   cd frontend && npm install && npm run build
   ```

### Build Fails

Common issues:

1. **Node.js version**: Render might need a specific Node version
   - Add `package.json` with `"engines": { "node": ">=18" }` in frontend folder

2. **Missing dependencies**: Ensure `package.json` is in `frontend/` folder

3. **Build timeout**: Large builds might timeout
   - Consider optimizing bundle size
   - Use code splitting

### Assets Not Loading

1. Check that `vite.config.js` has `base: '/'`
2. Verify assets are in `frontend/dist/assets/`
3. Check browser console for 404 errors

## Quick Deploy Checklist

- [ ] Build command set: `cd frontend && npm install && npm run build`
- [ ] Start command set: `gunicorn app:app`
- [ ] Environment variables configured
- [ ] Database connected
- [ ] Build completes successfully (check logs)
- [ ] `frontend/dist/` folder exists after build
- [ ] App accessible at `/dashboard`

## Post-Deployment

1. **Test Login**: Verify Azure AD SSO works
2. **Test App**: Access `/dashboard` after login
3. **Check API**: Verify `/api/v1/auth/me` returns user data
4. **Monitor Logs**: Watch for any errors in Render logs

---
