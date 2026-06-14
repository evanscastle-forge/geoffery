/// <reference types="@cloudflare/workers-types" />
//
// workers/_shared/cloudflare.ts — the Cloudflare binding layer for the portable
// worker handlers (spec §3.5 "Cloudflare portability seam"). This file lives
// OUTSIDE the */src/ tree on purpose: it is excluded from `npm run check` (it
// needs @cloudflare/workers-types, which is only installed for deploys and is
// bundled by wrangler's esbuild without a typecheck). The Node entries
// (main.node.ts) remain the localhost path and stay fully checked.
//
// The storage seam is ASYNC (packages/data/src/db.ts `SqlStore` +
// archive.ts `ArchiveStore`), which D1/R2 satisfy natively. D1Store and
// R2Archive below implement those interfaces; the worker.ts entries construct
// them from the bindings and `await` the portable handler directly.

import type { ArchiveStore, BatchStatement, DayManifest, Snapshot, SqlStore } from "@geoffery/data";
import { decodeDayObject, encodeDayObject, mergeDaySnapshots, objectKeyFor } from "@geoffery/data";

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

/**
 * D1 adapter for the async `SqlStore` seam. D1's API maps cleanly to
 * get/all/run; the imperative `transaction(fn)` was redesigned into `batch()`
 * over an explicit statement list (D1's only atomic primitive).
 */
export class D1Store implements SqlStore {
  constructor(private readonly db: D1Database) {}

  async exec(sql: string): Promise<void> {
    await this.db.exec(sql);
  }

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
  async batch(statements: BatchStatement[]): Promise<void> {
    if (statements.length === 0) return;
    await this.db.batch(statements.map((s) => this.db.prepare(s.sql).bind(...(s.params ?? []))));
  }

  /** D1 has no connection to close; the binding is managed by the runtime. */
  close(): void {}
}

/**
 * R2 adapter for the async `ArchiveStore` seam. Reuses the gzipped-NDJSON day
 * codec owned by packages/data/src/archive.ts (node:zlib is available under
 * compatibility_flags=["nodejs_compat"]) so the R2 archive matches the local
 * one byte-for-byte rather than carrying a second, drift-prone codec.
 */
export class R2Archive implements ArchiveStore {
  constructor(private readonly bucket: R2Bucket) {}

  async appendDay(day: string, snapshots: Snapshot[]): Promise<DayManifest> {
    const key = objectKeyFor(day);
    const existingObj = await this.bucket.get(key);
    const existing = existingObj ? decodeDayObject(new Uint8Array(await existingObj.arrayBuffer())) : [];
    const merged = mergeDaySnapshots(existing, snapshots);
    const { body, rows, minTs, maxTs } = encodeDayObject(merged);
    await this.bucket.put(key, body);
    return { object: key, rows, minTs, maxTs };
  }
}
