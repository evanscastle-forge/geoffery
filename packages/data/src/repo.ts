// Repository helpers: typed reads/writes over SqlStore, mapping DB rows to/from
// @geoffery/core domain types. Pure adapters — no business math. The seam is async
// (D1/R2 are Promise-only); every helper awaits the store, except insertSnapshots,
// which keeps a synchronous bulk path on the concrete local SqliteStore (used only
// by the millions-of-rows backfill/restore tools that never run on Cloudflare).

import type {
  Aggregate,
  Item,
  LatestPrice,
  Snapshot,
} from "@geoffery/core";
import type { SqlStore } from "./db.ts";
import type { SqliteStore } from "./db.node.ts";

// ---- items ----

export interface ItemRow {
  id: number;
  name: string;
  slug: string;
  examine: string | null;
  members: number;
  ge_limit: number | null;
  value: number | null;
  highalch: number | null;
  lowalch: number | null;
  icon: string | null;
}

export function itemFromRow(r: ItemRow): Item {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    examine: r.examine,
    members: !!r.members,
    geLimit: r.ge_limit,
    value: r.value,
    highalch: r.highalch,
    lowalch: r.lowalch,
    icon: r.icon,
  };
}

export async function upsertItem(store: SqlStore, item: Item, now: number): Promise<void> {
  await store.run(
    `INSERT INTO items (id, name, slug, examine, members, ge_limit, value, highalch, lowalch, icon, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, examine=excluded.examine, members=excluded.members,
       ge_limit=excluded.ge_limit, value=excluded.value, highalch=excluded.highalch,
       lowalch=excluded.lowalch, icon=excluded.icon, updated_at=excluded.updated_at`,
    item.id,
    item.name,
    item.slug,
    item.examine,
    item.members ? 1 : 0,
    item.geLimit,
    item.value,
    item.highalch,
    item.lowalch,
    item.icon,
    now,
  );
}

/** Build the upsert statement for one item (for batching mapping refreshes). */
export function upsertItemStatement(item: Item, now: number): { sql: string; params: unknown[] } {
  return {
    sql: `INSERT INTO items (id, name, slug, examine, members, ge_limit, value, highalch, lowalch, icon, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name, examine=excluded.examine, members=excluded.members,
       ge_limit=excluded.ge_limit, value=excluded.value, highalch=excluded.highalch,
       lowalch=excluded.lowalch, icon=excluded.icon, updated_at=excluded.updated_at`,
    params: [
      item.id, item.name, item.slug, item.examine, item.members ? 1 : 0,
      item.geLimit, item.value, item.highalch, item.lowalch, item.icon, now,
    ],
  };
}

export async function allItems(store: SqlStore): Promise<Item[]> {
  return (await store.all<ItemRow>("SELECT * FROM items ORDER BY id")).map(itemFromRow);
}

export async function itemIds(store: SqlStore): Promise<number[]> {
  return (await store.all<{ id: number }>("SELECT id FROM items ORDER BY id")).map((r) => r.id);
}

/** Set of known item ids — used as a FK guard before bulk upserts. */
export async function itemIdSet(store: SqlStore): Promise<Set<number>> {
  return new Set((await store.all<{ id: number }>("SELECT id FROM items")).map((r) => r.id));
}

export async function itemBySlug(store: SqlStore, slug: string): Promise<Item | null> {
  const r = await store.get<ItemRow>("SELECT * FROM items WHERE slug = ?", slug);
  return r ? itemFromRow(r) : null;
}

export async function existingSlugs(store: SqlStore): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  for (const r of await store.all<{ id: number; slug: string }>("SELECT id, slug FROM items")) {
    out.set(r.id, r.slug);
  }
  return out;
}

// ---- prices_latest ----

export async function upsertLatest(store: SqlStore, p: LatestPrice): Promise<void> {
  await store.run(
    `INSERT INTO prices_latest (item_id, high, high_ts, low, low_ts, fetched_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(item_id) DO UPDATE SET
       high=excluded.high, high_ts=excluded.high_ts, low=excluded.low,
       low_ts=excluded.low_ts, fetched_at=excluded.fetched_at`,
    p.itemId,
    p.high,
    p.highTs,
    p.low,
    p.lowTs,
    p.fetchedAt,
  );
}

/** Build the upsert statement for one latest price (for batching). */
export function upsertLatestStatement(p: LatestPrice): { sql: string; params: unknown[] } {
  return {
    sql: `INSERT INTO prices_latest (item_id, high, high_ts, low, low_ts, fetched_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(item_id) DO UPDATE SET
       high=excluded.high, high_ts=excluded.high_ts, low=excluded.low,
       low_ts=excluded.low_ts, fetched_at=excluded.fetched_at`,
    params: [p.itemId, p.high, p.highTs, p.low, p.lowTs, p.fetchedAt],
  };
}

export async function getLatest(store: SqlStore, itemId: number): Promise<LatestPrice | null> {
  const r = await store.get<{
    item_id: number;
    high: number | null;
    high_ts: number | null;
    low: number | null;
    low_ts: number | null;
    fetched_at: number;
  }>("SELECT * FROM prices_latest WHERE item_id = ?", itemId);
  if (!r) return null;
  return { itemId: r.item_id, high: r.high, highTs: r.high_ts, low: r.low, lowTs: r.low_ts, fetchedAt: r.fetched_at };
}

// ---- prices_5m ----

interface PriceRow {
  item_id: number;
  ts: number;
  avg_high: number | null;
  avg_low: number | null;
  high_vol: number | null;
  low_vol: number | null;
}

function snapFromRow(r: PriceRow): Snapshot {
  return { itemId: r.item_id, ts: r.ts, avgHigh: r.avg_high, avgLow: r.avg_low, highVol: r.high_vol, lowVol: r.low_vol };
}

const INSERT_SNAPSHOT_SQL = `INSERT INTO prices_5m (item_id, ts, avg_high, avg_low, high_vol, low_vol)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(item_id, ts) DO UPDATE SET
       avg_high=excluded.avg_high, avg_low=excluded.avg_low,
       high_vol=excluded.high_vol, low_vol=excluded.low_vol`;

/** Trailing-window 5m snapshots for one item, ascending by ts. */
export async function snapshotsForItem(store: SqlStore, itemId: number, sinceTs: number): Promise<Snapshot[]> {
  return (
    await store.all<PriceRow>(
      "SELECT item_id, ts, avg_high, avg_low, high_vol, low_vol FROM prices_5m WHERE item_id = ? AND ts >= ? ORDER BY ts",
      itemId,
      sinceTs,
    )
  ).map(snapFromRow);
}

/** Snapshots for one item in [fromTs, toTs), used by the scorer's window scan. */
export async function snapshotsInWindow(store: SqlStore, itemId: number, fromTs: number, toTs: number): Promise<Snapshot[]> {
  return (
    await store.all<PriceRow>(
      "SELECT item_id, ts, avg_high, avg_low, high_vol, low_vol FROM prices_5m WHERE item_id = ? AND ts >= ? AND ts < ? ORDER BY ts",
      itemId,
      fromTs,
      toTs,
    )
  ).map(snapFromRow);
}

/** Bulk insert — SYNC fast path (one prepared statement + a txn) for the local-only
 *  backfill/restore tools (millions of rows). Portable handlers use insertSnapshotsAsync. */
export function insertSnapshots(store: SqliteStore, snaps: Iterable<Snapshot>): number {
  const stmt = store.prepare(INSERT_SNAPSHOT_SQL);
  let n = 0;
  store.transactionSync(() => {
    for (const s of snaps) {
      stmt.run(s.itemId, s.ts, s.avgHigh, s.avgLow, s.highVol, s.lowVol);
      n++;
    }
  });
  return n;
}

/** Async bulk insert for the portable collector handler (batched over the seam). */
export async function insertSnapshotsAsync(store: SqlStore, snaps: Snapshot[]): Promise<number> {
  const statements = snaps.map((s) => ({
    sql: INSERT_SNAPSHOT_SQL,
    params: [s.itemId, s.ts, s.avgHigh, s.avgLow, s.highVol, s.lowVol],
  }));
  // Chunk so a single batch stays well within D1's statement limits.
  for (let i = 0; i < statements.length; i += 100) {
    await store.batch(statements.slice(i, i + 100));
  }
  return snaps.length;
}

export async function maxSnapshotTs(store: SqlStore): Promise<number | null> {
  const r = await store.get<{ m: number | null }>("SELECT MAX(ts) AS m FROM prices_5m");
  return r?.m ?? null;
}

export async function snapshotCount(store: SqlStore): Promise<number> {
  return (await store.get<{ n: number }>("SELECT COUNT(*) AS n FROM prices_5m"))?.n ?? 0;
}

// ---- aggregates ----

const WRITE_AGGREGATE_SQL = `INSERT INTO aggregates
       (item_id, computed_at, sample_count, p25, p50, p75, current_price, current_percentile,
        band, verdict_text, flags_json, volume_24h, volume_baseline,
        regime_power, regime_stability, liquidity_band,
        rec_instant_buy, rec_instant_sell, rec_hours_buy, rec_hours_sell,
        rec_patient_buy, rec_patient_sell, rec_extended_buy, rec_extended_sell,
        rec_fair_keys, engine_version)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(item_id) DO UPDATE SET
       computed_at=excluded.computed_at, sample_count=excluded.sample_count,
       p25=excluded.p25, p50=excluded.p50, p75=excluded.p75,
       current_price=excluded.current_price, current_percentile=excluded.current_percentile,
       band=excluded.band, verdict_text=excluded.verdict_text, flags_json=excluded.flags_json,
       volume_24h=excluded.volume_24h, volume_baseline=excluded.volume_baseline,
       regime_power=excluded.regime_power, regime_stability=excluded.regime_stability,
       liquidity_band=excluded.liquidity_band,
       rec_instant_buy=excluded.rec_instant_buy, rec_instant_sell=excluded.rec_instant_sell,
       rec_hours_buy=excluded.rec_hours_buy, rec_hours_sell=excluded.rec_hours_sell,
       rec_patient_buy=excluded.rec_patient_buy, rec_patient_sell=excluded.rec_patient_sell,
       rec_extended_buy=excluded.rec_extended_buy, rec_extended_sell=excluded.rec_extended_sell,
       rec_fair_keys=excluded.rec_fair_keys,
       engine_version=excluded.engine_version`;

function aggregateParams(a: Aggregate): unknown[] {
  return [
    a.itemId, a.computedAt, a.sampleCount, a.p25, a.p50, a.p75, a.currentPrice, a.currentPercentile,
    a.band, a.verdictText, JSON.stringify(a.flags), a.volume24h, a.volumeBaseline,
    a.regimePower, a.regimeStability, a.liquidityBand,
    a.recInstantBuy, a.recInstantSell, a.recHoursBuy, a.recHoursSell,
    a.recPatientBuy, a.recPatientSell, a.recExtendedBuy, a.recExtendedSell,
    JSON.stringify(a.recFairKeys), a.engineVersion,
  ];
}

/** Build the upsert statement for one aggregate (for batched writes). */
export function writeAggregateStatement(a: Aggregate): { sql: string; params: unknown[] } {
  return { sql: WRITE_AGGREGATE_SQL, params: aggregateParams(a) };
}

export async function writeAggregate(store: SqlStore, a: Aggregate): Promise<void> {
  await store.run(WRITE_AGGREGATE_SQL, ...aggregateParams(a));
}

// ---- consultations + outcomes (prediction log + scoring) ----

import type { Consultation, Outcome, Calibration } from "@geoffery/core";

export async function insertConsultation(store: SqlStore, c: Consultation): Promise<void> {
  await store.run(
    `INSERT INTO consultations
       (id, client_id, item_id, side, tolerance, recommended_price,
        regime_power, regime_stability, liquidity_band, confidence_bucket,
        engine_version, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO NOTHING`,
    c.id,
    c.clientId,
    c.itemId,
    c.side,
    c.tolerance,
    c.recommendedPrice,
    c.regimePower,
    c.regimeStability,
    c.liquidityBand,
    c.confidenceBucket,
    c.engineVersion,
    c.createdAt,
  );
}

export interface PendingConsultation {
  id: string;
  itemId: number;
  side: "buy" | "sell";
  tolerance: "instant" | "hours" | "patient";
  recommendedPrice: number;
  confidenceBucket: string;
  createdAt: number;
}

/** Consultations lacking an outcome row (the scorer's work queue). */
export async function pendingConsultations(store: SqlStore): Promise<PendingConsultation[]> {
  return (
    await store.all<{
      id: string;
      item_id: number;
      side: "buy" | "sell";
      tolerance: "instant" | "hours" | "patient";
      recommended_price: number;
      confidence_bucket: string;
      created_at: number;
    }>(
      `SELECT c.id, c.item_id, c.side, c.tolerance, c.recommended_price, c.confidence_bucket, c.created_at
       FROM consultations c LEFT JOIN consultation_outcomes o ON o.consultation_id = c.id
       WHERE o.consultation_id IS NULL ORDER BY c.created_at`,
    )
  ).map((r) => ({
    id: r.id,
    itemId: r.item_id,
    side: r.side,
    tolerance: r.tolerance,
    recommendedPrice: r.recommended_price,
    confidenceBucket: r.confidence_bucket,
    createdAt: r.created_at,
  }));
}

const INSERT_OUTCOME_SQL = `INSERT INTO consultation_outcomes
       (consultation_id, filled, filled_at, eval_window_start, eval_window_end, evaluated_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(consultation_id) DO UPDATE SET
       filled=excluded.filled, filled_at=excluded.filled_at,
       eval_window_start=excluded.eval_window_start, eval_window_end=excluded.eval_window_end,
       evaluated_at=excluded.evaluated_at`;

function outcomeParams(o: Outcome): unknown[] {
  return [o.consultationId, o.filled ? 1 : 0, o.filledAt, o.evalWindowStart, o.evalWindowEnd, o.evaluatedAt];
}

/** Build the upsert statement for one outcome (for the scorer's batched writes). */
export function insertOutcomeStatement(o: Outcome): { sql: string; params: unknown[] } {
  return { sql: INSERT_OUTCOME_SQL, params: outcomeParams(o) };
}

export async function insertOutcome(store: SqlStore, o: Outcome): Promise<void> {
  await store.run(INSERT_OUTCOME_SQL, ...outcomeParams(o));
}

/** Replace the calibration table with freshly tabulated per-cohort fill rates. */
export async function replaceCalibration(store: SqlStore, rows: Calibration[], now: number): Promise<void> {
  await store.batch([
    { sql: "DELETE FROM calibration" },
    ...rows.map((c) => ({
      sql: "INSERT INTO calibration (cohort_key, n_total, n_filled, fill_rate, updated_at) VALUES (?,?,?,?,?)",
      params: [c.cohortKey, c.nTotal, c.nFilled, c.fillRate, now],
    })),
  ]);
}

/** All scored (consultation, outcome) pairs as cohort/filled tuples for calibration. */
export async function scoredPairs(store: SqlStore): Promise<{ confidenceBucket: string; filled: boolean }[]> {
  return (
    await store.all<{ confidence_bucket: string; filled: number }>(
      `SELECT c.confidence_bucket, o.filled FROM consultations c
       JOIN consultation_outcomes o ON o.consultation_id = c.id`,
    )
  ).map((r) => ({ confidenceBucket: r.confidence_bucket, filled: !!r.filled }));
}

// ---- recent news (for the gauge unsettled rule) ----

/** {itemId: true} for items touched by a recent wiki update (>=0.6 confidence,
 *  kind 'recent') within `since`. The RSS legacy path is intentionally dropped
 *  (see parity-checklist). */
export async function recentNewsItems(store: SqlStore, since: number): Promise<Set<number>> {
  const out = new Set<number>();
  for (const r of await store.all<{ item_id: number }>(
    `SELECT a.item_id FROM update_item_associations a
     JOIN wiki_updates u ON u.id = a.update_id
     WHERE a.confidence >= 0.6 AND u.kind = 'recent'
       AND COALESCE(u.published_at, u.discovered_at) >= ?`,
    since,
  )) {
    out.add(r.item_id);
  }
  return out;
}

// ---- wiki updates (news layer) ----

import type { WikiUpdate } from "./mediawiki.ts";

export async function upsertWikiUpdate(store: SqlStore, u: WikiUpdate): Promise<void> {
  await store.run(
    `INSERT INTO wiki_updates (id, page, title, summary, quote, kind, published_at, discovered_at, wiki_url, classified_at, engine_version)
     VALUES (?,?,?,?,?,?,?,?,?,NULL,0)
     ON CONFLICT(id) DO UPDATE SET
       summary=excluded.summary, quote=excluded.quote, kind=excluded.kind, wiki_url=excluded.wiki_url`,
    u.id,
    u.page,
    u.title,
    u.summary,
    u.quote,
    u.kind,
    u.publishedAt,
    u.discoveredAt,
    u.wikiUrl,
  );
}

export async function unclassifiedUpdates(store: SqlStore, limit: number): Promise<{ id: string; title: string; quote: string }[]> {
  return store.all<{ id: string; title: string; quote: string }>(
    "SELECT id, title, quote FROM wiki_updates WHERE classified_at IS NULL AND quote != '' ORDER BY discovered_at LIMIT ?",
    limit,
  );
}

export async function markClassified(store: SqlStore, id: string, version: number, now: number): Promise<void> {
  await store.run("UPDATE wiki_updates SET classified_at = ?, engine_version = ? WHERE id = ?", now, version, id);
}

export async function insertAssociation(
  store: SqlStore,
  updateId: string,
  itemId: number,
  confidence: number,
  justification: string,
  sentiment: string | null = null,
): Promise<void> {
  await store.run(
    `INSERT INTO update_item_associations (update_id, item_id, confidence, justification, sentiment)
     VALUES (?,?,?,?,?)
     ON CONFLICT(update_id, item_id) DO UPDATE SET
       confidence=excluded.confidence, justification=excluded.justification, sentiment=excluded.sentiment`,
    updateId,
    itemId,
    confidence,
    justification,
    sentiment,
  );
}

/**
 * Per-item news sentiment for the offer model: the most-recent high-confidence
 * 'recent' association within `since`, as `{ dir, strength, ageDays }`. dir maps
 * positive→+1 / negative→−1 / neutral|null→0; strength = classifier confidence.
 */
export async function recentSentiment(
  store: SqlStore,
  since: number,
  now: number,
): Promise<Map<number, { dir: -1 | 0 | 1; strength: number; ageDays: number }>> {
  const out = new Map<number, { dir: -1 | 0 | 1; strength: number; ageDays: number }>();
  for (const r of await store.all<{ item_id: number; confidence: number; sentiment: string | null; at: number }>(
    `SELECT a.item_id AS item_id, a.confidence AS confidence, a.sentiment AS sentiment,
            COALESCE(u.published_at, u.discovered_at) AS at
     FROM update_item_associations a
     JOIN wiki_updates u ON u.id = a.update_id
     WHERE a.confidence >= 0.6 AND u.kind = 'recent'
       AND COALESCE(u.published_at, u.discovered_at) >= ?
     ORDER BY COALESCE(u.published_at, u.discovered_at) ASC`,
    since,
  )) {
    // ASC order → the last write per item wins = the most recent update.
    const dir = r.sentiment === "positive" ? 1 : r.sentiment === "negative" ? -1 : 0;
    out.set(r.item_id, {
      dir,
      strength: Math.max(0, Math.min(1, r.confidence)),
      ageDays: Math.max(0, (now - r.at) / 86400),
    });
  }
  return out;
}

/** Hard-prune the price cache: drop prices_5m rows older than `keepDays` days. */
export async function pruneOldData(store: SqlStore, now: number, keepDays = 30): Promise<number> {
  const cutoff = now - keepDays * 86400;
  const before = await store.get<{ n: number }>("SELECT COUNT(*) AS n FROM prices_5m");
  await store.run("DELETE FROM prices_5m WHERE ts < ?", cutoff);
  const after = await store.get<{ n: number }>("SELECT COUNT(*) AS n FROM prices_5m");
  return (before?.n ?? 0) - (after?.n ?? 0);
}

/** {lowercased name -> item id} closed vocabulary for the classifier. */
export async function itemNameCatalog(store: SqlStore): Promise<{ id: number; name: string }[]> {
  return store.all<{ id: number; name: string }>("SELECT id, name FROM items ORDER BY name");
}

export async function recordLlmUsage(
  store: SqlStore,
  job: string,
  model: string,
  requestCount: number,
  inputTokens: number,
  outputTokens: number,
  now: number,
): Promise<void> {
  await store.run(
    "INSERT INTO llm_usage (ts, job, model, request_count, input_tokens, output_tokens) VALUES (?,?,?,?,?,?)",
    now,
    job,
    model,
    requestCount,
    inputTokens,
    outputTokens,
  );
}

// ---- calibration summary (methodology page + in-dialogue confidence) ----

export interface CohortStat {
  nTotal: number;
  nFilled: number;
  fillRate: number;
}

export interface CalibrationSummary {
  overall: CohortStat;
  byTolerance: Record<string, CohortStat>;
  cohorts: Record<string, CohortStat>;
  engineVersion: number;
  exportedAt: number;
}

export async function calibrationSummary(store: SqlStore, now: number): Promise<CalibrationSummary> {
  const rows = await store.all<{ cohort_key: string; n_total: number; n_filled: number }>(
    "SELECT cohort_key, n_total, n_filled FROM calibration",
  );
  const overall: CohortStat = { nTotal: 0, nFilled: 0, fillRate: 0 };
  const byTolerance: Record<string, CohortStat> = {};
  const cohorts: Record<string, CohortStat> = {};
  for (const r of rows) {
    overall.nTotal += r.n_total;
    overall.nFilled += r.n_filled;
    cohorts[r.cohort_key] = { nTotal: r.n_total, nFilled: r.n_filled, fillRate: r.n_total ? r.n_filled / r.n_total : 0 };
    const tol = r.cohort_key.split("/")[0] ?? "?";
    const t = (byTolerance[tol] ??= { nTotal: 0, nFilled: 0, fillRate: 0 });
    t.nTotal += r.n_total;
    t.nFilled += r.n_filled;
  }
  overall.fillRate = overall.nTotal ? overall.nFilled / overall.nTotal : 0;
  for (const t of Object.values(byTolerance)) t.fillRate = t.nTotal ? t.nFilled / t.nTotal : 0;
  return { overall, byTolerance, cohorts, engineVersion: 1, exportedAt: now };
}

/** Look up the fill rate for one cohort key (in-dialogue confidence). */
export async function cohortFillRate(store: SqlStore, cohortKey: string): Promise<CohortStat | null> {
  const r = await store.get<{ n_total: number; n_filled: number; fill_rate: number }>(
    "SELECT n_total, n_filled, fill_rate FROM calibration WHERE cohort_key = ?",
    cohortKey,
  );
  if (!r) return null;
  return { nTotal: r.n_total, nFilled: r.n_filled, fillRate: r.fill_rate };
}

// ---- wiki notices (item-page + in-consult acknowledgement) ----

export interface WikiNotice {
  kind: "upcoming" | "recent" | "past";
  title: string;
  summary: string;
  url: string;
  justification: string;
  confidence: number;
}

/** {itemId: notices[]} for high-confidence associations to upcoming/recent updates. */
export async function recentWikiNotices(store: SqlStore, _now: number): Promise<Map<number, WikiNotice[]>> {
  const out = new Map<number, WikiNotice[]>();
  for (const r of await store.all<{
    item_id: number;
    kind: "upcoming" | "recent" | "past";
    title: string;
    summary: string;
    wiki_url: string;
    justification: string;
    confidence: number;
  }>(
    `SELECT a.item_id, u.kind, u.title, u.summary, u.wiki_url, a.justification, a.confidence
     FROM update_item_associations a JOIN wiki_updates u ON u.id = a.update_id
     WHERE a.confidence >= 0.6 AND u.kind IN ('upcoming','recent')
     ORDER BY a.confidence DESC`,
  )) {
    const list = out.get(r.item_id) ?? [];
    list.push({
      kind: r.kind,
      title: r.title,
      summary: r.summary,
      url: r.wiki_url,
      justification: r.justification,
      confidence: r.confidence,
    });
    out.set(r.item_id, list);
  }
  return out;
}

// ---- pipeline health (heartbeat) ----

export interface HealthRow {
  job_name: string;
  last_ok_at: number;
  last_run_at: number;
  last_status: string;
  last_error: string | null;
}

export async function allHealth(store: SqlStore): Promise<HealthRow[]> {
  return store.all<HealthRow>("SELECT * FROM pipeline_health ORDER BY job_name");
}

/** Jobs whose last OK is older than `maxAgeSeconds` — the page-the-owner signal
 *  (collector death is the alert per spec §11 Phase 3). */
export async function staleJobs(store: SqlStore, maxAgeSeconds: number, now = Math.floor(Date.now() / 1000)): Promise<string[]> {
  return (await allHealth(store))
    .filter((h) => now - h.last_ok_at > maxAgeSeconds)
    .map((h) => h.job_name);
}

export async function heartbeat(store: SqlStore, job: string, ok: boolean, error?: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await store.run(
    `INSERT INTO pipeline_health (job_name, last_ok_at, last_run_at, last_status, last_error)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(job_name) DO UPDATE SET
       last_ok_at = CASE WHEN ? THEN ? ELSE pipeline_health.last_ok_at END,
       last_run_at = ?, last_status = ?, last_error = ?`,
    job,
    ok ? now : 0,
    now,
    ok ? "ok" : "error",
    error ?? null,
    ok ? 1 : 0,
    now,
    now,
    ok ? "ok" : "error",
    error ?? null,
  );
}
