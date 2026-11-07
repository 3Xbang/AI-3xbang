-- fix_quantities_schema.sql
-- Idempotent migration: add columns required for the quantities / BOQ feature.
-- Safe to run multiple times — all statements use IF NOT EXISTS guards.
-- Apply via: psql $DATABASE_URL -f database/fix_quantities_schema.sql

-- ── process_execution ──────────────────────────────────────────────────────
-- planned_quantity  : user-entered planned work quantity (numeric)
-- quantity_unit     : unit of measure string, e.g. "m²", "m³", "ตร.ม."
-- total_completed   : sum of daily_progress.quantity_completed (cached)
-- completion_percentage : 0-100 derived from total_completed / planned_quantity

ALTER TABLE process_execution
  ADD COLUMN IF NOT EXISTS planned_quantity     NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS quantity_unit        VARCHAR(32),
  ADD COLUMN IF NOT EXISTS total_completed      NUMERIC(14, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_percentage NUMERIC(5, 2)  DEFAULT 0;

-- ── process_nodes ──────────────────────────────────────────────────────────
-- master_code  : new-style BOQ code, e.g. "A01", "C03"  (pre-existing in newer DBs)
-- floor_no     : floor number for multi-floor nodes     (pre-existing in newer DBs)
-- is_custom    : true when node was added manually by the PM (not from master list)
-- sequence_number : display order within the project    (pre-existing in newer DBs)

ALTER TABLE process_nodes
  ADD COLUMN IF NOT EXISTS master_code      VARCHAR(8),
  ADD COLUMN IF NOT EXISTS floor_no         INTEGER,
  ADD COLUMN IF NOT EXISTS is_custom        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sequence_number  INTEGER;

-- Index to speed up BOQ-vs-actuals aggregation queries
CREATE INDEX IF NOT EXISTS idx_process_nodes_master
  ON process_nodes (project_id, master_code);
