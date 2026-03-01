# Render.com Deployment Guide

This guide explains how to deploy the Labos Expense Management System to Render.com.

## Prerequisites

- Render.com account
- Git repository with your code
- Node.js and npm (for building frontend)

## Deployment Steps

### 1. Configure Build Command

In your Render service settings, set the **Build Command** to:

```bash
poetry install && cd frontend && npm install && npm run build
```

This ensures:
1. Poetry installs all Python dependencies (including gunicorn)
2. npm installs frontend dependencies
3. Frontend is built for production

**Alternative** (if you prefer separate commands):

```bash
cd frontend && npm install && npm run build
```

Note: Render should automatically run `poetry install` when it detects `pyproject.toml`, but including it explicitly ensures dependencies are installed.

### 2. Configure Start Command

**Recommended Start Command (if using Poetry):**

```bash
poetry run gunicorn app:app
```

**Alternative (if using pip/requirements.txt):**

```bash
python -m gunicorn app:app
```

**Alternative options** (if the above doesn't work):

```bash
gunicorn app:app
```

### 2a. Using requirements.txt (Recommended)

This project uses `requirements.txt` for dependencies. To ensure Render uses pip instead of Poetry:

1. **Make sure there's no `pyproject.toml` file** in the root directory
2. Render will automatically detect `requirements.txt` and use `pip install -r requirements.txt`
3. This is the simplest approach for this project

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
