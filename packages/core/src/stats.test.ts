import { expect, test } from "vitest";
import { normCdf, normInv, median, robustLogVol } from "./stats.ts";

test("normCdf matches known values of Φ", () => {
  expect(normCdf(0)).toBeCloseTo(0.5, 6);
  expect(normCdf(1)).toBeCloseTo(0.8413447, 4);
  expect(normCdf(-1)).toBeCloseTo(0.1586553, 4);
  expect(normCdf(1.959964)).toBeCloseTo(0.975, 4); // the 97.5% z
  expect(normCdf(6)).toBeCloseTo(1, 6);
});

test("normInv is the inverse of normCdf", () => {
  expect(normInv(0.5)).toBeCloseTo(0, 6);
  expect(normInv(0.975)).toBeCloseTo(1.959964, 4);
  expect(normInv(0.45)).toBeCloseTo(-0.125661, 4); // drives Z_FILL
  for (const p of [0.01, 0.2, 0.5, 0.8, 0.99]) {
    expect(normCdf(normInv(p))).toBeCloseTo(p, 5);
  }
});

test("median ignores order and handles even/odd lengths", () => {
  expect(median([3, 1, 2])).toBe(2);
  expect(median([4, 1, 3, 2])).toBe(2.5);
  expect(median([])).toBe(0);
});

test("robustLogVol shrugs off a single spike", () => {
  // Varied pseudo-random ±0.15% steps → a genuine, non-degenerate baseline vol.
  let s = 7;
  const calm = Array.from({ length: 60 }, () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return Math.round(1000 * (1 + 0.003 * (s / 0x7fffffff - 0.5)));
  });
  const withSpike = [...calm];
  withSpike[30] = 5000; // one absurd print
  const a = robustLogVol(calm);
  const b = robustLogVol(withSpike);
  expect(a).toBeGreaterThan(1e-4); // genuinely non-degenerate baseline
  // The MAD-based estimate barely moves despite the 5× spike (a stdev estimate would explode).
  expect(b).toBeLessThan(a * 3);
});

test("robustLogVol returns the floor for degenerate input", () => {
  expect(robustLogVol([])).toBe(1e-4);
  expect(robustLogVol([1000, 1000, 1000, 1000])).toBe(1e-4); // zero variation
});

test("robustLogVol scales with genuine volatility", () => {
  const calm = Array.from({ length: 100 }, (_, i) => Math.round(1000 * (1 + 0.002 * ((i % 3) - 1))));
  const wild = Array.from({ length: 100 }, (_, i) => Math.round(1000 * (1 + 0.05 * ((i % 3) - 1))));
  expect(robustLogVol(wild)).toBeGreaterThan(robustLogVol(calm) * 5);
});
