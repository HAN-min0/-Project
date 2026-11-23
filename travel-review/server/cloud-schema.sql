-- Shared PostgreSQL schema. Local SQLite files are kept separately.
CREATE TABLE IF NOT EXISTS visitors (
  actor_hash TEXT PRIMARY KEY CHECK (actor_hash ~ '^[a-f0-9]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS destinations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  region TEXT NOT NULL CHECK (region IN ('north','central','south','east')),
  city TEXT NOT NULL, district TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  features JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(features) = 'array'),
  drawbacks JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(drawbacks) = 'array'),
  source TEXT NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(tags) = 'array'),
  tone TEXT NOT NULL, notice TEXT,
  origin TEXT NOT NULL CHECK (origin IN ('curated','community')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dedupe_key TEXT NOT NULL UNIQUE,
  created_by TEXT REFERENCES visitors(actor_hash)
);
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL REFERENCES destinations(id),
  actor_hash TEXT NOT NULL REFERENCES visitors(actor_hash),
  nickname TEXT NOT NULL CHECK (char_length(nickname) BETWEEN 1 AND 20),
  overall INTEGER NOT NULL CHECK (overall BETWEEN 1 AND 5),
  transport INTEGER CHECK (transport BETWEEN 1 AND 5),
  parking INTEGER CHECK (parking BETWEEN 1 AND 5),
  cleanliness INTEGER CHECK (cleanliness BETWEEN 1 AND 5),
  facilities INTEGER CHECK (facilities BETWEEN 1 AND 5),
  vendors INTEGER CHECK (vendors BETWEEN 1 AND 5),
  scenery INTEGER CHECK (scenery BETWEEN 1 AND 5),
  cost INTEGER CHECK (cost BETWEEN 0 AND 100000),
  content TEXT NOT NULL DEFAULT '' CHECK (char_length(content) <= 1000),
  tags JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(tags) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (place_id, actor_hash)
);
CREATE INDEX IF NOT EXISTS reviews_place_updated ON reviews(place_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS place_web_snapshots (
  place_id TEXT PRIMARY KEY REFERENCES destinations(id),
  data JSONB NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  checked_at DATE NOT NULL
);
CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS admin_sessions (
  session_hash TEXT PRIMARY KEY CHECK (session_hash ~ '^[a-f0-9]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON admin_sessions(expires_at);

-- The Node.js server is the data access layer. No direct anonymous Data API access.
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_web_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON visitors, destinations, reviews, place_web_snapshots, app_meta, admin_sessions FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON visitors, destinations, reviews, place_web_snapshots, app_meta, admin_sessions FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON visitors, destinations, reviews, place_web_snapshots, app_meta, admin_sessions FROM authenticated;
  END IF;
END $$;
