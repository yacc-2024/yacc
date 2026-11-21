export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  uid INTEGER,
  signup_ip TEXT,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  avatar TEXT,
  title TEXT,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'visitor',
  perms TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activation_keys (
  code TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  spec TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT,
  created_at TEXT NOT NULL,
  used_by TEXT,
  used_at TEXT,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  version INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  published_at TEXT NOT NULL,
  published_by TEXT
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_target
  ON comments (target_type, target_id, status, created_at);

CREATE TABLE IF NOT EXISTS reactions (
  user_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`
