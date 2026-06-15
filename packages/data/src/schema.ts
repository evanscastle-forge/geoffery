// D1 schema (spec §2). Ported verbatim from the reference `db.py` so the
// Cloudflare D1 migration is byte-trivial. The local stand-in is node:sqlite.

export const SCHEMA = `
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
    regime_power      TEXT,
    regime_stability  TEXT,
    liquidity_band    TEXT,
    rec_instant_buy   INTEGER,
    rec_instant_sell  INTEGER,
    rec_hours_buy     INTEGER,
    rec_hours_sell    INTEGER,
    rec_patient_buy   INTEGER,
    rec_patient_sell  INTEGER,
    rec_extended_buy  INTEGER,
    rec_extended_sell INTEGER,
    rec_fair_keys     TEXT NOT NULL DEFAULT '[]',
    engine_version    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS consultations (
    id              TEXT PRIMARY KEY,
    client_id       TEXT NOT NULL,
    item_id         INTEGER NOT NULL REFERENCES items(id),
    side            TEXT NOT NULL CHECK (side IN ('buy','sell')),
    tolerance       TEXT NOT NULL CHECK (tolerance IN ('instant','hours','patient','extended')),
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

CREATE TABLE IF NOT EXISTS calibration (
    cohort_key   TEXT PRIMARY KEY,
    n_total      INTEGER NOT NULL DEFAULT 0,
    n_filled     INTEGER NOT NULL DEFAULT 0,
    fill_rate    REAL    NOT NULL DEFAULT 0.0,
    updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS wiki_updates (
    id              TEXT PRIMARY KEY,
    page            TEXT NOT NULL,
    title           TEXT NOT NULL,
    summary         TEXT NOT NULL DEFAULT '',
    quote           TEXT NOT NULL DEFAULT '',
    kind            TEXT NOT NULL CHECK (kind IN ('upcoming','recent','past')),
    published_at    INTEGER,
    discovered_at   INTEGER NOT NULL,
    wiki_url        TEXT NOT NULL,
    classified_at   INTEGER,
    engine_version  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS wiki_updates_kind ON wiki_updates(kind);
CREATE INDEX IF NOT EXISTS wiki_updates_published ON wiki_updates(published_at);

CREATE TABLE IF NOT EXISTS update_item_associations (
    update_id       TEXT NOT NULL REFERENCES wiki_updates(id),
    item_id         INTEGER NOT NULL REFERENCES items(id),
    confidence      REAL NOT NULL,
    justification   TEXT NOT NULL,
    sentiment       TEXT,  -- 'positive' | 'neutral' | 'negative' (classifier output)
    PRIMARY KEY (update_id, item_id)
);
CREATE INDEX IF NOT EXISTS update_item_associations_item ON update_item_associations(item_id);

CREATE TABLE IF NOT EXISTS pipeline_health (
    job_name     TEXT PRIMARY KEY,
    last_ok_at   INTEGER NOT NULL,
    last_run_at  INTEGER NOT NULL,
    last_status  TEXT NOT NULL,
    last_error   TEXT
);

CREATE TABLE IF NOT EXISTS llm_usage (
    ts             INTEGER NOT NULL,
    job            TEXT NOT NULL,
    model          TEXT NOT NULL,
    request_count  INTEGER NOT NULL DEFAULT 0,
    input_tokens   INTEGER NOT NULL DEFAULT 0,
    output_tokens  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS llm_usage_ts ON llm_usage(ts);
CREATE INDEX IF NOT EXISTS llm_usage_job ON llm_usage(job);

-- Tips (spec §7/§8). One row per completed Stripe Checkout (id = session id, idempotent).
-- amount_cents is stored for the monthly jar/goal math + reconciliation only; amounts are
-- NEVER shown publicly. donor_name is opt-in (from Stripe customer details) — display is a
-- compliance decision. The curated packages/content donations.ts is the seed/fallback.
CREATE TABLE IF NOT EXISTS donations (
    id              TEXT PRIMARY KEY,
    amount_cents    INTEGER NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'usd',
    month           TEXT NOT NULL,
    donor_name      TEXT,
    payment_intent  TEXT,
    created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS donations_month ON donations(month);
CREATE INDEX IF NOT EXISTS donations_created ON donations(created_at);
`;
