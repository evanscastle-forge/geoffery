import { expect, test } from "vitest";
import { fillRateByCohort, scorePrediction, WINDOWS } from "./scoring.ts";
import type { Snapshot } from "./types.ts";

function snap(itemId: number, ts: number, p: Partial<Snapshot> = {}): Snapshot {
  return { itemId, ts, avgHigh: null, avgLow: null, highVol: 10, lowVol: 10, ...p };
}

const HOUR = 3600;

test("buy fills when avg_low crosses rec price within window", () => {
  const created = 100_000;
  const rows = [snap(1, created + 5 * HOUR, { avgHigh: 1050, avgLow: 995, lowVol: 5 })];
  const o = scorePrediction(
    { id: "c1", side: "buy", tolerance: "hours", recommendedPrice: 1000, createdAt: created },
    rows,
    created + 9 * HOUR,
  );
  expect(o).not.toBeNull();
  expect(o!.filled).toBe(true);
  expect(o!.filledAt).toBe(created + 5 * HOUR);
});

test("buy not filled when nothing crosses", () => {
  const created = 200_000;
  const rows = [snap(2, created + 5 * HOUR, { avgHigh: 1100, avgLow: 1050, lowVol: 5 })];
  const o = scorePrediction(
    { id: "c2", side: "buy", tolerance: "hours", recommendedPrice: 1000, createdAt: created },
    rows,
    created + 9 * HOUR,
  );
  expect(o!.filled).toBe(false);
});

test("sell fills when avg_high crosses rec price", () => {
  const created = 300_000;
  const rows = [snap(3, created + 5 * HOUR, { avgHigh: 1005, avgLow: 980, highVol: 7 })];
  const o = scorePrediction(
    { id: "c3", side: "sell", tolerance: "hours", recommendedPrice: 1000, createdAt: created },
    rows,
    created + 9 * HOUR,
  );
  expect(o!.filled).toBe(true);
});

test("zero volume does not count as a fill", () => {
  const created = 400_000;
  const rows = [snap(4, created + 5 * HOUR, { avgHigh: 1050, avgLow: 995, lowVol: 0 })];
  const o = scorePrediction(
    { id: "c4", side: "buy", tolerance: "hours", recommendedPrice: 1000, createdAt: created },
    rows,
    created + 9 * HOUR,
  );
  expect(o!.filled).toBe(false);
});

test("window not closed yet → null", () => {
  const created = 500_000;
  const o = scorePrediction(
    { id: "c5", side: "buy", tolerance: "patient", recommendedPrice: 1000, createdAt: created },
    [],
    created + 10 * HOUR, // patient window ends at 72h
  );
  expect(o).toBeNull();
});

test("crossings outside the window are ignored", () => {
  const created = 600_000;
  const [start] = WINDOWS.hours;
  const rows = [snap(6, created + start - 60, { avgHigh: 1050, avgLow: 990, lowVol: 5 })];
  const o = scorePrediction(
    { id: "c6", side: "buy", tolerance: "hours", recommendedPrice: 1000, createdAt: created },
    rows,
    created + 9 * HOUR,
  );
  expect(o!.filled).toBe(false);
});

test("calibration tabulates fill rate per cohort", () => {
  const cal = fillRateByCohort([
    { confidenceBucket: "hours/buy/thick/steady", filled: true },
    { confidenceBucket: "hours/buy/thick/steady", filled: false },
    { confidenceBucket: "hours/buy/thick/steady", filled: true },
    { confidenceBucket: "instant/sell/thin/volatile", filled: false },
  ]);
  const a = cal.find((c) => c.cohortKey === "hours/buy/thick/steady")!;
  expect(a.nTotal).toBe(3);
  expect(a.nFilled).toBe(2);
  expect(a.fillRate).toBeCloseTo(2 / 3);
  const b = cal.find((c) => c.cohortKey === "instant/sell/thin/volatile")!;
  expect(b.fillRate).toBe(0);
});
