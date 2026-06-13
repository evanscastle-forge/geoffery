/// <reference types="@cloudflare/workers-types" />
//
// workers/_shared/cloudflare.ts — the Cloudflare binding layer for the portable
// worker handlers (spec §3.5 "Cloudflare portability seam"). This file lives
// OUTSIDE the */src/ tree on purpose: it is excluded from `npm run check` (it
// needs @cloudflare/workers-types, which is only installed for deploys and is
// bundled by wrangler's esbuild without a typecheck). The Node entries
// (main.node.ts) remain the localhost path and stay fully checked.
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠ SEAM STATUS — the storage seam is SYNCHRONOUS; D1/R2 are ASYNC-only.
//
// The handlers (runCollect/runAggregate/runScorer/runNews/logConsultation) and
// the packages/data repo helpers call `store.get/all/run/transaction` and
// `archive.readDay` SYNCHRONOUSLY (node:sqlite + local fs are synchronous).
// Cloudflare's D1 and R2 APIs are Promise-only. So the adapters below cannot
// satisfy the *current* sync `SqlStore`/`ArchiveStore` interfaces — making the
// workers actually EXECUTE on Cloudflare requires converting those seams (and
// the handlers + repo helpers that ride them) to async. That is a CONTRACT-level
// change owned by db/schema-smith (SYSTEM_ARCHITECTURE §3.1/§3.2), tracked in
// docs/RUNBOOK.md → "Cloudflare execution (async seam)". Until then the worker.ts
// entries fail loudly via `seamNotWired()` rather than run a half-wired path.
//
// The async adapters here are written to the real D1/R2 API so that conversion
// is mechanical: once the seam is `async`, drop the guard and `await` the handler.
// ─────────────────────────────────────────────────────────────────────────────

/** Bindings declared across ops/wrangler/*.toml. Each worker uses a subset. */
export interface Env {
  DB: D1Database;
  ARCHIVE?: R2Bucket;
  GEOFFERY_DEPLOYMENT_NAME?: string;
  GEOFFERY_USER_AGENT?: string;
  GEOFFERY_NEWS_CLASSIFIER_MODEL?: string;
  // Secret (wrangler secret put), never a [vars] entry. Optional → news degrades.
  ANTHROPIC_API_KEY?: string;
}

/** A descriptive, fail-loud guard for the not-yet-wired async seam (see above). */
export function seamNotWired(worker: string): never {
  throw new Error(
    `[${worker}] not wired for Cloudflare execution: the storage seam is ` +
      `synchronous and D1/R2 are async-only. Convert SqlStore/ArchiveStore (and ` +
      `the handlers + repo helpers) to async, then remove this guard. See ` +
      `docs/RUNBOOK.md → "Cloudflare execution (async seam)".`,
  );
}

/**
 * Async D1 adapter — the future `SqlStore` once the seam is async. D1's API maps
 * cleanly to get/all/run; `transaction(fn)` has no direct analogue (D1 exposes
 * `batch()` over an explicit statement list, not an imperative callback) and is
 * the one helper the async conversion must redesign.
 */
export class D1Store {
  constructor(private readonly db: D1Database) {}

  async get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T | undefined> {
    return (await this.db.prepare(sql).bind(...params).first<T>()) ?? undefined;
  }

  async all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]> {
    const r = await this.db.prepare(sql).bind(...params).all<T>();
    return r.results ?? [];
  }

  async run(sql: string, ...params: unknown[]): Promise<void> {
    await this.db.prepare(sql).bind(...params).run();
  }

  /** D1 batches are atomic; callers build the statement list explicitly. */
  async batch(statements: { sql: string; params?: unknown[] }[]): Promise<void> {
    await this.db.batch(statements.map((s) => this.db.prepare(s.sql).bind(...(s.params ?? []))));
  }
}

/**
 * Async R2 adapter — the future `ArchiveStore`. The on-disk codec (gzipped NDJSON
 * daily files + sha256 manifest) is owned by packages/data/src/archive.ts; this
 * adapter must reuse that codec verbatim (node:zlib is available under
 * compatibility_flags=["nodejs_compat"]) so the R2 archive is byte-identical to
 * the local one. Left as the async-conversion task rather than a second,
 * drift-prone implementation of the codec.
 */
export class R2Archive {
  constructor(private readonly bucket: R2Bucket) {}
  // readDay/streamRange/writeDay/appendDay/readManifest — wire to the shared
  // codec during the async seam conversion (see RUNBOOK).
}
