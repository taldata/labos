#!/bin/bash
# Complete build script for production deployment
# This builds both the Python backend dependencies and React frontend

set -e  # Exit on error

echo "=========================================="
echo "Building Labos Expense Management System"
echo "=========================================="
echo ""

# Build React frontend
echo "📦 Building React frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
fi
npm run build
echo "✓ Frontend built successfully!"
cd ..

echo ""
echo "=========================================="
echo "✓ Build complete!"
echo "=========================================="
echo ""
echo "Frontend build output: frontend/dist/"
echo "You can now deploy the application."

