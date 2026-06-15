// SqlStore — the D1-shaped storage seam (spec §2). This file is the PORTABLE
// interface only: workers depend on it, and both the Cloudflare adapter
// (workers/_shared/cloudflare.ts) and the local node:sqlite stand-in
// (./db.node.ts) implement it. No business math, no Node builtins, no runtime —
// so the worker bundle never reaches node:sqlite through the package barrel
// (@geoffery/data). The local store lives in ./db.node.ts (@geoffery/data/node).

// The seam is ASYNC (Cloudflare D1/R2 are Promise-only). The local node:sqlite
// adapter is synchronous under the hood, so SqliteStore keeps a fast synchronous
// CORE (`*Sync` + prepare/iterate/transactionSync) for the local-only bulk/scan
// tools, and exposes the async SqlStore interface (thin wrappers over that core)
// that the portable handlers + repo helpers ride. The D1 adapter implements the
// same async interface natively.
export interface BatchStatement {
  sql: string;
  params?: unknown[];
}

export interface SqlStore {
  exec(sql: string): Promise<void>;
  run(sql: string, ...params: unknown[]): Promise<void>;
  get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T | undefined>;
  all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]>;
  /** Atomic batch of statements (replaces the old imperative transaction(fn);
   *  D1 has no callback transaction, only an explicit statement list). */
  batch(statements: BatchStatement[]): Promise<void>;
  close(): void;
}
