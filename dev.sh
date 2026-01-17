#!/bin/bash

# Development script to run both legacy and modern versions in parallel

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================"
echo -e "Labos Dual-Version Development Server"
echo -e "======================================${NC}"
echo ""
echo -e "${YELLOW}Legacy Version:${NC} http://localhost:5000"
echo -e "${YELLOW}Modern Version:${NC} http://localhost:3000"
echo ""
echo -e "${GREEN}Starting servers...${NC}"
echo ""

# Kill any existing processes on these ports
echo "Cleaning up existing processes..."
lsof -ti:5000 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down servers...${NC}"
    kill $(jobs -p) 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start Flask backend (serves both legacy templates and API)
echo -e "${GREEN}[1/2]${NC} Starting Flask backend on port 5000..."
cd /Users/talsabag/labos
if [ -d ".venv" ]; then
    source .venv/bin/activate
else
    source venv/bin/activate
fi
export FLASK_APP=app.py
export FLASK_ENV=development
python app.py &
FLASK_PID=$!

# Wait a bit for Flask to start
sleep 3

# Start React frontend
echo -e "${GREEN}[2/2]${NC} Starting React frontend on port 3000..."
cd /Users/talsabag/labos/frontend
npm run dev &
REACT_PID=$!

echo ""
echo -e "${GREEN}✓ Both servers are running!${NC}"
echo ""
echo -e "${BLUE}======================================"
echo -e "Access the applications:"
echo -e "======================================${NC}"
echo -e "${YELLOW}Legacy UI:${NC}  http://localhost:5000"
echo -e "${YELLOW}Modern UI:${NC}  http://localhost:3000"
echo -e "${YELLOW}API:${NC}        http://localhost:5000/api/v1"
echo ""
echo -e "${BLUE}Press Ctrl+C to stop both servers${NC}"
echo ""

# Wait for all background processes
wait
