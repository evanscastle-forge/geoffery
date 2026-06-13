// Exchange Ledger tier math (spec §8). One cumulative lifetime score per supporter
// ($1 = 1 point). Two modes: fixed exponential thresholds at launch; percentile-based
// once the ledger holds a few hundred names (dragon ≈ top 2%). Amounts are never
// exposed — tiers and within-tier ordering never use the raw score for display.

import type { Tier } from "./types.ts";

/** bronze → dragon, ascending. */
export const TIERS: Tier[] = [
  "bronze",
  "iron",
  "steel",
  "black",
  "mithril",
  "adamant",
  "rune",
  "dragon",
];

/** Fixed exponential thresholds (lifetime $). bronze = any tip; dragon genuinely rare. */
export const FIXED_THRESHOLDS: Record<Tier, number> = {
  bronze: 1,
  iron: 5,
  steel: 10,
  black: 25,
  mithril: 50,
  adamant: 100,
  rune: 250,
  dragon: 500,
};

/** Percentile cut points (top-fraction ceiling) per tier for percentile mode. */
const PERCENTILE_CEILINGS: [Tier, number][] = [
  ["dragon", 0.02],
  ["rune", 0.08],
  ["adamant", 0.18],
  ["mithril", 0.33],
  ["black", 0.53],
  ["steel", 0.73],
  ["iron", 0.9],
  ["bronze", 1.0],
];

export type LedgerMode = "fixed" | "percentile";

/** Tier for a single score under fixed thresholds (returns null below bronze). */
export function tierForFixed(score: number): Tier | null {
  let result: Tier | null = null;
  for (const tier of TIERS) {
    if (score >= FIXED_THRESHOLDS[tier]) result = tier;
  }
  return result;
}

/**
 * Assign tiers across a cohort. In `fixed` mode each score maps independently.
 * In `percentile` mode, scores are ranked and bucketed by top-fraction so
 * inactive supporters passively drift down as the ladder grows (no decay rule).
 */
export function assignTiers(
  entries: { name: string; score: number }[],
  mode: LedgerMode = "fixed",
): Map<string, Tier | null> {
  const out = new Map<string, Tier | null>();
  if (mode === "fixed") {
    for (const e of entries) out.set(e.name, tierForFixed(e.score));
    return out;
  }
  // percentile: rank descending; ties share the same rank fraction.
  const ranked = [...entries].sort((a, b) => b.score - a.score);
  const n = ranked.length;
  for (let i = 0; i < n; i++) {
    const e = ranked[i]!;
    if (e.score < FIXED_THRESHOLDS.bronze) {
      out.set(e.name, null);
      continue;
    }
    const frac = (i + 1) / n; // top-fraction position
    let tier: Tier = "bronze";
    for (const [t, ceil] of PERCENTILE_CEILINGS) {
      if (frac <= ceil) {
        tier = t;
        break;
      }
    }
    out.set(e.name, tier);
  }
  return out;
}
