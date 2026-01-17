#!/bin/bash

echo "🚀 Starting Budget Management System..."

# Display environment information
echo "📊 Environment Information:"
echo "- User: $(whoami)"
echo "- Python Version: $(python3 --version)"
echo "- Current Directory: $(pwd)"
echo "- Time: $(date)"

# Kill any existing Flask processes
echo "🔄 Cleaning up existing processes..."
pkill -f flask

# Kill any process running on port 5000
echo "🔪 Killing any process running on port 5000..."
lsof -ti:5000 | xargs kill -9 2>/dev/null || true

# Activate virtual environment and run Flask
echo "🌐 Activating virtual environment..."
if [ -d ".venv" ]; then
    source .venv/bin/activate
elif [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "❌ Virtual environment not found (.venv or venv). Please create one first."
    exit 1
fi

# Set environment variables
echo "⚙️ Configuring environment variables..."
export FLASK_APP=app.py
export FLASK_ENV=development

# Start Flask application
echo "🌟 Starting Flask application..."
echo "Access the application at https://localhost:5000"
echo "Press Ctrl+C to stop the server"
echo "----------------------------------------"

# Check if SSL certificates exist, otherwise run without SSL
if [ -f "ssl/cert.pem" ] && [ -f "ssl/key.pem" ]; then
    flask run --host=0.0.0.0 --port=5000 --cert=ssl/cert.pem --key=ssl/key.pem
else
    echo "⚠️  SSL certificates not found in ssl/ directory. Running on HTTP..."
    flask run --host=0.0.0.0 --port=5000
fi
