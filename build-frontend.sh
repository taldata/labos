#!/bin/bash
# Build script for React frontend for production deployment

echo "Building React frontend for production..."
cd frontend
npm install
npm run build
echo "✓ Frontend built successfully!"
echo "Build output: frontend/dist/"

