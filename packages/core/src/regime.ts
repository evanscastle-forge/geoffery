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
