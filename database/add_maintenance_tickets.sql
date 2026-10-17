-- 1. New maintenance_tickets table
CREATE TABLE IF NOT EXISTS maintenance_tickets (
  id                  SERIAL PRIMARY KEY,
  project_id          INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title               VARCHAR(200) NOT NULL,
  description         TEXT,
  status              VARCHAR(20)  NOT NULL DEFAULT 'pending',
  priority            VARCHAR(10)  DEFAULT 'normal',
  assigned_to         INTEGER REFERENCES users(id),
  assigned_name       VARCHAR(100),
  created_by          INTEGER NOT NULL REFERENCES users(id),
  created_by_name     VARCHAR(100),
  submitted_by_owner  BOOLEAN DEFAULT FALSE,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_maint_project  ON maintenance_tickets(project_id);
CREATE INDEX IF NOT EXISTS idx_maint_assigned ON maintenance_tickets(assigned_to);

-- 2. Add ticket_id FK to photos table
ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS ticket_id INTEGER REFERENCES maintenance_tickets(id);

-- 3. Add share_type discriminator to drawing_share_tokens
ALTER TABLE drawing_share_tokens
  ADD COLUMN IF NOT EXISTS share_type VARCHAR(20) DEFAULT 'drawing';

-- 4. drawing_id must become nullable to store maintenance tokens
ALTER TABLE drawing_share_tokens
  ALTER COLUMN drawing_id DROP NOT NULL;

-- 5. Add ticket_id to drawing_share_tokens
ALTER TABLE drawing_share_tokens
  ADD COLUMN IF NOT EXISTS ticket_id INTEGER
    REFERENCES maintenance_tickets(id) ON DELETE SET NULL;
