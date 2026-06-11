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
    volume_baseline INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS news_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    published_at    INTEGER NOT NULL,
    title           TEXT NOT NULL,
    url             TEXT NOT NULL UNIQUE,
    categories_json TEXT NOT NULL DEFAULT '[]'
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


def connect(path: Path = DB_PATH) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, isolation_level=None)  # autocommit; we manage txns
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
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
