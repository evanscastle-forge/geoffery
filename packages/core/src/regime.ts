// Market regime classification (spec §4, 2×2: power × stability).
// Ported from reference `regime.py` (see docs/SALVAGE.md). Pure: takes 5m rows, no I/O.

import type { LiquidityBand, RegimeResult, RegimePower, RegimeStability, Snapshot } from "./types.ts";
import { mean, pstdev, rollingVolatility } from "./stats.ts";

// Tuning knobs — kept small and explicit so a skeptic can verify.
export const TREND_PCT_THRESHOLD = 0.015; // 1.5% trend over the short window
export const SPREAD_SHARE_THRESHOLD = 0.55; // >55% of volume on one side flips power
export const VOLATILITY_Z_THRESHOLD = 2.0; // >=2σ vs baseline → volatile
// News can only break a borderline volatility tie within this margin; it can
// never fabricate volatility on its own (spec §6 §D-013).
export const NEWS_TIEBREAKER_MARGIN = 0.4;
export const SHORT_WINDOW_DAYS = 3;
export const BASELINE_WINDOW_DAYS = 30;
const BASELINE_ROLLING_WINDOW = 12; // ~1 hour of 5m buckets
const ONE_DAY = 86400;

export function mid(avgHigh: number | null, avgLow: number | null): number | null {
  if (avgHigh === null && avgLow === null) return null;
  if (avgHigh === null) return avgLow;
  if (avgLow === null) return avgHigh;
  return (avgHigh + avgLow) / 2;
}

/**
 * Classify regime. `rows` are 5m snapshots in ascending ts order; `now` is the
 * reference timestamp. `newsVolatilityHint` (spec §6) only breaks a borderline
 * volatility tie — it never enters the recommendation engine. Returns null when
 * there isn't enough data.
 */
export function classify(
  rows: Snapshot[],
  now: number,
  newsVolatilityHint = false,
): RegimeResult | null {
  if (rows.length === 0) return null;

  const cutoffShort = now - SHORT_WINDOW_DAYS * ONE_DAY;
  const cutoffBaseline = now - BASELINE_WINDOW_DAYS * ONE_DAY;

  const mids: number[] = [];
  for (const r of rows) {
    const m = mid(r.avgHigh, r.avgLow);
    if (m !== null) mids.push(m);
  }
  if (mids.length < 6) return null;

  // ── power axis ──────────────────────────────────────────────────────────
  const shortRows = rows.filter((r) => r.ts >= cutoffShort);
  const shortMids: number[] = [];
  for (const r of shortRows) {
    const m = mid(r.avgHigh, r.avgLow);
    if (m !== null) shortMids.push(m);
  }
  let trendPct = 0;
  if (shortMids.length >= 2) {
    const first = shortMids[0]!;
    const last = shortMids[shortMids.length - 1]!;
    trendPct = first !== 0 ? (last - first) / first : 0;
  }

  let highVolTotal = 0;
  let lowVolTotal = 0;
  for (const r of shortRows) {
    highVolTotal += r.highVol ?? 0;
    lowVolTotal += r.lowVol ?? 0;
  }
  const totalVol = highVolTotal + lowVolTotal;
  const highShare = totalVol > 0 ? highVolTotal / totalVol : 0.5;

  let power: RegimePower = "balanced";
  if (trendPct > TREND_PCT_THRESHOLD && highShare >= SPREAD_SHARE_THRESHOLD) {
    power = "seller";
  } else if (trendPct < -TREND_PCT_THRESHOLD && highShare <= 1 - SPREAD_SHARE_THRESHOLD) {
    power = "buyer";
  } else if (trendPct > TREND_PCT_THRESHOLD) {
    power = "seller"; // trend wins when spread is ambiguous
  } else if (trendPct < -TREND_PCT_THRESHOLD) {
    power = "buyer";
  }

  // ── stability axis ──────────────────────────────────────────────────────
  const baselineMids: number[] = [];
  for (const r of rows) {
    if (r.ts >= cutoffBaseline && r.ts < cutoffShort) {
      const m = mid(r.avgHigh, r.avgLow);
      if (m !== null) baselineMids.push(m);
    }
  }
  const baselineVols = rollingVolatility(baselineMids, BASELINE_ROLLING_WINDOW);
  const currentVols = rollingVolatility(shortMids, BASELINE_ROLLING_WINDOW);

  let stability: RegimeStability = "steady";
  let volatilityZ = 0;
  let newsContributed = false;
  if (baselineVols.length > 0 && currentVols.length > 0) {
    const baseMean = mean(baselineVols);
    const baseStdev = pstdev(baselineVols) || 1.0;
    const current = mean(currentVols);
    volatilityZ = (current - baseMean) / baseStdev;
    if (volatilityZ >= VOLATILITY_Z_THRESHOLD) {
      stability = "volatile";
    } else if (newsVolatilityHint && volatilityZ >= VOLATILITY_Z_THRESHOLD - NEWS_TIEBREAKER_MARGIN) {
      stability = "volatile";
      newsContributed = true;
    }
  }

  return { power, stability, trendPct, highShare, volatilityZ, newsContributed };
}

/** Three-band liquidity from the volume baseline. Thick: dailies; thin: rare drops. */
export function liquidityBand(volumeBaseline: number): LiquidityBand {
  if (volumeBaseline >= 100_000) return "thick";
  if (volumeBaseline >= 1_000) return "medium";
  return "thin";
}

export type VolatilityLevel = "steady" | "some" | "high";

// A display read of how much an item wanders over the trailing 30 days, from the
// relative inter-quartile spread (p75−p25)/p50 — the same band the gauge shades.
// Thresholds are deliberately simple + tunable (owner directive 2026-06-13).
export const VOL_SOME_SPREAD = 0.06; // ≥6% IQR spread → some volatility
export const VOL_HIGH_SPREAD = 0.14; // ≥14% → highly volatile

/** Three-level volatility for the item-page badge. Defaults to "steady" when data is missing. */
export function volatilityLevel(
  p25: number | null,
  p50: number | null,
  p75: number | null,
): VolatilityLevel {
  if (p25 === null || p50 === null || p75 === null || p50 <= 0) return "steady";
  const spread = (p75 - p25) / p50;
  if (spread >= VOL_HIGH_SPREAD) return "high";
  if (spread >= VOL_SOME_SPREAD) return "some";
  return "steady";
}

// A clearly-trending item should read as falling/rising, not merely "steady" — the IQR-spread
// volatility level is blind to direction, so a smooth 30-day decline still scores "steady"
// (owner directive 2026-06-18). When the 30-day move clears this band, the badge shows the
// direction + magnitude instead of the volatility word.
export const TREND_BADGE_THRESHOLD = 0.05; // ±5% over 30 days → a trend, not just "steady"

export type MarketCharacter =
  | { kind: "trend"; direction: "down" | "up"; changePct: number } // changePct signed, e.g. -8.2
  | { kind: "vol"; level: VolatilityLevel };

/**
 * What to call an item's market on its page. `change30d` is the fractional 30-day price move
 * (e.g. -0.08 for −8%); null when history is too thin → falls back to the volatility level.
 * This does NOT touch the buy/hold/sell gauge — it only labels the market's character.
 */
export function marketCharacter(
  change30d: number | null,
  p25: number | null,
  p50: number | null,
  p75: number | null,
): MarketCharacter {
  if (change30d !== null && Math.abs(change30d) >= TREND_BADGE_THRESHOLD) {
    return { kind: "trend", direction: change30d < 0 ? "down" : "up", changePct: change30d * 100 };
  }
  return { kind: "vol", level: volatilityLevel(p25, p50, p75) };
}
