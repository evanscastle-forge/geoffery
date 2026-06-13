// Prediction scoring (spec §5). Evaluate a logged consultation against subsequent
// 5m data: did the recommended (rounded) price trade through with nonzero volume
// inside the tolerance window? Ported from `scorer.py`. Pure: takes snapshot arrays.

import type { Calibration, Consultation, Outcome, Side, Snapshot, Tolerance } from "./types.ts";

const ONE_HOUR = 3600;
const ONE_DAY = 86400;

/**
 * (startOffsetSeconds, endOffsetSeconds) per tolerance — the "fill within W" windows
 * the model targets at 90% (recalibrated 2026-06-13): now 30s, a few hours = 2h,
 * a day or two = 2 days, a really long time = 1 month. Each runs from order time.
 * NB on a 30-day price cache the 1-month window is only ever partially evaluable.
 */
export const WINDOWS: Record<Tolerance, [number, number]> = {
  instant: [0, 30],
  hours: [0, 2 * ONE_HOUR],
  patient: [0, 2 * ONE_DAY],
  extended: [0, 30 * ONE_DAY],
};

/**
 * Return [filled, filledAt] for the first 5m bucket in [windowStart, windowEnd)
 * where the recommended level was crossed with nonzero volume on the user's side.
 * `snapshots` must be this item's buckets (order independent — we scan for the min ts).
 */
export function filledWithinWindow(
  snapshots: Snapshot[],
  side: Side,
  recPrice: number,
  windowStart: number,
  windowEnd: number,
): [boolean, number | null] {
  let firstTs: number | null = null;
  for (const s of snapshots) {
    if (s.ts < windowStart || s.ts >= windowEnd) continue;
    const crossed =
      side === "buy"
        ? s.avgLow !== null && s.avgLow <= recPrice && (s.lowVol ?? 0) > 0
        : s.avgHigh !== null && s.avgHigh >= recPrice && (s.highVol ?? 0) > 0;
    if (crossed && (firstTs === null || s.ts < firstTs)) firstTs = s.ts;
  }
  return firstTs === null ? [false, null] : [true, firstTs];
}

/**
 * Score one consultation. Returns null if the window has not closed yet
 * (`windowEnd > now`). `snapshots` are this item's 5m buckets covering the window.
 */
export function scorePrediction(
  c: Pick<Consultation, "id" | "side" | "tolerance" | "recommendedPrice" | "createdAt">,
  snapshots: Snapshot[],
  now: number,
): Outcome | null {
  const [startOff, endOff] = WINDOWS[c.tolerance];
  const windowStart = c.createdAt + startOff;
  const windowEnd = c.createdAt + endOff;
  if (windowEnd > now) return null; // window not closed yet

  const [filled, filledAt] = filledWithinWindow(
    snapshots,
    c.side,
    c.recommendedPrice,
    windowStart,
    windowEnd,
  );
  return {
    consultationId: c.id,
    filled,
    filledAt,
    evalWindowStart: windowStart,
    evalWindowEnd: windowEnd,
    evaluatedAt: now,
  };
}

/** Rebuild per-cohort fill rates from scored outcomes, keyed by confidenceBucket. */
export function fillRateByCohort(
  pairs: { confidenceBucket: string; filled: boolean }[],
): Calibration[] {
  const acc = new Map<string, { nTotal: number; nFilled: number }>();
  for (const p of pairs) {
    const cur = acc.get(p.confidenceBucket) ?? { nTotal: 0, nFilled: 0 };
    cur.nTotal++;
    if (p.filled) cur.nFilled++;
    acc.set(p.confidenceBucket, cur);
  }
  return [...acc.entries()].map(([cohortKey, { nTotal, nFilled }]) => ({
    cohortKey,
    nTotal,
    nFilled,
    fillRate: nTotal > 0 ? nFilled / nTotal : 0,
  }));
}
