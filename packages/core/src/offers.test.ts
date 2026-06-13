import { expect, test } from "vitest";
import {
  recommendAll,
  Z_FILL,
  FILL_PROB,
  WINDOW_BUCKETS,
  FAIR_MARGIN,
  SENTIMENT_CAP,
  SENTIMENT_K,
} from "./offers.ts";
import { robustLogVol } from "./stats.ts";
import type { SentimentSignal } from "./types.ts";

// Deterministic pseudo-random walk: per-step ~vol·U(-0.5,0.5), so σ̂ ≈ 0.29·vol and
// the 30-day range is wide enough that the barrier offers sit above the empirical clamp.
function walk(start: number, n: number, vol: number, seed0 = 12345): number[] {
  let x = start, seed = seed0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const u = seed / 0x7fffffff - 0.5;
    x = Math.max(1, x * (1 + vol * u));
    out.push(Math.round(x));
  }
  return out;
}

test("Z_FILL is the 90% barrier coefficient (≈0.1257)", () => {
  expect(FILL_PROB).toBe(0.9);
  expect(Z_FILL).toBeCloseTo(0.12566, 4);
});

test("instant offers are the spread (insta-buy / insta-sell)", () => {
  const mids = walk(1_000_000, 400, 0.01);
  const { prices } = recommendAll(1_005_000, 995_000, mids, null);
  expect(prices.instant_buy).toBe(1_005_000);
  expect(prices.instant_sell).toBe(995_000);
});

test("strong monotonicity holds for buys and sells across all tolerances + sentiment", () => {
  for (let s = 0; s < 40; s++) {
    const series = walk(1000 + s * 137, 300, 0.005 + (s % 5) * 0.004, 1000 + s);
    const sent: SentimentSignal | null =
      s % 3 === 0 ? null : { dir: (s % 2 ? 1 : -1) as 1 | -1, strength: (s % 10) / 10, ageDays: s % 14 };
    const last = series[series.length - 1]!;
    const { prices } = recommendAll(Math.round(last * 1.003), Math.round(last * 0.997), series, sent);
    const order = ["instant", "hours", "patient", "extended"] as const;
    const buys = order.map((t) => prices[`${t}_buy`]).filter((v): v is number => v !== undefined);
    const sells = order.map((t) => prices[`${t}_sell`]).filter((v): v is number => v !== undefined);
    for (let i = 1; i < buys.length; i++) expect(buys[i]!).toBeLessThanOrEqual(buys[i - 1]!);
    for (let i = 1; i < sells.length; i++) expect(sells[i]!).toBeGreaterThanOrEqual(sells[i - 1]!);
  }
});

test("longer waits get a better price (cheaper buy, dearer sell)", () => {
  const series = walk(500_000, 400, 0.015);
  const last = series[series.length - 1]!;
  const { prices } = recommendAll(Math.round(last * 1.004), Math.round(last * 0.996), series, null);
  expect(prices.extended_buy!).toBeLessThan(prices.hours_buy!);
  expect(prices.extended_sell!).toBeGreaterThan(prices.hours_sell!);
});

test("sentiment is ~inert at the instant horizon, strong at the extended horizon", () => {
  const series = walk(2_000_000, 400, 0.02);
  // Put the current mid at the top of the observed range so the buy discount has
  // room below the empirical floor (otherwise both offers correctly clamp to it).
  const hi = Math.max(...series);
  const ib = hi, is = hi;
  const neutral = recommendAll(ib, is, series, null).prices;
  const pos = recommendAll(ib, is, series, { dir: 1, strength: 1, ageDays: 0 }).prices;

  expect(pos.instant_buy).toBe(neutral.instant_buy); // pinned to the spread
  const hoursShift = (pos.hours_buy! - neutral.hours_buy!) / neutral.hours_buy!;
  const extShift = (pos.extended_buy! - neutral.extended_buy!) / neutral.extended_buy!;
  expect(extShift).toBeGreaterThan(0); // positive news raises a patient buy toward market
  expect(extShift).toBeGreaterThan(hoursShift + 0.005); // and far more than the short horizon
});

test("sentiment move is capped (~5%) even for a very volatile item", () => {
  const series = walk(100_000, 400, 0.05); // σ̂ ≈ 0.014, well above the cap-trigger 0.0043
  const sigma = robustLogVol(series);
  expect(SENTIMENT_K * sigma * WINDOW_BUCKETS.extended).toBeGreaterThan(SENTIMENT_CAP); // uncapped would exceed
  const last = series[series.length - 1]!;
  const neutral = recommendAll(last, last, series, null).prices;
  const pos = recommendAll(last, last, series, { dir: 1, strength: 1, ageDays: 0 }).prices;
  const shift = Math.abs((pos.extended_buy! - neutral.extended_buy!) / neutral.extended_buy!);
  expect(shift).toBeLessThanOrEqual(SENTIMENT_CAP + 0.02);
});

test("a flat (low-vol) item near its median says market is fair", () => {
  const flat = Array(400).fill(50_000); // zero variation → tiny σ̂
  const { fair } = recommendAll(50_050, 49_950, flat, null);
  expect(fair).toContain("hours_buy");
  expect(fair).toContain("hours_sell");
});

test("offers are clamped to the observed 30-day range", () => {
  const series = walk(1_000_000, 400, 0.03);
  const lo = Math.min(...series), hi = Math.max(...series);
  const { prices } = recommendAll(1_002_000, 998_000, series, { dir: -1, strength: 1, ageDays: 0 });
  for (const t of ["hours", "patient", "extended"] as const) {
    expect(prices[`${t}_buy`]!).toBeGreaterThanOrEqual(lo - 1);
    expect(prices[`${t}_sell`]!).toBeLessThanOrEqual(hi + 1);
  }
});

test("windows are the agreed fill horizons", () => {
  expect(WINDOW_BUCKETS.hours).toBe(24); // 2h
  expect(WINDOW_BUCKETS.patient).toBe(576); // 2 days
  expect(WINDOW_BUCKETS.extended).toBe(8640); // 30 days
  expect(FAIR_MARGIN).toBeGreaterThan(0);
});
