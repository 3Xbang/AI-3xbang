-- Make project_id optional (tickets can exist without a project)
ALTER TABLE maintenance_tickets ALTER COLUMN project_id DROP NOT NULL;
-- Add customer name (free-text, no FK — tickets are standalone)
ALTER TABLE maintenance_tickets ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200);
