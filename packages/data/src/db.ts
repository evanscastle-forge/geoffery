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
  return store;
}
