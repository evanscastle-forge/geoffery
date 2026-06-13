import { expect, test } from "vitest";
import { watchScore, NEWS_BONUS, MIN_VALUE_TRADED_GP_24H } from "./watch.ts";

// Hand-computed fixtures (charter: quote the fixture, not a vibe).

const week = (prices: number[]): [number, number][] => prices.map((p, i) => [i * 3600, p]);

test("cheap-rune flapper scores zero volatility: 4gp ↔ 5gp is noise, not signal", () => {
  // 50m units/day × ~4gp clears the value floor, but the 1gp robust move is
  // below MIN_ABS_MOVE_GP — the cheap-item guard, specifically.
  const pts = week([4, 5, 4, 5, 4, 5, 4, 5, 4, 5]);
  expect(watchScore(pts, 50_000_000, false)).toBe(0);
});

test("cheap rune with news still surfaces via the news bonus only", () => {
  const pts = week([4, 5, 4, 5, 4, 5, 4, 5]);
  expect(watchScore(pts, 1_000_000, true)).toBe(NEWS_BONUS);
});

test("a single-tick spike scores zero: one bad print is not volatility", () => {
  // 84gp item with one 29,400gp tick among 10 points: sorted p10 (idx 1) = 84,
  // p90 (idx 8) = 84 → robust range 0.
  const pts = week([84, 84, 84, 84, 29400, 84, 84, 84, 84, 84]);
  expect(watchScore(pts, 50_000, false)).toBe(0);
});

test("sustained mover scores its robust relative range", () => {
  // 11 points 59,000..61,500 step 250 (sorted = same). p10 = idx 1 = 59,250;
  // p90 = idx 9 = 61,250; median = idx 5 = 60,250. Score = 2000/60250.
  const pts = week([59000, 59250, 59500, 59750, 60000, 60250, 60500, 60750, 61000, 61250, 61500]);
  expect(watchScore(pts, 5000, false)).toBeCloseTo(2000 / 60250, 10);
});

test("news bonus stacks on volatility", () => {
  const pts = week([59000, 59250, 59500, 59750, 60000, 60250, 60500, 60750, 61000, 61250, 61500]);
  expect(watchScore(pts, 5000, true)).toBeCloseTo(2000 / 60250 + NEWS_BONUS, 10);
});

test("thin markets score zero volatility regardless of range", () => {
  // median 150,000 × 66 units = 9.9m gp/day — just under MIN_VALUE_TRADED_GP_24H.
  const pts = week([100000, 110000, 120000, 130000, 140000, 150000, 160000, 170000, 180000, 190000, 200000]);
  expect(MIN_VALUE_TRADED_GP_24H).toBe(10_000_000);
  expect(watchScore(pts, 66, false)).toBe(0);
});

test("thin history (<8 points) scores zero volatility", () => {
  expect(watchScore(week([1000, 2000, 1000]), 1_000_000, false)).toBe(0);
});

test("relative range is capped at MAX_REL_RANGE", () => {
  // 11 points 100..10,100 step 1,000: p10 = 1,100; p90 = 9,100; median = 5,100.
  // Raw ratio 8000/5100 ≈ 1.57 → capped at 1.
  const pts = week([100, 1100, 2100, 3100, 4100, 5100, 6100, 7100, 8100, 9100, 10100]);
  expect(watchScore(pts, 5000, false)).toBe(1);
});
