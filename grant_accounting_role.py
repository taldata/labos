#!/usr/bin/env python3
"""
Script to grant the accounting role to a user.

Usage:
    python grant_accounting_role.py <email>

Example:
    DATABASE_URL='postgresql://...' python grant_accounting_role.py user@example.com
"""
import os
import sys
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_database_url():
    """Get database URL from environment."""
    database_url = os.getenv('DATABASE_URL', '')
    if database_url:
        # Replace postgres:// with postgresql:// for psycopg2
        return database_url.replace('postgres://', 'postgresql://')

    # Build from components
    db_user = os.getenv('DB_USER', 'postgres')
    db_password = os.getenv('DB_PASSWORD', '')
    db_host = os.getenv('DB_HOST', 'localhost')
    db_port = os.getenv('DB_PORT', '5432')
    db_name = os.getenv('DB_NAME', 'expense_manager')
    return f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

def grant_accounting_role(email):
    """Grant accounting role to user with given email."""
    database_url = get_database_url()
    print(f"Connecting to database...")

    conn = psycopg2.connect(database_url)
    cur = conn.cursor()

    try:
        # Find the user
        cur.execute('SELECT id, username, email, is_accounting FROM "user" WHERE email = %s', (email,))
        user = cur.fetchone()

        if not user:
            print(f"Error: User with email '{email}' not found.")
            return False

        user_id, username, user_email, is_accounting = user
        print(f"Found user: {username} ({user_email})")
        print(f"Current is_accounting status: {is_accounting}")

        if is_accounting:
            print("User already has accounting role.")
            return True

        # Update the user
        cur.execute('UPDATE "user" SET is_accounting = TRUE WHERE id = %s', (user_id,))
        conn.commit()

        # Verify the update
        cur.execute('SELECT is_accounting FROM "user" WHERE id = %s', (user_id,))
        new_status = cur.fetchone()[0]

        print(f"Successfully granted accounting role to {username}")
        print(f"New is_accounting status: {new_status}")
        return True

    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: python grant_accounting_role.py <email>")
        print("Example: DATABASE_URL='postgresql://...' python grant_accounting_role.py user@example.com")
        sys.exit(1)

    email = sys.argv[1]
    print(f"Granting accounting role to: {email}")
    grant_accounting_role(email)
