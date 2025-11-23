#!/bin/bash

# System Status Checker for Dual-Version Setup

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}================================="
echo -e "Dual-Version System Status Check"
echo -e "=================================${NC}\n"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Port $1 is in use"
        return 0
    else
        echo -e "${RED}✗${NC} Port $1 is not in use"
        return 1
    fi
}

# Function to check if a file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        return 0
    else
        echo -e "${RED}✗${NC} $2 (missing: $1)"
        return 1
    fi
}

# Function to check directory
check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        return 0
    else
        echo -e "${RED}✗${NC} $2 (missing: $1)"
        return 1
    fi
}

echo -e "${YELLOW}1. Prerequisites${NC}"
command_exists python3 && echo -e "${GREEN}✓${NC} Python3 installed" || echo -e "${RED}✗${NC} Python3 not found"
command_exists node && echo -e "${GREEN}✓${NC} Node.js installed ($(node -v))" || echo -e "${RED}✗${NC} Node.js not found"
command_exists npm && echo -e "${GREEN}✓${NC} npm installed ($(npm -v))" || echo -e "${RED}✗${NC} npm not found"
[ -d "venv" ] && echo -e "${GREEN}✓${NC} Python virtual environment exists" || echo -e "${RED}✗${NC} Python venv not found"

echo ""
echo -e "${YELLOW}2. Core Files${NC}"
check_file "app.py" "Flask application"
check_file "requirements.txt" "Python dependencies"
check_file "models.py" "Database models"
check_file "dev.sh" "Development script"

echo ""
echo -e "${YELLOW}3. Frontend Setup${NC}"
check_dir "frontend" "Frontend directory"
check_file "frontend/package.json" "Frontend package.json"
check_file "frontend/vite.config.js" "Vite configuration"
check_file "frontend/src/App.jsx" "React App component"
check_file "frontend/src/pages/Dashboard.jsx" "Dashboard component"
check_dir "frontend/node_modules" "Node modules installed"

echo ""
echo -e "${YELLOW}4. API Routes${NC}"
check_dir "routes/api_v1" "API v1 directory"
check_file "routes/api_v1/__init__.py" "API blueprint"
check_file "routes/api_v1/auth.py" "Auth endpoints"
check_file "routes/api_v1/expenses.py" "Expense endpoints"

echo ""
echo -e "${YELLOW}5. Templates${NC}"
check_file "templates/base.html" "Base template (with modern banner)"
check_file "templates/manage_users.html" "User management template"
check_file "templates/login.html" "Login template"

echo ""
echo -e "${YELLOW}6. Database Schema${NC}"
if command_exists psql; then
    # Check if database columns exist
    echo -e "${BLUE}Checking database for version preference fields...${NC}"

    # This would require database connection details
    echo -e "${YELLOW}⚠${NC}  Manual check needed: Verify 'can_use_modern_version' and 'preferred_version' columns exist in user table"
else
    echo -e "${YELLOW}⚠${NC}  PostgreSQL client not found, skipping database check"
fi

echo ""
echo -e "${YELLOW}7. Running Services${NC}"
check_port 5000 && FLASK_RUNNING=1 || FLASK_RUNNING=0
check_port 3000 && REACT_RUNNING=1 || REACT_RUNNING=0

echo ""
echo -e "${YELLOW}8. Accessibility${NC}"
if [ $FLASK_RUNNING -eq 1 ]; then
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000 | grep -q "200\|302"; then
        echo -e "${GREEN}✓${NC} Flask backend responding"
    else
        echo -e "${YELLOW}⚠${NC}  Flask running but not responding correctly"
    fi
else
    echo -e "${RED}✗${NC} Flask backend not accessible"
fi

if [ $REACT_RUNNING -eq 1 ]; then
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
        echo -e "${GREEN}✓${NC} React frontend responding"
    else
        echo -e "${YELLOW}⚠${NC}  React running but not responding correctly"
    fi
else
    echo -e "${RED}✗${NC} React frontend not accessible"
fi

echo ""
echo -e "${YELLOW}9. Documentation${NC}"
check_file "DUAL_VERSION_GUIDE.md" "Full setup guide"
check_file "QUICK_START.md" "Quick start guide"

echo ""
echo -e "${BLUE}=================================${NC}"
echo -e "${YELLOW}Summary${NC}"
echo ""

if [ $FLASK_RUNNING -eq 1 ] && [ $REACT_RUNNING -eq 1 ]; then
    echo -e "${GREEN}✓ Both services are running!${NC}"
    echo ""
    echo -e "  Legacy UI:  ${BLUE}http://localhost:5000${NC}"
    echo -e "  Modern UI:  ${BLUE}http://localhost:3000${NC}"
    echo -e "  API:        ${BLUE}http://localhost:5000/api/v1${NC}"
elif [ $FLASK_RUNNING -eq 0 ] && [ $REACT_RUNNING -eq 0 ]; then
    echo -e "${YELLOW}⚠ Services are not running${NC}"
    echo ""
    echo -e "  To start both services, run: ${GREEN}./dev.sh${NC}"
else
    echo -e "${YELLOW}⚠ Only some services are running${NC}"
    [ $FLASK_RUNNING -eq 1 ] && echo -e "  Flask: ${GREEN}Running${NC}" || echo -e "  Flask: ${RED}Stopped${NC}"
    [ $REACT_RUNNING -eq 1 ] && echo -e "  React: ${GREEN}Running${NC}" || echo -e "  React: ${RED}Stopped${NC}"
fi

echo ""
echo -e "${BLUE}=================================${NC}"
