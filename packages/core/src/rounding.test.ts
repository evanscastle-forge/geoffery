import { expect, test } from "vitest";
import fc from "fast-check";
import { roundForSide, roundSig } from "./rounding.ts";

// Golden cases ported 1:1 from reference pipeline/tests/test_rounding.py.
test("4 sig figs nearest", () => {
  expect(roundSig(1_594_231, 4, "nearest")).toBe(1_594_000);
  expect(roundSig(23_847, 4, "nearest")).toBe(23_850);
});

test("buy rounds up", () => {
  expect(roundForSide(1_594_231, "buy")).toBe(1_595_000);
  expect(roundForSide(23_847, "buy")).toBe(23_850);
  expect(roundForSide(187, "buy")).toBe(187);
});

test("sell rounds down", () => {
  expect(roundForSide(1_594_231, "sell")).toBe(1_594_000);
  expect(roundForSide(23_847, "sell")).toBe(23_840);
  expect(roundForSide(187, "sell")).toBe(187);
});

test("values at or below step are no-ops", () => {
  for (const dir of ["nearest", "up", "down"] as const) expect(roundSig(187, 4, dir)).toBe(187);
  expect(roundSig(9, 4, "up")).toBe(9);
  expect(roundSig(9999, 4, "up")).toBe(9999);
  expect(roundSig(10_000, 4, "up")).toBe(10_000);
});

test("exact step is a no-op", () => {
  expect(roundSig(1_500_000, 4, "up")).toBe(1_500_000);
  expect(roundSig(1_500_000, 4, "down")).toBe(1_500_000);
});

test("small values passthrough", () => {
  expect(roundSig(0, 4, "up")).toBe(0);
  expect(roundSig(1, 4, "up")).toBe(1);
  expect(roundSig(10, 4, "down")).toBe(10);
});

test("returns integers", () => {
  expect(Number.isInteger(roundSig(1_594_231.7, 4, "up"))).toBe(true);
  expect(Number.isInteger(roundForSide(23_847.123, "sell"))).toBe(true);
});

// Property tests (spec §5 / Phase 2 gate): buy never rounds below the value,
// sell never above; buy >= sell; output is at most 4 sig figs.
function sigFigs(n: number): number {
  if (n === 0) return 1;
  return Math.abs(n).toString().replace(/0+$/, "").replace(".", "").length;
}

test("property: buy >= value, sell <= value, buy >= sell, <=4 sig figs", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 2_147_483_647 }), (v) => {
      const buy = roundForSide(v, "buy");
      const sell = roundForSide(v, "sell");
      expect(buy).toBeGreaterThanOrEqual(v);
      expect(sell).toBeLessThanOrEqual(v);
      expect(buy).toBeGreaterThanOrEqual(sell);
      expect(sigFigs(buy)).toBeLessThanOrEqual(4);
      expect(sigFigs(sell)).toBeLessThanOrEqual(4);
    }),
    { numRuns: 2000 },
  );
});
