import { expect, test } from "vitest";
import { jarLevel, thresholdMet, type DonationMonth } from "./donations.ts";

test("jarLevel maps the raised/goal ratio to 5 fill levels", () => {
  expect(jarLevel(0, 50)).toBe(0); // nothing yet
  expect(jarLevel(10, 50)).toBe(0); // 20%
  expect(jarLevel(13, 50)).toBe(1); // 26%
  expect(jarLevel(25, 50)).toBe(2); // 50%
  expect(jarLevel(40, 50)).toBe(3); // 80%
});

test("the full jar (4) appears only at or above the goal", () => {
  expect(jarLevel(49, 50)).toBe(3); // 98% — not yet full
  expect(jarLevel(50, 50)).toBe(4); // exactly the goal
  expect(jarLevel(80, 50)).toBe(4); // over the goal
});

test("jarLevel guards a missing goal", () => {
  expect(jarLevel(10, 0)).toBe(0);
  expect(jarLevel(-5, 50)).toBe(0);
});

test("thresholdMet tracks the goal", () => {
  const m = (total: number): DonationMonth => ({ month: "2026-06", goal: 50, total, donors: [] });
  expect(thresholdMet(m(49))).toBe(false);
  expect(thresholdMet(m(50))).toBe(true);
  expect(thresholdMet(undefined)).toBe(false);
});
