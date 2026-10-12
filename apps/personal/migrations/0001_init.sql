-- Personal site schema. All personal data lives here.

CREATE TABLE tokens (
  id INTEGER PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  page TEXT NOT NULL,
  batch TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  scans INTEGER NOT NULL DEFAULT 0,
  last_scan_at TEXT,
  UNIQUE (page, batch)
);

CREATE TABLE families (
  id INTEGER PRIMARY KEY,
  source_page TEXT,
  batch TEXT,
  first_contact_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE adults (
  id INTEGER PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  whatsapp TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  broadcast_opt_in INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX adults_family ON adults(family_id);
CREATE INDEX adults_email ON adults(email);
CREATE INDEX adults_phone ON adults(phone);

CREATE TABLE children (
  id INTEGER PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  knows TEXT NOT NULL DEFAULT '',
  met_where TEXT
);
CREATE INDEX children_family ON children(family_id);

CREATE TABLE submissions (
  id INTEGER PRIMARY KEY,
  page TEXT NOT NULL,
  batch TEXT NOT NULL,
  lang TEXT NOT NULL,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  child_name TEXT,
  met_where TEXT,
  good_times TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX submissions_status ON submissions(status, created_at);

CREATE TABLE interactions (
  id INTEGER PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  kind TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT ''
);
CREATE INDEX interactions_family ON interactions(family_id, at);

CREATE TABLE reminders (
  id INTEGER PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  due_on TEXT NOT NULL,
  text TEXT NOT NULL,
  done_at TEXT,
  notified_at TEXT
);
CREATE INDEX reminders_due ON reminders(done_at, due_on);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE family_tags (
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (family_id, tag_id)
);
