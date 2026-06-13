// Aggregator handler (spec §3): recompute the deal gauge + regime + recommendations
// for every item, writing the aggregates table the site reads. All math is
// @geoffery/core (pure); this binds storage.
//
// Performance: a single sequential scan of the trailing-30d window ordered by
// (item_id, ts), grouping consecutive rows per item — one streaming pass over the
// hot store instead of 4,572 separate indexed queries.

import { THIRTY_DAYS, computeAggregate } from "@geoffery/core";
import type { Aggregate, LatestPrice, Snapshot } from "@geoffery/core";
import {
  getLatest,
  heartbeat,
  itemIds,
  recentSentiment,
  writeAggregate,
  type SqliteStore,
} from "@geoffery/data";

// Sentiment feeds the offer model with a ~2-week decay; the gauge's brief
// "unsettled after news" window is enforced separately inside computeAggregate.
const SENTIMENT_LOOKBACK_DAYS = 14;
const ONE_DAY = 86400;

interface PriceRow {
  item_id: number;
  ts: number;
  avg_high: number | null;
  avg_low: number | null;
  high_vol: number | null;
  low_vol: number | null;
}

export function runAggregate(store: SqliteStore, now: number = Math.floor(Date.now() / 1000)): number {
  try {
    const cutoff = now - THIRTY_DAYS;
    const sentimentSince = now - SENTIMENT_LOOKBACK_DAYS * ONE_DAY;
    const sentimentMap = recentSentiment(store, sentimentSince, now);

    // Preload latest prices (small) so the scan stays single-pass.
    const allIds = itemIds(store);
    const latestMap = new Map<number, LatestPrice>();
    for (const id of allIds) {
      const l = getLatest(store, id);
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

    // Read pass: a single sequential scan, no open write transaction.
    for (const r of store.iterate<PriceRow>(
      "SELECT item_id, ts, avg_high, avg_low, high_vol, low_vol FROM prices_5m WHERE ts >= ? ORDER BY item_id, ts",
      cutoff,
    )) {
      if (r.item_id !== curItem) {
        if (curItem !== -1) flush(curItem, buf);
        curItem = r.item_id;
        buf = [];
      }
      buf.push({ itemId: r.item_id, ts: r.ts, avgHigh: r.avg_high, avgLow: r.avg_low, highVol: r.high_vol, lowVol: r.low_vol });
    }
    if (curItem !== -1) flush(curItem, buf);
    for (const id of allIds) if (!seen.has(id)) flush(id, []); // no-history items → unsettled

    // Write pass: all aggregates in one transaction.
    store.transaction(() => {
      for (const agg of results) writeAggregate(store, agg);
    });

    heartbeat(store, "aggregator", true);
    return results.length;
  } catch (e) {
    heartbeat(store, "aggregator", false, String(e));
    throw e;
  }
}
