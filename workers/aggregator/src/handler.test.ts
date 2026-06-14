// Integration coverage for the async storage seam (D1-shaped): the aggregator's
// keyset-paginated scan + batched writes, the scorer's read-then-batch path, and
// the consult logger — all over the real SqliteStore async interface. Guards the
// localhost→Cloudflare seam conversion (D1/R2 are async-only).

import { describe, expect, it } from "vitest";
import type { Snapshot } from "@geoffery/core";
import { insertSnapshots, openStore, upsertLatestStatement, type SqliteStore } from "@geoffery/data";
import { runAggregate } from "./handler.ts";
import { runScorer } from "../../scorer/src/handler.ts";
import { logConsultation } from "../../consult/src/handler.ts";

function seedItem(store: SqliteStore, id: number, slug: string): void {
  store.runSync(
    "INSERT INTO items (id, name, slug, members, updated_at) VALUES (?,?,?,0,0)",
    id,
    `Item ${id}`,
    slug,
  );
}

function buckets(itemId: number, count: number, startTs: number): Snapshot[] {
  const out: Snapshot[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ itemId, ts: startTs + i * 300, avgHigh: 110, avgLow: 90, highVol: 5, lowVol: 5 });
  }
  return out;
}

describe("aggregator async seam", () => {
  it("groups every row per item across the keyset scan's page boundary", async () => {
    const store = openStore(":memory:");
    const now = 1_700_000_000;
    const startTs = now - 20 * 86400; // inside the 30d window
    // Counts chosen so the total (12_200) exceeds the 10_000-row SCAN_PAGE and the
    // page boundary lands *inside* item 2's run — the case keyset grouping must
    // survive. node:sqlite's bulk path makes the 12k-row seed cheap.
    const plan: [number, string, number][] = [
      [1, "item-1", 6000],
      [2, "item-2", 6000],
      [3, "item-3", 200],
    ];
    for (const [id, slug, n] of plan) {
      seedItem(store, id, slug);
      insertSnapshots(store, buckets(id, n, startTs));
    }
    await store.batch(
      plan.map(([id]) =>
        upsertLatestStatement({ itemId: id, high: 110, highTs: now, low: 90, lowTs: now, fetchedAt: now }),
      ),
    );

    const written = await runAggregate(store, now);
    expect(written).toBe(3);

    const rows = await store.all<{ item_id: number; sample_count: number }>(
      "SELECT item_id, sample_count FROM aggregates ORDER BY item_id",
    );
    expect(rows.map((r) => r.item_id)).toEqual([1, 2, 3]);
    // sample_count == rows scanned for that item → proves no row was dropped or
    // misattributed at the page boundary.
    expect(rows.map((r) => r.sample_count)).toEqual([6000, 6000, 200]);
    store.close();
  });
});

describe("scorer + consult async seam", () => {
  it("logs a consultation, scores its closed window, and rebuilds calibration", async () => {
    const store = openStore(":memory:");
    const t0 = 1_700_000_000;
    seedItem(store, 100, "test-item");

    // A buy at 100 with a market bucket at avgLow 90 (lowVol>0) inside the instant
    // window [t0, t0+30) → a guaranteed fill.
    insertSnapshots(store, [{ itemId: 100, ts: t0, avgHigh: 110, avgLow: 90, highVol: 5, lowVol: 5 }]);

    const res = await logConsultation(
      store,
      {
        slug: "test-item",
        side: "buy",
        tolerance: "instant",
        recommendedPrice: 100,
        regimePower: null,
        regimeStability: null,
        liquidityBand: null,
      },
      "client-abc",
      t0,
    );
    expect(res.ok).toBe(true);

    // Run after the instant window has closed.
    const stats = await runScorer(store, t0 + 31);
    expect(stats.considered).toBe(1);
    expect(stats.evaluated).toBe(1);
    expect(stats.filled).toBe(1);

    const outcome = await store.get<{ filled: number }>(
      "SELECT filled FROM consultation_outcomes WHERE consultation_id = ?",
      res.id,
    );
    expect(outcome?.filled).toBe(1);

    const calib = await store.all("SELECT * FROM calibration");
    expect(calib.length).toBeGreaterThan(0);
    store.close();
  });
});
