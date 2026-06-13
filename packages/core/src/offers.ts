// Fill-probability offer engine — a deterministic first-passage (barrier) model.
// Full rationale: docs/RECOMMENDATION-METHODOLOGY.md. Philosophy: advice, not
// modelling — help someone get a fair purchase and move on, not flip for profit.
//
// Each wait class targets "≥90% chance to fill within W". Model log-price as a
// random walk with robust per-bucket volatility σ̂; a buy at relative discount δ
// below mid fills within n buckets with prob ≈ 2·Φ(−δ/(σ̂√n)) (reflection
// principle). Invert for 90% → δ = Z_FILL·σ̂·√n. News sentiment enters as a small
// drift that scales as n (vs diffusion's √n), so it is ~inert at the instant
// horizon and meaningful at the 1-month horizon. Monotonicity is enforced; offers
// within FAIR_MARGIN of market are reported as "market is fair".
//
// The §6 firewall (news never touches price) was lifted 2026-06-13 at the owner's
// direction; sentiment is bounded, volatility-scaled, capped, and never the only signal.

import type { SentimentSignal, Side, Tolerance } from "./types.ts";
import { normInv, robustLogVol } from "./stats.ts";
import { roundForSide } from "./rounding.ts";

export const ENGINE_VERSION = 2;

/** Fill-probability target and its barrier coefficient: δ = Z_FILL·σ̂·√n. */
export const FILL_PROB = 0.9;
export const Z_FILL = -normInv(FILL_PROB / 2); // ≈ 0.12566

/** Wait windows, in 5-minute buckets (instant is pinned to the spread). */
export const WINDOW_BUCKETS: Record<Exclude<Tolerance, "instant">, number> = {
  hours: 24, // 2h
  patient: 576, // 2 days
  extended: 8640, // 30 days
};

/** Sentiment drift per bucket μ̂ = SENTIMENT_K·dir·strength·σ̂; capped + age-decayed. */
export const SENTIMENT_K = 0.00135; // strong news ≈ the diffusion term at the 1-month horizon
export const SENTIMENT_CAP = 0.05; // hard ceiling on the sentiment price move (±5%)
export const SENTIMENT_DECAY_DAYS = 14; // news effect fades linearly to zero over ~2 weeks

/** Within this band of market, just say "market price is a fair offer". */
export const FAIR_MARGIN = 0.015;

const TOLERANCES: Tolerance[] = ["instant", "hours", "patient", "extended"];

function midPrice(instaBuy: number | null, instaSell: number | null, recentMids: number[]): number | null {
  if (instaBuy !== null && instaSell !== null && instaBuy > 0 && instaSell > 0) {
    return (instaBuy + instaSell) / 2;
  }
  const last = recentMids.length ? recentMids[recentMids.length - 1]! : null;
  return last && last > 0 ? last : null;
}

/** Per-bucket sentiment drift in log-price units (signed, age-decayed). */
function sentimentDrift(sentiment: SentimentSignal | null, sigma: number): number {
  if (!sentiment || sentiment.dir === 0) return 0;
  const decay = Math.max(0, 1 - sentiment.ageDays / SENTIMENT_DECAY_DAYS);
  const strength = Math.max(0, Math.min(1, sentiment.strength)) * decay;
  return SENTIMENT_K * sentiment.dir * strength * sigma;
}

/**
 * Compute all eight offers (4 tolerances × 2 sides) for one item from its trailing
 * window. `recentMids` is chronological (ascending ts), NOT sorted. Returns the
 * rounded prices keyed `${tolerance}_${side}` plus the keys that are "fair".
 */
export function recommendAll(
  currentInstaBuy: number | null,
  currentInstaSell: number | null,
  recentMids: number[],
  sentiment: SentimentSignal | null,
): { prices: Partial<Record<string, number>>; fair: string[] } {
  const out: Partial<Record<string, number>> = {};
  const mid = midPrice(currentInstaBuy, currentInstaSell, recentMids);

  // Instant is always the spread, when we have it — the only way to fill in 30s.
  if (currentInstaBuy !== null && currentInstaBuy > 0) out["instant_buy"] = roundForSide(currentInstaBuy, "buy");
  if (currentInstaSell !== null && currentInstaSell > 0) out["instant_sell"] = roundForSide(currentInstaSell, "sell");

  if (mid !== null && recentMids.length >= 4) {
    const sigma = robustLogVol(recentMids);
    // Single pass for the empirical clamp bounds (avoids a large spread argument list).
    let lo = recentMids[0]!;
    let hi = recentMids[0]!;
    for (let i = 1; i < recentMids.length; i++) {
      const v = recentMids[i]!;
      if (v < lo) lo = v;
      else if (v > hi) hi = v;
    }
    const drift = sentimentDrift(sentiment, sigma); // signed per-bucket

    for (const t of ["hours", "patient", "extended"] as Exclude<Tolerance, "instant">[]) {
      const n = WINDOW_BUCKETS[t];
      const diffusion = Z_FILL * sigma * Math.sqrt(n);
      // Cap the cumulative sentiment move; positive drift narrows a buy discount.
      const sent = Math.max(-SENTIMENT_CAP, Math.min(SENTIMENT_CAP, drift * n));

      // buy: discount δ below mid; positive sentiment shrinks it.
      const buyDelta = diffusion - sent;
      let buy = mid * (1 - buyDelta);
      buy = Math.max(lo, Math.min(buy, mid)); // clamp to [30d low, mid]
      out[`${t}_buy`] = roundForSide(buy, "buy");

      // sell: premium δ above mid; positive sentiment widens it.
      const sellDelta = diffusion + sent;
      let sell = mid * (1 + sellDelta);
      sell = Math.min(hi, Math.max(sell, mid)); // clamp to [mid, 30d high]
      out[`${t}_sell`] = roundForSide(sell, "sell");
    }
  }

  enforceMonotonic(out);
  const fair = mid !== null ? fairKeys(out, mid) : [];
  return { prices: out, fair };
}

/** Strong monotonicity on the rounded prices: buys non-increasing, sells non-increasing-in-aggression. */
function enforceMonotonic(prices: Partial<Record<string, number>>): void {
  // Buys: instant ≥ hours ≥ patient ≥ extended (running min).
  let prevBuy = Infinity;
  for (const t of TOLERANCES) {
    const k = `${t}_buy`;
    const v = prices[k];
    if (v === undefined) continue;
    const clamped = Math.min(v, prevBuy);
    prices[k] = clamped;
    prevBuy = clamped;
  }
  // Sells: instant ≤ hours ≤ patient ≤ extended (running max).
  let prevSell = -Infinity;
  for (const t of TOLERANCES) {
    const k = `${t}_sell`;
    const v = prices[k];
    if (v === undefined) continue;
    const clamped = Math.max(v, prevSell);
    prices[k] = clamped;
    prevSell = clamped;
  }
}

/** Offers within FAIR_MARGIN of market — "just buy it" territory. */
function fairKeys(prices: Partial<Record<string, number>>, mid: number): string[] {
  const fair: string[] = [];
  for (const t of TOLERANCES) {
    for (const side of ["buy", "sell"] as Side[]) {
      const k = `${t}_${side}`;
      const v = prices[k];
      if (v !== undefined && mid > 0 && Math.abs(v / mid - 1) <= FAIR_MARGIN) fair.push(k);
    }
  }
  return fair;
}
