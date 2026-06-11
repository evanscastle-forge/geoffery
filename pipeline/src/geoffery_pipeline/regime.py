"""Classify each item's market regime (D-011, 2×2: power × stability).

Power axis — buyer's market vs. seller's market:
    Looks at the short-window mid-price trend AND the spread-share asymmetry.
    A trending-up price with sellers holding the spread → seller's market.
    A trending-down price with buyers holding the spread → buyer's market.
    Inconclusive → balanced.

Stability axis — steady vs. volatile:
    Z-score of the recent volatility against the item's own baseline. This
    generalises the prior single-axis "unsettled" flag — anything that
    previously fired `volume-spike` now feeds `stability=volatile`.

Pure: takes a list of 5m rows and returns the regime label + a couple of
intermediate metrics callers can include in flags. No I/O; testable.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass
from typing import Literal

Power = Literal["buyer", "seller", "balanced"]
Stability = Literal["steady", "volatile"]

# Tuning knobs — kept small and explicit so a Reddit skeptic can verify.
TREND_PCT_THRESHOLD = 0.015        # 1.5% trend over the short window
SPREAD_SHARE_THRESHOLD = 0.55      # >55% of volume on one side flips power
VOLATILITY_Z_THRESHOLD = 2.0       # >=2σ vs baseline → volatile
SHORT_WINDOW_DAYS = 3              # power axis looks at the trailing N days
BASELINE_WINDOW_DAYS = 30          # stability baseline window

ONE_DAY = 86400


@dataclass(frozen=True)
class RegimeResult:
    power: Power
    stability: Stability
    trend_pct: float        # % change in mid over the short window
    high_share: float       # share of recent volume on the high (insta-buy) side
    volatility_z: float     # volatility z-score vs baseline


def _mid(avg_high: int | None, avg_low: int | None) -> float | None:
    if avg_high is None and avg_low is None:
        return None
    if avg_high is None:
        return float(avg_low)  # type: ignore[arg-type]
    if avg_low is None:
        return float(avg_high)
    return (avg_high + avg_low) / 2.0


def _rolling_volatility(prices: list[float], window: int) -> list[float]:
    """List of rolling stdevs over windows of size `window`."""
    if len(prices) < window:
        return []
    out: list[float] = []
    for i in range(window, len(prices) + 1):
        slice_ = prices[i - window:i]
        if len(slice_) < 2:
            continue
        try:
            out.append(statistics.pstdev(slice_))
        except statistics.StatisticsError:
            continue
    return out


def classify(rows: list[dict], now: int) -> RegimeResult | None:
    """`rows` is a list of dict-like 5m rows with keys ts/avg_high/avg_low/high_vol/low_vol,
    in ascending ts order. `now` is the reference timestamp.
    Returns None if there isn't enough data.
    """
    if not rows:
        return None

    cutoff_short = now - SHORT_WINDOW_DAYS * ONE_DAY
    cutoff_baseline = now - BASELINE_WINDOW_DAYS * ONE_DAY

    mids: list[float] = []
    high_vol_total = 0
    low_vol_total = 0
    for r in rows:
        mid = _mid(r["avg_high"], r["avg_low"])
        if mid is None:
            continue
        mids.append(mid)

    if len(mids) < 6:
        return None

    # ── power axis ─────────────────────────────────────────────────────────
    short_rows = [r for r in rows if r["ts"] >= cutoff_short]
    short_mids = [
        m for r in short_rows
        if (m := _mid(r["avg_high"], r["avg_low"])) is not None
    ]
    if len(short_mids) >= 2:
        trend_pct = (short_mids[-1] - short_mids[0]) / short_mids[0]
    else:
        trend_pct = 0.0

    for r in short_rows:
        high_vol_total += r["high_vol"] or 0
        low_vol_total += r["low_vol"] or 0
    total_vol = high_vol_total + low_vol_total
    high_share = high_vol_total / total_vol if total_vol > 0 else 0.5

    power: Power = "balanced"
    if trend_pct > TREND_PCT_THRESHOLD and high_share >= SPREAD_SHARE_THRESHOLD:
        power = "seller"
    elif trend_pct < -TREND_PCT_THRESHOLD and high_share <= (1 - SPREAD_SHARE_THRESHOLD):
        power = "buyer"
    elif trend_pct > TREND_PCT_THRESHOLD:
        power = "seller"  # trend wins when spread is ambiguous
    elif trend_pct < -TREND_PCT_THRESHOLD:
        power = "buyer"

    # ── stability axis ──────────────────────────────────────────────────────
    baseline_rows = [r for r in rows if r["ts"] >= cutoff_baseline and r["ts"] < cutoff_short]
    baseline_mids = [
        m for r in baseline_rows
        if (m := _mid(r["avg_high"], r["avg_low"])) is not None
    ]
    baseline_window = 12  # ~1 hour of 5m buckets
    baseline_vols = _rolling_volatility(baseline_mids, baseline_window)
    current_vols = _rolling_volatility(short_mids, baseline_window)

    stability: Stability = "steady"
    volatility_z = 0.0
    if baseline_vols and current_vols:
        try:
            mean = statistics.mean(baseline_vols)
            stdev = statistics.pstdev(baseline_vols) or 1.0
            current = statistics.mean(current_vols)
            volatility_z = (current - mean) / stdev
            if volatility_z >= VOLATILITY_Z_THRESHOLD:
                stability = "volatile"
        except statistics.StatisticsError:
            pass

    return RegimeResult(
        power=power,
        stability=stability,
        trend_pct=trend_pct,
        high_share=high_share,
        volatility_z=volatility_z,
    )


def liquidity_band(volume_baseline: int) -> Literal["thick", "medium", "thin"]:
    """Three-band liquidity classification from the existing volume baseline.

    Calibrated to OSRS scale — thick: high-liquidity dailies; thin: rare drops.
    Used by `recommend.py` to widen/narrow the percentile offsets per band.
    """
    if volume_baseline >= 100_000:
        return "thick"
    if volume_baseline >= 1_000:
        return "medium"
    return "thin"
