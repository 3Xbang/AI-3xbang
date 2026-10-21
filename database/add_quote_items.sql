-- Migration: add quote_items (JSONB) and labor_cost (DECIMAL) to maintenance_tickets
-- Idempotent: safe to run multiple times

ALTER TABLE maintenance_tickets
  ADD COLUMN IF NOT EXISTS quote_items JSONB DEFAULT '[]';

ALTER TABLE maintenance_tickets
  ADD COLUMN IF NOT EXISTS labor_cost DECIMAL(10,2) DEFAULT 0;
