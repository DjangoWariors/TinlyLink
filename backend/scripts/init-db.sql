-- TinlyLink Database Initialization
-- Creates partitions for clicks table and necessary extensions

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create function to auto-create monthly partitions
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    -- Create partitions for current month and next 3 months
    FOR i IN 0..3 LOOP
        partition_date := DATE_TRUNC('month', CURRENT_DATE + (i || ' month')::INTERVAL);
        partition_name := 'clicks_' || TO_CHAR(partition_date, 'YYYY_MM');
        start_date := partition_date;
        end_date := partition_date + INTERVAL '1 month';
        
        -- Check if partition exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = partition_name
        ) THEN
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF clicks FOR VALUES FROM (%L) TO (%L)',
                partition_name,
                start_date,
                end_date
            );
            RAISE NOTICE 'Created partition: %', partition_name;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to drop old partitions (older than 2 years)
CREATE OR REPLACE FUNCTION drop_old_partitions()
RETURNS void AS $$
DECLARE
    partition_record RECORD;
    cutoff_date DATE;
BEGIN
    cutoff_date := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '2 years');
    
    FOR partition_record IN
        SELECT c.relname AS partition_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_inherits i ON i.inhrelid = c.oid
        JOIN pg_class parent ON parent.oid = i.inhparent
        WHERE parent.relname = 'clicks'
        AND c.relname ~ '^clicks_[0-9]{4}_[0-9]{2}$'
    LOOP
        -- Extract date from partition name
        IF TO_DATE(SUBSTRING(partition_record.partition_name FROM 8), 'YYYY_MM') < cutoff_date THEN
            EXECUTE format('DROP TABLE IF EXISTS %I', partition_record.partition_name);
            RAISE NOTICE 'Dropped old partition: %', partition_record.partition_name;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Note: The clicks table and its partitions will be created by Django migrations
-- This script creates the helper functions for partition management

-- Create index for faster text search on links
-- Will be run after Django creates the tables
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_links_url_trgm ON links USING gin (original_url gin_trgm_ops);
