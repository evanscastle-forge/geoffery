// §6 firewall: the offer engine must never read news/wiki signals. This is
// enforced three ways — ESLint (no-restricted-imports on offers.ts), the
// core-purity script (scans offers.ts for news/wiki imports), and this behavioral
// test: recommend() takes only market inputs, so no update flag can move a price.
import { expect, test } from "vitest";
import { recommend } from "./offers.ts";
import type { RegimeResult } from "./types.ts";

const regime: RegimeResult = { power: "balanced", stability: "steady", trendPct: 0, highShare: 0.5, volatilityZ: 0, newsContributed: false };

test("recommend output is invariant to the news-contributed flag", () => {
  const mids = Array.from({ length: 500 }, (_, i) => 1000 + i);
  const base = { side: "buy" as const, tolerance: "hours" as const, liquidity: "thick" as const, currentInstaBuy: null, currentInstaSell: null, recentMidsSorted: mids };
  const withoutNews = recommend({ ...base, regime: { ...regime, newsContributed: false } });
  const withNews = recommend({ ...base, regime: { ...regime, newsContributed: true } });
  // newsContributed is metadata on the regime; it must not move the price.
  expect(withNews!.price).toBe(withoutNews!.price);
});
