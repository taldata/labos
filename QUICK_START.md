# Quick Start Guide - Dual Version System

## 🚀 Start Both Versions

```bash
./dev.sh
```

This will start:
- **Legacy UI**: http://localhost:5000
- **Modern UI**: http://localhost:3000

Press `Ctrl+C` to stop both servers.

---

## 👨‍💼 Grant Modern UI Access (Admin)

1. Login to http://localhost:5000 as admin
2. Navigate to **Admin** menu → **Manage Users**
3. Click the 🚀 rocket icon next to a user
   - **Green rocket** = Access granted ✅
   - **Gray rocket** = No access ❌

---

## 👤 Access Modern UI (Users)

### Requirements:
1. Admin has granted you access (🚀 green rocket)
2. You're logged in

### How to Access:
- **Option 1**: Click "Try Modern UI" banner on legacy version
- **Option 2**: Visit http://localhost:3000 directly
- **Option 3**: Admin can set your preference to auto-redirect

### Switch Back:
Click "Switch to Legacy" button in modern UI header

---

## 📊 Modern Dashboard Features

The modern UI now displays **real data**:

### Stats Cards:
- 📝 **Pending Expenses** - Number of expenses awaiting approval
- ✅ **Approved** - Total approved expenses
- 💰 **Total Amount** - Current month's approved total
- 📊 **Budget Usage** - Department budget utilization %

### Recent Expenses:
- Shows last 5 expenses with:
  - Description
  - Category/Subcategory
  - Date
  - Amount
  - Status (pending/approved/rejected)

---

## 🔌 API Endpoints

### Authentication
```
GET  /api/v1/auth/me                    # Get current user
GET  /api/v1/auth/login/azure           # Azure AD login
POST /api/v1/auth/logout                # Logout
POST /api/v1/auth/set-version-preference # Set user preference
```

### Expenses
```
GET  /api/v1/expenses/summary           # Get expense summary
GET  /api/v1/expenses/recent?limit=10   # Get recent expenses
GET  /api/v1/expenses/pending-approval  # Pending approvals (managers)
GET  /api/v1/expenses/stats             # Statistics for charts
```

### Admin
```
POST /admin/users/<id>/toggle-modern-access  # Grant/revoke access
```

---

## 📁 Project Structure

```
labos/
├── app.py                       # Flask backend
├── dev.sh                       # Start both versions
│
├── routes/api_v1/              # REST API
│   ├── auth.py                 # Authentication
│   └── expenses.py             # Expense endpoints
│
├── frontend/                    # React frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   └── Dashboard.jsx
│   │   └── index.css
│   └── package.json
│
└── templates/                   # Legacy Jinja2
    ├── base.html               # Has modern UI banner
    └── manage_users.html       # Has toggle button
```

---

## 💡 Key Features

### ✅ Completed:
- Dual-version architecture
- Admin access control
- Azure AD authentication for both versions
- Real-time expense data in modern UI
- Budget tracking
- Recent expenses list
- Responsive design
- Beautiful gradient UI

### 🚧 Coming Next:
- Expense submission form
- Full expense history
- Manager approval workflow
- Charts and analytics
- Export functionality

---

## 🐛 Troubleshooting

### Port in use?
```bash
# Kill processes
lsof -ti:5000 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

### Can't access modern UI?
1. Check admin granted access (green 🚀)
2. Verify login with Azure AD
3. Check browser console for errors

### API not responding?
1. Ensure Flask is running on port 5000
2. Check Vite proxy in `frontend/vite.config.js`
3. Verify CORS settings in `app.py`

---

## 📝 Testing Checklist

- [ ] Start both servers with `./dev.sh`
- [ ] Login to legacy version
- [ ] Grant modern access to a test user (admin)
- [ ] See the "Try Modern UI" banner
- [ ] Click banner, redirects to modern UI
- [ ] Modern UI shows real expense data
- [ ] Stats cards show correct numbers
- [ ] Recent expenses list displays
- [ ] "Switch to Legacy" button works

---

## 🎯 Next Steps

1. **Test the system**: Run `./dev.sh` and verify everything works
2. **Grant access**: Give a few beta users modern UI access
3. **Gather feedback**: See what they think!
4. **Build next feature**: Start with expense submission form

---

## 📚 Documentation

- **Full Guide**: [DUAL_VERSION_GUIDE.md](DUAL_VERSION_GUIDE.md)
- **This File**: Quick reference for common tasks

---

**Need Help?** Check the logs:
- Flask: Terminal output where dev.sh is running
- React: Browser developer console (F12)
- Network: Browser Network tab to see API calls
