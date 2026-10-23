ALTER TABLE maintenance_tickets ADD COLUMN IF NOT EXISTS customer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_maint_customer_user ON maintenance_tickets(customer_user_id);
