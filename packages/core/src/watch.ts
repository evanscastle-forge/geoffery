// "Items of note" weekly score (owner feedback 2026-06-12): rank items for the
// homepage by recent volatility plus a recent-news mention, with noise guards —
// a 1gp move on a 4gp rune is a 25% swing but no signal, a single bad tick must
// not top the board, and a junk item flapping on 100k gp/day of trade is not
// "of note" however wild its percentages. Pure; no I/O.

/** Volatility only counts when the week's robust move clears this many gp. */
export const MIN_ABS_MOVE_GP = 50;
/** And only when real coin moves: median price × 24h volume must clear this. */
export const MIN_VALUE_TRADED_GP_24H = 10_000_000;
/** Relative weekly range is capped so one mover can't dominate the board. */
export const MAX_REL_RANGE = 1.0;
/** Flat bonus for a recent relevant news mention. */
export const NEWS_BONUS = 0.15;

/**
 * Weekly "of note" score for one item.
 * Volatility is the p10–p90 range of the weekly mid-prices (robust to single-tick
 * spikes), relative to the median — gated by MIN_ABS_MOVE_GP (cheap-item noise)
 * and MIN_VALUE_TRADED_GP_24H (thin-market noise).
 * @param weekly trailing-1w sparkline points [ts, midPrice], ascending.
 * @param volume24h units traded in the last day.
 * @param hasRecentNews aggregate flagged recent-news / news-volatility.
 */
export function watchScore(
  weekly: readonly (readonly [number, number])[],
  volume24h: number,
  hasRecentNews: boolean,
): number {
  let vol = 0;
  if (weekly.length >= 8) {
    const prices = weekly.map((p) => p[1]).sort((a, b) => a - b);
    const at = (q: number) => prices[Math.min(prices.length - 1, Math.max(0, Math.round(q * (prices.length - 1))))]!;
    const p10 = at(0.1);
    const p90 = at(0.9);
    const median = at(0.5);
    const absRange = p90 - p10;
    if (
      absRange >= MIN_ABS_MOVE_GP &&
      median > 0 &&
      median * volume24h >= MIN_VALUE_TRADED_GP_24H
    ) {
      vol = Math.min(absRange / median, MAX_REL_RANGE);
    }
  }
  return vol + (hasRecentNews ? NEWS_BONUS : 0);
}
