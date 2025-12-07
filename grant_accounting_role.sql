-- Grant accounting role to a user
-- Replace 'user@example.com' with the actual email address

-- First, check the user exists
SELECT id, username, email, is_accounting
FROM "user"
WHERE email = 'user@example.com';

-- Grant the accounting role
UPDATE "user"
SET is_accounting = TRUE
WHERE email = 'user@example.com';

-- Verify the update
SELECT id, username, email, is_accounting
FROM "user"
WHERE email = 'user@example.com';
