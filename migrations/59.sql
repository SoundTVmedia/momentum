-- Program applications: ambassador, influencer, and sponsor intake.
CREATE TABLE IF NOT EXISTS program_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mocha_user_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('ambassador', 'influencer', 'sponsor')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN (
      'draft',
      'submitted',
      'needs_more_info',
      'under_review',
      'approved',
      'rejected',
      'archived'
    )
  ),
  form_data TEXT NOT NULL DEFAULT '{}',
  confidence_score REAL,
  review_notes TEXT,
  reviewer_id TEXT,
  submitted_at TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_program_applications_user
ON program_applications (mocha_user_id, type);

CREATE INDEX IF NOT EXISTS idx_program_applications_status
ON program_applications (status, type, submitted_at);

-- Future creator availability for sponsor marketplace matching.
CREATE TABLE IF NOT EXISTS creator_availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mocha_user_id TEXT NOT NULL,
  show_id TEXT,
  city TEXT,
  region TEXT,
  genre TEXT,
  artist_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('going', 'available', 'confirmed')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_creator_availability_user
ON creator_availability (mocha_user_id, status);

CREATE INDEX IF NOT EXISTS idx_creator_availability_show
ON creator_availability (show_id, status);

-- Future sponsor campaign interest targeting.
CREATE TABLE IF NOT EXISTS sponsor_campaign_interests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sponsor_user_id TEXT NOT NULL,
  package_type TEXT NOT NULL CHECK (
    package_type IN ('single_show', 'regional', 'genre', 'tour', 'custom')
  ),
  show_id TEXT,
  city TEXT,
  region TEXT,
  genre TEXT,
  artist_name TEXT,
  cta TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sponsor_campaign_interests_user
ON sponsor_campaign_interests (sponsor_user_id);
