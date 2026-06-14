// Aggregator handler (spec §3): recompute the deal gauge + regime + recommendations
// for every item, writing the aggregates table the site reads. All math is
// @geoffery/core (pure); this binds storage.
//
// Performance: a keyset-paginated scan of the trailing-30d window ordered by
// (item_id, ts) — grouping consecutive rows per item in one forward pass rather
// than 4,572 separate indexed queries. Pagination keeps each read within D1's
// per-query result limit (and bounds local memory), so the same body runs under
// Node (main.node.ts) and a Cloudflare scheduled() entry.

import { THIRTY_DAYS, computeAggregate } from "@geoffery/core";
import type { Aggregate, LatestPrice, Snapshot } from "@geoffery/core";
import {
  getLatest,
  heartbeat,
  itemIds,
  recentSentiment,
  writeAggregateStatement,
  type SqlStore,
} from "@geoffery/data";

// Sentiment feeds the offer model with a ~2-week decay; the gauge's brief
// "unsettled after news" window is enforced separately inside computeAggregate.
const SENTIMENT_LOOKBACK_DAYS = 14;
const ONE_DAY = 86400;
// Page size for the keyset scan (rows/query) and the write batch (statements/batch).
const SCAN_PAGE = 10000;
const WRITE_BATCH = 100;

interface PriceRow {
  item_id: number;
  ts: number;
  avg_high: number | null;
  avg_low: number | null;
  high_vol: number | null;
  low_vol: number | null;
}

/** Forward keyset scan of the window ordered by (item_id, ts), one bounded page
 *  at a time. (item_id, ts) is the prices_5m primary key, so each page seeks
 *  rather than re-scans, and no write transaction is held open across reads. */
async function* scanWindow(store: SqlStore, cutoff: number): AsyncIterable<PriceRow> {
  let lastItem = -1;
  let lastTs = -1;
  for (;;) {
    const rows = await store.all<PriceRow>(
      `SELECT item_id, ts, avg_high, avg_low, high_vol, low_vol FROM prices_5m
       WHERE ts >= ? AND (item_id > ? OR (item_id = ? AND ts > ?))
       ORDER BY item_id, ts LIMIT ?`,
      cutoff,
      lastItem,
      lastItem,
      lastTs,
      SCAN_PAGE,
    );
    if (rows.length === 0) return;
    for (const r of rows) yield r;
    const last = rows[rows.length - 1]!;
    lastItem = last.item_id;
    lastTs = last.ts;
    if (rows.length < SCAN_PAGE) return;
  }
}

export async function runAggregate(
  store: SqlStore,
  now: number = Math.floor(Date.now() / 1000),
): Promise<number> {
  try {
    const cutoff = now - THIRTY_DAYS;
    const sentimentSince = now - SENTIMENT_LOOKBACK_DAYS * ONE_DAY;
    const sentimentMap = await recentSentiment(store, sentimentSince, now);

    // Preload latest prices (small) so the scan stays single-pass.
    const allIds = await itemIds(store);
    const latestMap = new Map<number, LatestPrice>();
    for (const id of allIds) {
      const l = await getLatest(store, id);
      if (l) latestMap.set(id, l);
    }
    const seen = new Set<number>();
    const results: Aggregate[] = [];

    let buf: Snapshot[] = [];
    let curItem = -1;
    const flush = (itemId: number, rows: Snapshot[]) => {
      results.push(
        computeAggregate(itemId, rows, latestMap.get(itemId) ?? null, sentimentMap.get(itemId) ?? null, now),
      );
      seen.add(itemId);
    };

    // Read pass: a single forward keyset scan, no open write transaction.
    for await (const r of scanWindow(store, cutoff)) {
      if (r.item_id !== curItem) {
        if (curItem !== -1) flush(curItem, buf);
        curItem = r.item_id;
        buf = [];
      }
      buf.push({ itemId: r.item_id, ts: r.ts, avgHigh: r.avg_high, avgLow: r.avg_low, highVol: r.high_vol, lowVol: r.low_vol });
    }
    if (curItem !== -1) flush(curItem, buf);
    for (const id of allIds) if (!seen.has(id)) flush(id, []); // no-history items → unsettled

    // Write pass: all aggregates as bounded atomic batches.
    const statements = results.map(writeAggregateStatement);
    for (let i = 0; i < statements.length; i += WRITE_BATCH) {
      await store.batch(statements.slice(i, i + WRITE_BATCH));
    }

    await heartbeat(store, "aggregator", true);
    return results.length;
  } catch (e) {
    await heartbeat(store, "aggregator", false, String(e));
    throw e;
  }
}
