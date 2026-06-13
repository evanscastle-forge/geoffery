// 4-significant-figure rounding for recommended prices (spec §5 binding).
// Buys round UP (pay a touch more → fills), sells round DOWN (accept a touch
// less → fills). The scorer evaluates the rounded number, never the internal value.
// Ported from reference `rounding.py` (see docs/SALVAGE.md).

import type { Side } from "./types.ts";

export type Direction = "up" | "down" | "nearest";

/** The 10**k step size for rounding a positive value to `sigs` sig figs. */
function step(value: number, sigs: number): number {
  if (value === 0) return 1;
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  return 10 ** Math.max(0, magnitude - sigs + 1);
}

/** Half-to-even (banker's) rounding, matching Python's round() on floats. */
function roundHalfToEven(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  // exactly .5 → round to even
  return floor % 2 === 0 ? floor : floor + 1;
}

export function roundSig(value: number, sigs = 4, direction: Direction = "nearest"): number {
  if (value === 0 || value == null || Number.isNaN(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  const absValue = Math.abs(value);

  // Numbers already shorter than `sigs` figures need no rounding.
  if (absValue < 10 ** (sigs - 1)) return sign * Math.round(absValue);

  const s = step(absValue, sigs);
  if (s <= 1) return sign * Math.round(absValue);

  let rounded: number;
  if (direction === "up") {
    rounded = Math.ceil(absValue / s) * s;
  } else if (direction === "down") {
    rounded = Math.floor(absValue / s) * s;
  } else {
    rounded = roundHalfToEven(absValue / s) * s;
  }
  return Math.trunc(sign * rounded);
}

/** Round a recommended price for the given side: buy up, sell down. */
export function roundForSide(value: number, side: Side, sigs = 4): number {
  return roundSig(value, sigs, side === "buy" ? "up" : "down");
}
