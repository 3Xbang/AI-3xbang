CREATE TABLE IF NOT EXISTS drawing_revisions (
  id SERIAL PRIMARY KEY,
  drawing_id INTEGER NOT NULL REFERENCES design_drawings(id) ON DELETE CASCADE,
  note_text TEXT,
  image_url VARCHAR(500),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_by_name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_drawing_revisions ON drawing_revisions(drawing_id);
