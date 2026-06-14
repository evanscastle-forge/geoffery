// The deal gauge + per-item aggregate (spec §4). Ported from `aggregates.py`.
// Pure: takes 5m snapshots + the latest price + a news flag, returns an Aggregate.
// Verdict wording is factual — the price vs the 30-day median, no action word
// (action badges/verbs retired 2026-06-13; supersedes the 2026-06-12 action-first rule).

import type { Aggregate, Band, LatestPrice, SentimentSignal, Snapshot } from "./types.ts";
import { mid } from "./regime.ts";
import { classify, liquidityBand } from "./regime.ts";
import { recommendAll, ENGINE_VERSION } from "./offers.ts";

export const THIRTY_DAYS = 30 * 24 * 60 * 60;
const ONE_DAY = 24 * 60 * 60;
export const MIN_SAMPLES = 30; // ~2.5h of 5m buckets; below this the gauge is "unsettled"
export const VOLUME_SPIKE_MULTIPLE = 3.0;
export const NEWS_LOOKBACK_DAYS = 3;

const UNSETTLED_VERDICT =
  "The figures are unsettled today; I would not stake my wages on them.";

/** Volume-weighted quantiles via cumulative weights (no scipy). */
export function weightedQuantiles(
  prices: number[],
  weights: number[],
  qs: number[],
): number[] {
  const pairs = prices.map((p, i) => [p, weights[i] ?? 1] as const).sort((a, b) => a[0] - b[0]);
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) {
    const sorted = [...prices].sort((a, b) => a - b);
    return qs.map((q) => unweightedQuantile(sorted, q));
  }
  const targets = qs.map((q) => q * total);
  const out: number[] = [];
  let cum = 0;
  let ti = 0;
  for (const [price, w] of pairs) {
    cum += w;
    while (ti < targets.length && cum >= targets[ti]!) {
      out.push(price);
      ti++;
    }
  }
  while (ti < targets.length) {
    out.push(pairs[pairs.length - 1]![0]);
    ti++;
  }
  return out;
}

function unweightedQuantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, sorted.length - 1);
  const frac = pos - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}

/** Plain percentile rank (unweighted): fraction of samples strictly below value. */
export function percentileRank(value: number, prices: number[]): number {
  if (prices.length === 0) return 0.5;
  let below = 0;
  for (const p of prices) if (p < value) below++;
  return below / prices.length;
}

export function band(current: number, p25: number, p75: number): Band {
  if (current <= p25) return "good";
  if (current <= p75) return "average";
  return "poor";
}

export function verdictText(percentVsP50: number): string {
  const sign = percentVsP50 >= 0 ? "above" : "below";
  const pct = Math.abs(Math.round(percentVsP50));
  return `${pct}% ${sign} the 30-day median.`;
}

function emptyRecFields() {
  return {
    regimePower: null,
    regimeStability: null,
    liquidityBand: null,
    recInstantBuy: null,
    recInstantSell: null,
    recHoursBuy: null,
    recHoursSell: null,
    recPatientBuy: null,
    recPatientSell: null,
    recExtendedBuy: null,
    recExtendedSell: null,
    recFairKeys: [] as string[],
    engineVersion: ENGINE_VERSION,
  } as const;
}

/**
 * Compute the full aggregate for one item.
 * @param rows trailing-30d 5m snapshots for this item, ascending ts.
 * @param latest the current insta-buy/sell, or null.
 * @param sentiment recent-news sentiment for this item (or null); also the regime tiebreaker.
 * @param now reference timestamp (seconds).
 */
export function computeAggregate(
  itemId: number,
  rows: Snapshot[],
  latest: LatestPrice | null,
  sentiment: SentimentSignal | null,
  now: number,
): Aggregate {
  const prices: number[] = [];
  const weights: number[] = [];
  let vol24h = 0;
  let volTotal = 0;
  const dayCutoff = now - ONE_DAY;
  for (const r of rows) {
    const m = mid(r.avgHigh, r.avgLow);
    if (m === null) continue;
    const vol = (r.highVol ?? 0) + (r.lowVol ?? 0);
    prices.push(m);
    weights.push(vol || 1); // weight 1 if zero so the price still counts
    volTotal += vol;
    if (r.ts >= dayCutoff) vol24h += vol;
  }

  const current = latest ? mid(latest.high, latest.low) : null;
  const sampleCount = prices.length;
  const flags: string[] = [];
  // The gauge is "unsettled" only briefly after news (≤ NEWS_LOOKBACK_DAYS); the
  // offer model uses the full, longer-decaying sentiment window passed in.
  const hasRecentNews = sentiment !== null && sentiment.ageDays <= NEWS_LOOKBACK_DAYS;

  if (sampleCount < MIN_SAMPLES || current === null) {
    if (sampleCount < MIN_SAMPLES) flags.push("thin-history");
    if (current === null) flags.push("no-current-price");
    return {
      itemId,
      computedAt: now,
      sampleCount,
      p25: null,
      p50: null,
      p75: null,
      currentPrice: current,
      currentPercentile: null,
      band: "unsettled",
      verdictText: UNSETTLED_VERDICT,
      flags,
      volume24h: vol24h,
      volumeBaseline: 0,
      ...emptyRecFields(),
    };
  }

  const [p25, p50, p75] = weightedQuantiles(prices, weights, [0.25, 0.5, 0.75]) as [
    number,
    number,
    number,
  ];
  const pctRank = percentileRank(current, prices);

  const avgDailyVolume = volTotal / 30.0;
  const volumeSpike = avgDailyVolume > 0 && vol24h > VOLUME_SPIKE_MULTIPLE * avgDailyVolume;
  if (volumeSpike) flags.push("volume-spike");
  if (hasRecentNews) flags.push("recent-news");

  let resolvedBand: Band;
  let verdict: string;
  if (volumeSpike || hasRecentNews) {
    resolvedBand = "unsettled";
    verdict = UNSETTLED_VERDICT;
  } else {
    resolvedBand = band(current, p25, p75);
    verdict = verdictText(p50 ? ((current - p50) / p50) * 100 : 0);
  }

  // Regime (gauge/display + the volatility tiebreaker) and the offer model. The
  // model now reads sentiment directly (the §6 firewall was lifted 2026-06-13);
  // it is bounded, volatility-scaled, capped, and never the only signal.
  const regime = classify(rows, now, hasRecentNews);
  if (regime?.newsContributed) flags.push("news-volatility");
  const liquidity = liquidityBand(Math.trunc(avgDailyVolume));
  const recs = recommendAll(latest?.high ?? null, latest?.low ?? null, prices, sentiment);
  const p = recs.prices;

  return {
    itemId,
    computedAt: now,
    sampleCount,
    p25,
    p50,
    p75,
    currentPrice: current,
    currentPercentile: pctRank,
    band: resolvedBand,
    verdictText: verdict,
    flags,
    volume24h: vol24h,
    volumeBaseline: Math.trunc(avgDailyVolume),
    regimePower: regime?.power ?? null,
    regimeStability: regime?.stability ?? null,
    liquidityBand: regime ? liquidity : null,
    recInstantBuy: p.instant_buy ?? null,
    recInstantSell: p.instant_sell ?? null,
    recHoursBuy: p.hours_buy ?? null,
    recHoursSell: p.hours_sell ?? null,
    recPatientBuy: p.patient_buy ?? null,
    recPatientSell: p.patient_sell ?? null,
    recExtendedBuy: p.extended_buy ?? null,
    recExtendedSell: p.extended_sell ?? null,
    recFairKeys: recs.fair,
    engineVersion: ENGINE_VERSION,
  };
}
