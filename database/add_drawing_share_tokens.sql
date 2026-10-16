-- Migration: Add drawing_share_tokens table for 24h public share links
-- Run once on: construction_simple DB
-- PGPASSWORD=Winaii2024Strong psql -U construction_user -d construction_simple -f add_drawing_share_tokens.sql

CREATE TABLE IF NOT EXISTS drawing_share_tokens (
  id            SERIAL PRIMARY KEY,
  token         VARCHAR(64) UNIQUE NOT NULL,
  drawing_id    INTEGER NOT NULL REFERENCES design_drawings(id) ON DELETE CASCADE,
  project_id    INTEGER NOT NULL,
  shared_by_name VARCHAR(100),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_share_tokens_token   ON drawing_share_tokens(token);
CREATE INDEX IF NOT EXISTS idx_share_tokens_expires ON drawing_share_tokens(expires_at);
