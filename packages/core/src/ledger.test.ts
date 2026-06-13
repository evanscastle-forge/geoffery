import { expect, test } from "vitest";
import { assignTiers, FIXED_THRESHOLDS, tierForFixed } from "./ledger.ts";

test("fixed thresholds map score to tier", () => {
  expect(tierForFixed(0)).toBeNull();
  expect(tierForFixed(1)).toBe("bronze");
  expect(tierForFixed(4)).toBe("bronze");
  expect(tierForFixed(5)).toBe("iron");
  expect(tierForFixed(10)).toBe("steel");
  expect(tierForFixed(499)).toBe("rune");
  expect(tierForFixed(500)).toBe("dragon");
  expect(tierForFixed(100_000)).toBe("dragon");
});

test("fixed thresholds are exponentially increasing, dragon highest", () => {
  const vals = Object.values(FIXED_THRESHOLDS);
  for (let i = 1; i < vals.length; i++) expect(vals[i]!).toBeGreaterThan(vals[i - 1]!);
  expect(FIXED_THRESHOLDS.dragon).toBe(Math.max(...vals));
});

test("percentile mode puts the top ~2% in dragon", () => {
  const entries = Array.from({ length: 100 }, (_, i) => ({ name: `s${i}`, score: i + 1 }));
  const tiers = assignTiers(entries, "percentile");
  // highest scorer is dragon; the very bottom is bronze (still >= 1)
  expect(tiers.get("s99")).toBe("dragon");
  expect(tiers.get("s0")).toBe("bronze");
  const dragons = [...tiers.values()].filter((t) => t === "dragon").length;
  expect(dragons).toBeGreaterThanOrEqual(1);
  expect(dragons).toBeLessThanOrEqual(3);
});

test("sub-bronze scores get no tier even in percentile mode", () => {
  const tiers = assignTiers([{ name: "a", score: 0 }, { name: "b", score: 10 }], "percentile");
  expect(tiers.get("a")).toBeNull();
});
