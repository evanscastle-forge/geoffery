import { expect, test } from "vitest";
import { computeAggregate, THIRTY_DAYS } from "./gauge.ts";
import type { LatestPrice, Snapshot } from "./types.ts";

const NOW = 1_700_000_000;

/** Spread `mids` evenly across the trailing 30 days as 5m snapshots. */
function seed(mids: number[]): Snapshot[] {
  const rows: Snapshot[] = [];
  for (let i = 0; i < mids.length; i++) {
    const ts = NOW - THIRTY_DAYS + Math.trunc(i * (THIRTY_DAYS / Math.max(mids.length, 1)));
    rows.push({ itemId: 1, ts, avgHigh: mids[i]! + 5, avgLow: mids[i]! - 5, highVol: 100, lowVol: 100 });
  }
  return rows;
}

function latest(current: number): LatestPrice {
  return { itemId: 1, high: current + 5, highTs: NOW, low: current - 5, lowTs: NOW, fetchedAt: NOW };
}

function range(lo: number, hi: number): number[] {
  return Array.from({ length: hi - lo }, (_, i) => lo + i);
}

test("unsettled when history is thin", () => {
  const agg = computeAggregate(1, seed([100, 110, 105]), latest(108), null, NOW);
  expect(agg.band).toBe("unsettled");
  expect(agg.flags).toContain("thin-history");
});

test("good below the IQR", () => {
  const agg = computeAggregate(2, seed(range(100, 200)), latest(110), null, NOW);
  expect(agg.band).toBe("good");
  expect(agg.p25).not.toBeNull();
  expect(agg.currentPrice!).toBeLessThanOrEqual(agg.p25! + 1);
});

test("poor above the IQR", () => {
  const agg = computeAggregate(3, seed(range(100, 200)), latest(190), null, NOW);
  expect(agg.band).toBe("poor");
});

test("average within the IQR", () => {
  const agg = computeAggregate(4, seed(range(100, 200)), latest(150), null, NOW);
  expect(agg.band).toBe("average");
});

test("recent news forces unsettled regardless of band", () => {
  const agg = computeAggregate(5, seed(range(100, 200)), latest(110), { dir: 1, strength: 0.8, ageDays: 1 }, NOW);
  expect(agg.band).toBe("unsettled");
  expect(agg.flags).toContain("recent-news");
});

// Factual verdict — the stat only, no action word (action verdicts retired 2026-06-13).
test("verdict text is the median stat, no action word", () => {
  const agg = computeAggregate(6, seed(range(100, 200)), latest(110), null, NOW);
  expect(agg.verdictText).toMatch(/% (above|below) the 30-day median\.$/);
  expect(agg.verdictText.toLowerCase()).not.toMatch(/\bbuy\b|\bhold\b|\bsell\b|\bwait\b/);
});

test("produces six recommendations for a healthy item", () => {
  const agg = computeAggregate(7, seed(range(1000, 1300)), latest(1150), null, NOW);
  expect(agg.recInstantBuy).not.toBeNull();
  expect(agg.recInstantSell).not.toBeNull();
  expect(agg.recHoursBuy).not.toBeNull();
  expect(agg.recPatientSell).not.toBeNull();
  expect(agg.regimePower).not.toBeNull();
  expect(agg.liquidityBand).not.toBeNull();
});
