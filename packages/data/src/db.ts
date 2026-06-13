// SqlStore — the D1-shaped storage seam (spec §2). Local stand-in is node:sqlite.
// Workers depend only on this interface; the Cloudflare adapter implements the
// same surface over a D1 binding. No business math lives here.

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SCHEMA } from "./schema.ts";

export interface SqlStore {
  exec(sql: string): void;
  run(sql: string, ...params: unknown[]): void;
  get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined;
  all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[];
  /** Run `fn` inside a single transaction. */
  transaction(fn: () => void): void;
  close(): void;
}

export class SqliteStore implements SqlStore {
  private readonly db: DatabaseSync;

  constructor(path: string, opts: { readOnly?: boolean } = {}) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path, { readOnly: opts.readOnly ?? false });
    if (!opts.readOnly) {
      this.db.exec("PRAGMA busy_timeout = 5000;");
    }
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  run(sql: string, ...params: unknown[]): void {
    this.db.prepare(sql).run(...(params as never[]));
  }

  get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined {
    return this.db.prepare(sql).get(...(params as never[])) as T | undefined;
  }

  all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
    return this.db.prepare(sql).all(...(params as never[])) as T[];
  }

  transaction(fn: () => void): void {
    this.db.exec("BEGIN");
    try {
      fn();
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  close(): void {
    this.db.close();
  }

  /** Escape hatch for the bulk-insert path that needs a reused prepared statement. */
  prepare(sql: string) {
    return this.db.prepare(sql);
  }

  /** Stream rows for a large scan without materializing them all at once. */
  *iterate<T = Record<string, unknown>>(sql: string, ...params: unknown[]): IterableIterator<T> {
    yield* this.db.prepare(sql).iterate(...(params as never[])) as IterableIterator<T>;
  }
}

/** Open (and migrate) the local store. */
export function openStore(path: string): SqliteStore {
  const store = new SqliteStore(path);
  store.exec(SCHEMA);
  migrate(store);
  return store;
}

/**
 * Idempotent forward migrations for an existing cache DB (the schema above only
 * runs CREATE IF NOT EXISTS, so it never adds columns to a table that exists).
 * Each ADD COLUMN is wrapped to ignore the "duplicate column" error; the
 * consultations CHECK is widened by a standard table-rebuild when still the old one.
 */
function migrate(store: SqliteStore): void {
  const addColumn = (table: string, col: string, decl: string) => {
    try {
      store.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`);
    } catch (e) {
      if (!/duplicate column name/i.test(String(e))) throw e;
    }
  };
  addColumn("aggregates", "rec_extended_buy", "INTEGER");
  addColumn("aggregates", "rec_extended_sell", "INTEGER");
  addColumn("aggregates", "rec_fair_keys", "TEXT NOT NULL DEFAULT '[]'");
  addColumn("update_item_associations", "sentiment", "TEXT");

  // Widen the consultations.tolerance CHECK to include 'extended' via a standard
  // table-rebuild (recreate just this one table — never the whole SCHEMA here, which
  // carries PRAGMAs that can't run inside a transaction).
  const row = store.get<{ sql: string }>(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='consultations'",
  );
  if (row && row.sql.includes("'patient'") && !row.sql.includes("'extended'")) {
    // The prediction log is a rebuildable cache (offline-validation only since the
    // model is deterministic); recreate it empty rather than copy rows (avoids a
    // foreign-key snag on any orphaned consultation, and is far simpler).
    store.transaction(() => {
      store.exec("DROP TABLE IF EXISTS consultation_outcomes");
      store.exec("DROP TABLE IF EXISTS consultations");
      store.exec(CONSULTATIONS_CREATE);
      store.exec(CONSULTATION_OUTCOMES_CREATE);
    });
  }
}

// Kept in sync with the consultations table in schema.ts (for the CHECK-widening rebuild).
const CONSULTATIONS_CREATE = `
CREATE TABLE consultations (
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
`;

const CONSULTATION_OUTCOMES_CREATE = `
CREATE TABLE consultation_outcomes (
    consultation_id   TEXT PRIMARY KEY REFERENCES consultations(id),
    filled            INTEGER NOT NULL CHECK (filled IN (0, 1)),
    filled_at         INTEGER,
    eval_window_start INTEGER NOT NULL,
    eval_window_end   INTEGER NOT NULL,
    evaluated_at      INTEGER NOT NULL,
    synced_at         INTEGER
);
CREATE INDEX IF NOT EXISTS outcomes_filled ON consultation_outcomes(filled);
`;
