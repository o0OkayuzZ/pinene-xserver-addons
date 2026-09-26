CREATE TABLE IF NOT EXISTS takuya_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  message TEXT NOT NULL CHECK (length(message) <= 1000),
  session_hash TEXT NOT NULL,
  sources_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL,
  model TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_takuya_questions_created_at
  ON takuya_questions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_takuya_questions_session_hash
  ON takuya_questions(session_hash, id DESC);
