"""SQLite open + schema. WAL mode for safe single-writer + many-reader access.

Schema is owned by data-engineer; column additions on `prices_5m` and `aggregates`
are CROSS-MODULE changes (algorithms and frontend read them).
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

from .config import DB_PATH

SCHEMA = """
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS items (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    examine     TEXT,
    members     INTEGER NOT NULL DEFAULT 0,
    ge_limit    INTEGER,
    value       INTEGER,
    highalch    INTEGER,
    lowalch     INTEGER,
    icon        TEXT,
    updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS prices_latest (
    item_id     INTEGER PRIMARY KEY REFERENCES items(id),
    high        INTEGER,
    high_ts     INTEGER,
    low         INTEGER,
    low_ts      INTEGER,
    fetched_at  INTEGER NOT NULL
);

-- 5-minute bucketed series. (item_id, ts) is the natural key.
-- avg_high / avg_low are the wiki-reported volume-weighted averages within the
-- bucket; high_vol / low_vol are unit counts traded at those sides.
CREATE TABLE IF NOT EXISTS prices_5m (
    item_id     INTEGER NOT NULL REFERENCES items(id),
    ts          INTEGER NOT NULL,
    avg_high    INTEGER,
    avg_low     INTEGER,
    high_vol    INTEGER,
    low_vol     INTEGER,
    PRIMARY KEY (item_id, ts)
);
CREATE INDEX IF NOT EXISTS prices_5m_ts ON prices_5m(ts);

-- Output of the algorithms layer; read by the frontend at build time.
CREATE TABLE IF NOT EXISTS aggregates (
    item_id         INTEGER PRIMARY KEY REFERENCES items(id),
    computed_at     INTEGER NOT NULL,
    sample_count    INTEGER NOT NULL,
    p25             REAL,
    p50             REAL,
    p75             REAL,
    current_price   REAL,
    current_percentile REAL,
    band            TEXT NOT NULL CHECK (band IN ('good','average','poor','unsettled')),
    verdict_text    TEXT NOT NULL,
    flags_json      TEXT NOT NULL DEFAULT '[]',
    volume_24h      INTEGER NOT NULL DEFAULT 0,
    volume_baseline INTEGER NOT NULL DEFAULT 0,
    -- D-011 additions: regime classification + six rounded recommendations.
    regime_power      TEXT,
    regime_stability  TEXT,
    liquidity_band    TEXT,
    rec_instant_buy   INTEGER,
    rec_instant_sell  INTEGER,
    rec_hours_buy     INTEGER,
    rec_hours_sell    INTEGER,
    rec_patient_buy   INTEGER,
    rec_patient_sell  INTEGER,
    engine_version    INTEGER NOT NULL DEFAULT 0
);

-- D-011 / D-015: consultation log. Mirrors the Cloudflare D1 schema so the
-- byte-for-byte sync direction is trivial. `client_id` is the browser's
-- anonymous UUID; rows are inserted by the Pages Function and pulled here
-- by `d1_sync.pull_consultations` for offline scoring.
CREATE TABLE IF NOT EXISTS consultations (
    id              TEXT PRIMARY KEY,
    client_id       TEXT NOT NULL,
    item_id         INTEGER NOT NULL REFERENCES items(id),
    side            TEXT NOT NULL CHECK (side IN ('buy','sell')),
    tolerance       TEXT NOT NULL CHECK (tolerance IN ('instant','hours','patient')),
    recommended_price INTEGER NOT NULL,
    regime_power      TEXT,
    regime_stability  TEXT,
    liquidity_band    TEXT,
    confidence_bucket TEXT NOT NULL,
    engine_version    INTEGER NOT NULL,
    created_at      INTEGER NOT NULL,
    synced_at       INTEGER
);
CREATE INDEX IF NOT EXISTS consultations_item ON consultations(item_id);
CREATE INDEX IF NOT EXISTS consultations_created ON consultations(created_at);

-- D-011: scorer output. One row per consultation once the tolerance window
-- has elapsed and we have enough subsequent 5m data to evaluate.
CREATE TABLE IF NOT EXISTS consultation_outcomes (
    consultation_id   TEXT PRIMARY KEY REFERENCES consultations(id),
    filled            INTEGER NOT NULL CHECK (filled IN (0, 1)),
    filled_at         INTEGER,
    eval_window_start INTEGER NOT NULL,
    eval_window_end   INTEGER NOT NULL,
    evaluated_at      INTEGER NOT NULL,
    synced_at         INTEGER
);
CREATE INDEX IF NOT EXISTS outcomes_filled ON consultation_outcomes(filled);

-- D-011: per-cohort fill rates. Cohorts key on (tolerance, side, liquidity,
-- stability) — the same tuple the recommend engine returns as
-- `confidence_bucket`. Rebuilt after every scorer pass.
CREATE TABLE IF NOT EXISTS calibration (
    cohort_key   TEXT PRIMARY KEY,
    n_total      INTEGER NOT NULL DEFAULT 0,
    n_filled     INTEGER NOT NULL DEFAULT 0,
    fill_rate    REAL    NOT NULL DEFAULT 0.0,
    updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS news_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    published_at    INTEGER NOT NULL,
    title           TEXT NOT NULL,
    summary         TEXT NOT NULL DEFAULT '',
    url             TEXT NOT NULL UNIQUE,
    categories_json TEXT NOT NULL DEFAULT '[]',
    affected_items_json TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS news_events_published_at ON news_events(published_at);

CREATE TABLE IF NOT EXISTS pipeline_health (
    job_name     TEXT PRIMARY KEY,
    last_ok_at   INTEGER NOT NULL,
    last_run_at  INTEGER NOT NULL,
    last_status  TEXT NOT NULL,
    last_error   TEXT
);
"""


# Idempotent ALTER statements for DBs created before a column was added.
# Each runs after the CREATE TABLE pass; "duplicate column name" errors are
# swallowed so re-running on a current DB is a no-op.
_MIGRATIONS = (
    "ALTER TABLE news_events ADD COLUMN summary TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE news_events ADD COLUMN affected_items_json TEXT NOT NULL DEFAULT '[]'",
    # D-011 aggregates extensions
    "ALTER TABLE aggregates ADD COLUMN regime_power TEXT",
    "ALTER TABLE aggregates ADD COLUMN regime_stability TEXT",
    "ALTER TABLE aggregates ADD COLUMN liquidity_band TEXT",
    "ALTER TABLE aggregates ADD COLUMN rec_instant_buy INTEGER",
    "ALTER TABLE aggregates ADD COLUMN rec_instant_sell INTEGER",
    "ALTER TABLE aggregates ADD COLUMN rec_hours_buy INTEGER",
    "ALTER TABLE aggregates ADD COLUMN rec_hours_sell INTEGER",
    "ALTER TABLE aggregates ADD COLUMN rec_patient_buy INTEGER",
    "ALTER TABLE aggregates ADD COLUMN rec_patient_sell INTEGER",
    "ALTER TABLE aggregates ADD COLUMN engine_version INTEGER NOT NULL DEFAULT 0",
)


def connect(path: Path = DB_PATH) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, isolation_level=None)  # autocommit; we manage txns
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    for stmt in _MIGRATIONS:
        try:
            conn.execute(stmt)
        except sqlite3.OperationalError:
            pass
    return conn


def heartbeat(conn: sqlite3.Connection, job_name: str, ok: bool, error: str | None = None) -> None:
    """Record a job heartbeat. Ops alerts on `last_ok_at` staleness."""
    import time

    now = int(time.time())
    conn.execute(
        """
        INSERT INTO pipeline_health (job_name, last_ok_at, last_run_at, last_status, last_error)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(job_name) DO UPDATE SET
            last_ok_at  = CASE WHEN excluded.last_status = 'ok' THEN excluded.last_ok_at
                               ELSE pipeline_health.last_ok_at END,
            last_run_at = excluded.last_run_at,
            last_status = excluded.last_status,
            last_error  = excluded.last_error
        """,
        (job_name, now if ok else 0, now, "ok" if ok else "error", error),
    )
