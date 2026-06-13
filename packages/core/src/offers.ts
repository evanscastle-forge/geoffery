// Fill-probability offer engine (spec §5). Maps (side, tolerance) + regime +
// liquidity → a recommended price, rounded directionally. Ported from `recommend.py`.
//
// §6 FIREWALL: news/wiki update flags MUST NOT enter this module. Recent-update
// signal reaches the user only via the regime classifier's volatility tiebreaker;
// the recommended price is derived from market data alone. This file imports no
// news/wiki types (lint-enforced in eslint.config.js).

import type {
  LiquidityBand,
  Recommendation,
  RegimeResult,
  Side,
  Tolerance,
} from "./types.ts";
import { roundForSide } from "./rounding.ts";

export const ENGINE_VERSION = 1;

/** Base percentile for each (side, tolerance). More aggressive with more wait. */
const BASE_PERCENTILES: Record<string, number> = {
  "buy/hours": 0.2,
  "buy/patient": 0.1,
  "sell/hours": 0.8,
  "sell/patient": 0.9,
};

/** Plain quantile on an already-sorted ascending list. */
export function percentile(sortedValues: number[], q: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0]!;
  const pos = q * (sortedValues.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, sortedValues.length - 1);
  const frac = pos - lo;
  return sortedValues[lo]! * (1 - frac) + sortedValues[hi]! * frac;
}

function regimeShift(basePct: number, side: Side, regime: RegimeResult): number {
  let nudge = 0;
  if (regime.power === "seller" && side === "buy") nudge += 0.05;
  else if (regime.power === "seller" && side === "sell") nudge -= 0.05;
  else if (regime.power === "buyer" && side === "sell") nudge -= 0.05;
  else if (regime.power === "buyer" && side === "buy") nudge += 0.05;

  if (regime.stability === "volatile") {
    nudge += side === "buy" ? 0.03 : -0.03;
  }
  return Math.max(0.02, Math.min(0.98, basePct + nudge));
}

function liquidityWidening(basePct: number, side: Side, band: LiquidityBand): number {
  if (band === "thin") return basePct + (side === "buy" ? 0.02 : -0.02);
  return basePct;
}

export interface RecommendInput {
  side: Side;
  tolerance: Tolerance;
  regime: RegimeResult;
  liquidity: LiquidityBand;
  currentInstaBuy: number | null;
  currentInstaSell: number | null;
  /** Sorted ascending recent 5m mid-prices = the empirical fill distribution. */
  recentMidsSorted: number[];
}

/** Return a Recommendation, or null if we lack data to honestly recommend. */
export function recommend(input: RecommendInput): Recommendation | null {
  const { side, tolerance, regime, liquidity, currentInstaBuy, currentInstaSell } = input;

  if (tolerance === "instant") {
    let price: number;
    if (side === "buy" && currentInstaBuy !== null) {
      price = roundForSide(currentInstaBuy, "buy");
    } else if (side === "sell" && currentInstaSell !== null) {
      price = roundForSide(currentInstaSell, "sell");
    } else {
      return null;
    }
    return {
      price,
      side,
      tolerance,
      confidenceBucket: `instant/${side}/${liquidity}/${regime.stability}`,
      engineVersion: ENGINE_VERSION,
    };
  }

  if (input.recentMidsSorted.length === 0) return null;

  const basePct = BASE_PERCENTILES[`${side}/${tolerance}`]!;
  const shifted = regimeShift(basePct, side, regime);
  const finalPct = liquidityWidening(shifted, side, liquidity);
  const raw = percentile(input.recentMidsSorted, finalPct);
  if (raw <= 0) return null;
  const price = roundForSide(raw, side);
  return {
    price,
    side,
    tolerance,
    confidenceBucket: `${tolerance}/${side}/${liquidity}/${regime.stability}`,
    engineVersion: ENGINE_VERSION,
  };
}

/** Compute all six recommendations for an item from one trailing window. */
export function recommendAll(
  regime: RegimeResult,
  liquidity: LiquidityBand,
  currentInstaBuy: number | null,
  currentInstaSell: number | null,
  recentMids: number[],
): Partial<Record<string, number>> {
  const sortedMids = [...recentMids].sort((a, b) => a - b);
  const out: Partial<Record<string, number>> = {};
  for (const tolerance of ["instant", "hours", "patient"] as Tolerance[]) {
    for (const side of ["buy", "sell"] as Side[]) {
      const r = recommend({
        side,
        tolerance,
        regime,
        liquidity,
        currentInstaBuy,
        currentInstaSell,
        recentMidsSorted: sortedMids,
      });
      if (r) out[`${tolerance}_${side}`] = r.price;
    }
  }
  return out;
}
