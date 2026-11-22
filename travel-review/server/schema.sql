CREATE TABLE IF NOT EXISTS destinations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT NOT NULL CHECK(region IN ('north','central','south','east')),
  city TEXT NOT NULL, district TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  features TEXT NOT NULL DEFAULT '[]', drawbacks TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '[]', tone TEXT NOT NULL,
  notice TEXT, origin TEXT NOT NULL CHECK(origin IN ('curated','community')),
  created_at TEXT NOT NULL, dedupe_key TEXT NOT NULL UNIQUE
) STRICT;
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL UNIQUE REFERENCES destinations(id),
  nickname TEXT NOT NULL,
  overall INTEGER NOT NULL CHECK(overall BETWEEN 1 AND 5),
  transport INTEGER CHECK(transport BETWEEN 1 AND 5),
  parking INTEGER CHECK(parking BETWEEN 1 AND 5),
  cleanliness INTEGER CHECK(cleanliness BETWEEN 1 AND 5),
  facilities INTEGER CHECK(facilities BETWEEN 1 AND 5),
  vendors INTEGER CHECK(vendors BETWEEN 1 AND 5),
  scenery INTEGER CHECK(scenery BETWEEN 1 AND 5),
  cost INTEGER CHECK(cost BETWEEN 0 AND 100000),
  content TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS place_web_snapshots (
  place_id TEXT PRIMARY KEY REFERENCES destinations(id),
  data TEXT NOT NULL, checked_at TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
