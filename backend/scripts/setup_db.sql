-- Create the database user (if not exists)
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'paper_trading') THEN

      CREATE ROLE paper_trading LOGIN PASSWORD 'paper_trading_password';
   END IF;
END
$do$;

-- Create the database
SELECT 'CREATE DATABASE paper_trading_db OWNER paper_trading'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'paper_trading_db')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE paper_trading_db TO paper_trading;
