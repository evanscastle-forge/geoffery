import { expect, test } from "vitest";
import { classify, liquidityBand, marketCharacter, TREND_BADGE_THRESHOLD, volatilityLevel } from "./regime.ts";
import type { Snapshot } from "./types.ts";

const FIVE_MIN = 300;

function row(ts: number, m: number, highVol: number, lowVol: number): Snapshot {
  return { itemId: 1, ts, avgHigh: m + 5, avgLow: m - 5, highVol, lowVol };
}

function series(
  startMid: number,
  endMid: number,
  { n = 200, highVol = 10, lowVol = 10, now = 2_000_000 } = {},
): Snapshot[] {
  const rows: Snapshot[] = [];
  for (let i = 0; i < n; i++) {
    const ts = now - (n - 1 - i) * FIVE_MIN;
    const m = startMid + (endMid - startMid) * (i / Math.max(1, n - 1));
    rows.push(row(ts, Math.trunc(m), highVol, lowVol));
  }
  return rows;
}

// Deterministic gaussian (Box-Muller) with a seeded LCG, so the volatile test
// is reproducible without depending on JS Math.random.
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
function gauss(rng: () => number, mu: number, sigma: number): number {
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

test("no rows returns null", () => {
  expect(classify([], 0)).toBeNull();
});

test("steady buyer's market on downtrend with low-side volume", () => {
  const r = classify(series(1000, 940, { n: 300, highVol: 2, lowVol: 20 }), 2_000_000);
  expect(r).not.toBeNull();
  expect(r!.power).toBe("buyer");
  expect(r!.stability).toBe("steady");
});

test("steady seller's market on uptrend with high-side volume", () => {
  const r = classify(series(1000, 1080, { n: 300, highVol: 20, lowVol: 2 }), 2_000_000);
  expect(r!.power).toBe("seller");
  expect(r!.stability).toBe("steady");
});

test("balanced when flat and even", () => {
  const r = classify(series(1000, 1000, { n: 300 }), 2_000_000);
  expect(r!.power).toBe("balanced");
});

test("volatile from noisy recent window over steady baseline", () => {
  const now = 2_000_000;
  const rng = makeRng(42);
  const rows: Snapshot[] = [];
  for (let i = 0; i < 7000; i++) {
    const ts = now - (10000 - i) * FIVE_MIN;
    rows.push(row(ts, Math.trunc(1000 + gauss(rng, 0, 1)), 10, 10));
  }
  for (let i = 0; i < 900; i++) {
    const ts = now - (900 - i) * FIVE_MIN;
    rows.push(row(ts, Math.trunc(1000 + gauss(rng, 0, 50)), 10, 10));
  }
  const r = classify(rows, now);
  expect(r!.stability).toBe("volatile");
});

test("liquidity band thresholds", () => {
  expect(liquidityBand(0)).toBe("thin");
  expect(liquidityBand(999)).toBe("thin");
  expect(liquidityBand(1_000)).toBe("medium");
  expect(liquidityBand(99_999)).toBe("medium");
  expect(liquidityBand(100_000)).toBe("thick");
  expect(liquidityBand(10_000_000)).toBe("thick");
});

test("volatilityLevel buckets the relative IQR spread", () => {
  // spread = (p75 - p25) / p50
  expect(volatilityLevel(98, 100, 102)).toBe("steady"); // 4%
  expect(volatilityLevel(94, 100, 104)).toBe("some"); // 10%
  expect(volatilityLevel(85, 100, 115)).toBe("high"); // 30%
  expect(volatilityLevel(97, 100, 103)).toBe("some"); // exactly 6% (≥ boundary)
  expect(volatilityLevel(93, 100, 107)).toBe("high"); // exactly 14% (≥ boundary)
  expect(volatilityLevel(null, 100, 102)).toBe("steady"); // missing data
  expect(volatilityLevel(98, 0, 102)).toBe("steady"); // p50 ≤ 0 guard
});

test("marketCharacter flags a clear 30-day trend over the volatility level", () => {
  // −8% over 30 days → falling, even though the tight IQR alone reads "steady".
  const falling = marketCharacter(-0.08, 98, 100, 102);
  expect(falling.kind).toBe("trend");
  if (falling.kind === "trend") {
    expect(falling.direction).toBe("down");
    expect(falling.changePct).toBeCloseTo(-8, 6);
  }
  expect(marketCharacter(0.12, 98, 100, 102)).toMatchObject({ kind: "trend", direction: "up" });
});

test("marketCharacter falls back to volatility when flat or data is thin", () => {
  expect(marketCharacter(0.03, 98, 100, 102)).toEqual({ kind: "vol", level: "steady" }); // under ±5%
  expect(marketCharacter(-0.04, 94, 100, 104)).toEqual({ kind: "vol", level: "some" });
  // exactly at the threshold counts as a trend (≥)
  expect(marketCharacter(-TREND_BADGE_THRESHOLD, 98, 100, 102)).toMatchObject({ kind: "trend", direction: "down" });
  expect(marketCharacter(null, 85, 100, 115)).toEqual({ kind: "vol", level: "high" }); // null → volatility
});
