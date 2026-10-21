-- Migration: add quote and scheduling fields to maintenance_tickets
-- Apply with: psql $DATABASE_URL -f add_maintenance_fields.sql

ALTER TABLE maintenance_tickets ADD COLUMN IF NOT EXISTS location        VARCHAR(200);
ALTER TABLE maintenance_tickets ADD COLUMN IF NOT EXISTS category        VARCHAR(50);
ALTER TABLE maintenance_tickets ADD COLUMN IF NOT EXISTS quote_amount    DECIMAL(10,2);
ALTER TABLE maintenance_tickets ADD COLUMN IF NOT EXISTS quote_status    VARCHAR(20) DEFAULT 'no_quote';
ALTER TABLE maintenance_tickets ADD COLUMN IF NOT EXISTS quote_approved_at TIMESTAMPTZ;
ALTER TABLE maintenance_tickets ADD COLUMN IF NOT EXISTS scheduled_date  DATE;
ALTER TABLE maintenance_tickets ADD COLUMN IF NOT EXISTS completion_note TEXT;
ALTER TABLE maintenance_tickets ADD COLUMN IF NOT EXISTS warranty_months INTEGER;
