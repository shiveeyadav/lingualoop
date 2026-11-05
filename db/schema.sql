-- LinguaLoop schema. Idempotent: safe to run on every start.

CREATE TABLE IF NOT EXISTS users (
  id                 SERIAL PRIMARY KEY,
  email              TEXT UNIQUE,                       -- NULL for guests; stored lower-case
  password_hash      TEXT,                              -- NULL for guests
  display_name       TEXT NOT NULL DEFAULT 'Learner',
  role               TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_guest           BOOLEAN NOT NULL DEFAULT FALSE,
  xp_total           INTEGER NOT NULL DEFAULT 0,
  streak             INTEGER NOT NULL DEFAULT 0,
  longest_streak     INTEGER NOT NULL DEFAULT 0,
  last_active_date   DATE,                              -- UK calendar date of last XP
  daily_goal         INTEGER NOT NULL DEFAULT 20 CHECK (daily_goal IN (10, 20, 30, 50)),
  sound_on           BOOLEAN NOT NULL DEFAULT TRUE,
  show_on_leaderboard BOOLEAN NOT NULL DEFAULT TRUE,
  hearts             INTEGER NOT NULL DEFAULT 5 CHECK (hearts >= 0 AND hearts <= 5),
  hearts_updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_course     TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,                         -- HMAC-SHA256 of the cookie token
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS enrollments (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course      TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, course)
);

CREATE TABLE IF NOT EXISTS lesson_completions (
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course             TEXT NOT NULL,
  lesson_id          TEXT NOT NULL,
  times              INTEGER NOT NULL DEFAULT 0,
  last_completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, course, lesson_id)
);

CREATE TABLE IF NOT EXISTS xp_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course      TEXT NOT NULL,
  source      TEXT NOT NULL CHECK (source IN ('lesson', 'practice')),
  xp          INTEGER NOT NULL CHECK (xp >= 0),
  day         DATE NOT NULL,                            -- UK calendar date
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS xp_events_user_day_idx ON xp_events(user_id, day);
CREATE INDEX IF NOT EXISTS xp_events_day_idx ON xp_events(day);

CREATE TABLE IF NOT EXISTS word_strength (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course      TEXT NOT NULL,
  word        TEXT NOT NULL,
  strength    INTEGER NOT NULL DEFAULT 0 CHECK (strength >= 0 AND strength <= 5),
  correct     INTEGER NOT NULL DEFAULT 0,
  wrong       INTEGER NOT NULL DEFAULT 0,
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, course, word)
);
CREATE INDEX IF NOT EXISTS word_strength_review_idx ON word_strength(user_id, course, strength, last_seen);
