-- Idempotent init: creates role and database if they don't exist yet.
-- This runs on container START (not just first init), so a stale volume
-- that already has postgres data will still get the role created properly.

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'paper_trading') THEN
        CREATE ROLE paper_trading WITH LOGIN PASSWORD 'paper_trading_password';
    END IF;
END
$$;

-- Grant necessary privileges
ALTER ROLE paper_trading CREATEDB;

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE paper_trading_db OWNER paper_trading'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'paper_trading_db')\gexec

-- Ensure the role owns the database and has full access
GRANT ALL PRIVILEGES ON DATABASE paper_trading_db TO paper_trading;
