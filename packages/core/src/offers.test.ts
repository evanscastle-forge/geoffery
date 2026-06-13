import { expect, test } from "vitest";
import { recommend } from "./offers.ts";
import type { RegimeResult } from "./types.ts";

function regime(power: RegimeResult["power"] = "balanced", stability: RegimeResult["stability"] = "steady"): RegimeResult {
  return { power, stability, trendPct: 0, highShare: 0.5, volatilityZ: 0, newsContributed: false };
}

const noInsta = { currentInstaBuy: null, currentInstaSell: null };

test("instant buy uses insta-buy rounded up", () => {
  const r = recommend({
    side: "buy",
    tolerance: "instant",
    regime: regime(),
    liquidity: "thick",
    currentInstaBuy: 1_594_231,
    currentInstaSell: 1_580_000,
    recentMidsSorted: [],
  });
  expect(r!.price).toBe(1_595_000);
  expect(r!.confidenceBucket).toBe("instant/buy/thick/steady");
});

test("instant sell uses insta-sell rounded down", () => {
  const r = recommend({
    side: "sell",
    tolerance: "instant",
    regime: regime(),
    liquidity: "thick",
    currentInstaBuy: 1_600_000,
    currentInstaSell: 1_594_231,
    recentMidsSorted: [],
  });
  expect(r!.price).toBe(1_594_000);
});

test("hours buy uses ~p20 then rounds up", () => {
  const mids = Array.from({ length: 100 }, (_, i) => 1000 + i);
  const r = recommend({
    side: "buy",
    tolerance: "hours",
    regime: regime(),
    liquidity: "medium",
    ...noInsta,
    recentMidsSorted: mids,
  });
  expect(r!.price).toBeGreaterThanOrEqual(1000);
  expect(r!.price).toBeLessThanOrEqual(1030);
  expect(r!.confidenceBucket).toBe("hours/buy/medium/steady");
});

test("patient buy targets a cheaper price than hours buy", () => {
  const mids = Array.from({ length: 1000 }, (_, i) => 1_000_000 + i * 1000);
  const base = { regime: regime(), liquidity: "thick" as const, ...noInsta, recentMidsSorted: mids };
  const rh = recommend({ side: "buy", tolerance: "hours", ...base })!;
  const rp = recommend({ side: "buy", tolerance: "patient", ...base })!;
  expect(rp.price).toBeLessThanOrEqual(rh.price);
});

test("seller's market nudges buys higher", () => {
  const mids = Array.from({ length: 1000 }, (_, i) => 1_000_000 + i * 1000);
  const base = { side: "buy" as const, tolerance: "hours" as const, liquidity: "thick" as const, ...noInsta, recentMidsSorted: mids };
  const balanced = recommend({ ...base, regime: regime("balanced") })!;
  const sellers = recommend({ ...base, regime: regime("seller") })!;
  expect(sellers.price).toBeGreaterThanOrEqual(balanced.price);
});

test("volatile widens buy upward", () => {
  const mids = Array.from({ length: 1000 }, (_, i) => 1_000_000 + i * 1000);
  const base = { side: "buy" as const, tolerance: "hours" as const, liquidity: "thick" as const, ...noInsta, recentMidsSorted: mids };
  const steady = recommend({ ...base, regime: regime("balanced", "steady") })!;
  const volatile = recommend({ ...base, regime: regime("balanced", "volatile") })!;
  expect(volatile.price).toBeGreaterThanOrEqual(steady.price);
});

test("no data → no recommendation", () => {
  const r = recommend({
    side: "buy",
    tolerance: "instant",
    regime: regime(),
    liquidity: "thin",
    ...noInsta,
    recentMidsSorted: [],
  });
  expect(r).toBeNull();
});

test("all outputs round to at most 4 sig figs", () => {
  const mids = Array(10).fill(1_594_231.7);
  for (const side of ["buy", "sell"] as const) {
    for (const tolerance of ["instant", "hours", "patient"] as const) {
      const r = recommend({
        side,
        tolerance,
        regime: regime(),
        liquidity: "thick",
        currentInstaBuy: tolerance === "instant" ? 1_594_231 : null,
        currentInstaSell: tolerance === "instant" ? 1_594_231 : null,
        recentMidsSorted: mids,
      });
      expect(r).not.toBeNull();
      expect(String(r!.price).replace(/0+$/, "").length).toBeLessThanOrEqual(4);
    }
  }
});
