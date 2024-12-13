#!/bin/bash

# Kill any existing Flask processes
pkill -f flask

# Activate virtual environment and run Flask
source venv/bin/activate
export FLASK_APP=app.py
export FLASK_ENV=development
flask run
