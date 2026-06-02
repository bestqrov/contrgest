-- FieldOps DB Initialization Script
-- Run once by PostgreSQL on first container start

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for faster text search
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- for GIN indexes on multiple columns

-- Create audit trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Grant permissions to app user (Prisma will handle schema via migrations)
GRANT ALL PRIVILEGES ON DATABASE fieldops_db TO fieldops;
