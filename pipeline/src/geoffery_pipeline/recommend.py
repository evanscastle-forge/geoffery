"""Convert (item, side, tolerance) + market regime → recommended price (D-011).

Three tolerance classes, each with an indicative fill-probability target:

    instant  ≈ 95% within ~5 minutes
    hours    ≈ 85% within 4–8 hours
    patient  ≈ 75% within 48–72 hours

The implementation maps each class to a percentile of the recent fill
distribution, adjusted by regime and liquidity:

    instant  → current insta-buy / insta-sell (today's `prices_latest`)
    hours    → p20 of recent fills for buys, p80 for sells (regime-shifted)
    patient  → p10 / p90 (liquidity-widened on thin markets)

All outputs pass through `rounding.round_for_side` so buys round up and
sells round down to the nearest 4-sig-fig step. The scorer (D-011) only
ever evaluates the rounded number — the unrounded internal value is
discarded.

`engine_version` is a single integer that the calibration table groups
by; bump it when the percentile mapping or regime adjustments change.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .regime import RegimeResult
from .rounding import round_for_side

ENGINE_VERSION = 1

Side = Literal["buy", "sell"]
Tolerance = Literal["instant", "hours", "patient"]
LiquidityBand = Literal["thick", "medium", "thin"]


@dataclass(frozen=True)
class Recommendation:
    price: int                  # rounded gp
    side: Side
    tolerance: Tolerance
    confidence_bucket: str      # e.g. "instant/buy/thick/steady" — calibration key
    engine_version: int = ENGINE_VERSION


# Base percentile for each (side, tolerance). Buys want a price low enough to
# be undercut; sells want a price high enough to be over-bid. Both are biased
# more aggressively as the user accepts more wait time.
_BASE_PERCENTILES: dict[tuple[Side, Tolerance], float] = {
    ("buy",  "hours"):   0.20,
    ("buy",  "patient"): 0.10,
    ("sell", "hours"):   0.80,
    ("sell", "patient"): 0.90,
}


def _percentile(sorted_values: list[float], q: float) -> float:
    """Plain quantile on an already-sorted list."""
    if not sorted_values:
        return 0.0
    if len(sorted_values) == 1:
        return sorted_values[0]
    pos = q * (len(sorted_values) - 1)
    lo = int(pos)
    hi = min(lo + 1, len(sorted_values) - 1)
    frac = pos - lo
    return sorted_values[lo] * (1 - frac) + sorted_values[hi] * frac


def _regime_shift(base_pct: float, side: Side, regime: RegimeResult) -> float:
    """Nudge the percentile based on market regime.

    In a seller's market, buys need to nudge *up* (pay more) and sells can
    afford to ask *down* (less aggressive). Buyer's market is the mirror.
    Volatile markets widen the offset in the direction of safety on both
    sides — when the market is moving, give the offer a bit more cushion.
    """
    nudge = 0.0
    if regime.power == "seller" and side == "buy":
        nudge += 0.05
    elif regime.power == "seller" and side == "sell":
        nudge -= 0.05
    elif regime.power == "buyer" and side == "sell":
        nudge -= 0.05
    elif regime.power == "buyer" and side == "buy":
        nudge += 0.05

    if regime.stability == "volatile":
        # Tighter cushion: buys go closer to the mid, sells go further from mid
        # (in the direction that increases fill probability for that side).
        if side == "buy":
            nudge += 0.03
        else:
            nudge -= 0.03

    return max(0.02, min(0.98, base_pct + nudge))


def _liquidity_widening(base_pct: float, side: Side, band: LiquidityBand) -> float:
    """Patient offers on thin markets widen further — fewer fills, more cushion."""
    if band == "thin":
        return base_pct + (0.02 if side == "buy" else -0.02)
    return base_pct


def recommend(
    *,
    side: Side,
    tolerance: Tolerance,
    regime: RegimeResult,
    liquidity: LiquidityBand,
    current_insta_buy: int | None,
    current_insta_sell: int | None,
    recent_mids_sorted: list[float],
) -> Recommendation | None:
    """Return a `Recommendation` for the given parameters, or None if we
    don't have enough data to honestly recommend.

    `recent_mids_sorted` is the sorted list of recent 5m mid-prices used as
    the empirical fill distribution; pass the trailing 24h window for
    `hours`-class recs and the trailing 7d window for `patient`-class recs.
    """
    if tolerance == "instant":
        # Instant uses today's wiki insta-price for the user's side.
        if side == "buy" and current_insta_buy is not None:
            price = round_for_side(current_insta_buy, "buy")
        elif side == "sell" and current_insta_sell is not None:
            price = round_for_side(current_insta_sell, "sell")
        else:
            return None
        return Recommendation(
            price=price,
            side=side,
            tolerance=tolerance,
            confidence_bucket=f"instant/{side}/{liquidity}/{regime.stability}",
        )

    if not recent_mids_sorted:
        return None

    base_pct = _BASE_PERCENTILES[(side, tolerance)]
    shifted = _regime_shift(base_pct, side, regime)
    final_pct = _liquidity_widening(shifted, side, liquidity)
    raw = _percentile(recent_mids_sorted, final_pct)
    if raw <= 0:
        return None
    price = round_for_side(raw, side)
    return Recommendation(
        price=price,
        side=side,
        tolerance=tolerance,
        confidence_bucket=f"{tolerance}/{side}/{liquidity}/{regime.stability}",
    )
