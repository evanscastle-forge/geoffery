"""Pin the 2×2 regime classifier (D-011)."""

from __future__ import annotations

from geoffery_pipeline.regime import classify, liquidity_band

FIVE_MIN = 300


def _row(ts, mid, high_vol, low_vol):
    return {"ts": ts, "avg_high": mid + 5, "avg_low": mid - 5,
            "high_vol": high_vol, "low_vol": low_vol}


def _series(start_mid, end_mid, *, n=200, high_vol=10, low_vol=10, now=2_000_000):
    """A linear series from start_mid → end_mid over `n` 5m buckets, ending at now."""
    rows = []
    for i in range(n):
        ts = now - (n - 1 - i) * FIVE_MIN
        mid = start_mid + (end_mid - start_mid) * (i / max(1, n - 1))
        rows.append(_row(ts, int(mid), high_vol, low_vol))
    return rows


def test_no_rows_returns_none():
    assert classify([], now=0) is None


def test_steady_buyers_market_trend_down():
    # Strong downtrend + most volume on the low (insta-sell) side → buyer's market
    rows = _series(1000, 940, n=300, high_vol=2, low_vol=20)
    r = classify(rows, now=2_000_000)
    assert r is not None
    assert r.power == "buyer"
    assert r.stability == "steady"


def test_steady_sellers_market_trend_up():
    rows = _series(1000, 1080, n=300, high_vol=20, low_vol=2)
    r = classify(rows, now=2_000_000)
    assert r is not None
    assert r.power == "seller"
    assert r.stability == "steady"


def test_balanced_when_flat_and_even():
    rows = _series(1000, 1000, n=300, high_vol=10, low_vol=10)
    r = classify(rows, now=2_000_000)
    assert r is not None
    assert r.power == "balanced"


def test_volatile_stability_from_noisy_recent_window():
    """A steady baseline followed by a noisy recent window should flag volatile."""
    import random
    random.seed(42)
    now = 2_000_000
    # 25 days of steady history at mid=1000, then 3 days of noisy data
    quiet_rows = []
    for i in range(7000):
        ts = now - (10000 - i) * FIVE_MIN
        mid = 1000 + random.gauss(0, 1)  # near-zero noise
        quiet_rows.append(_row(ts, int(mid), 10, 10))
    noisy_rows = []
    for i in range(900):
        ts = now - (900 - i) * FIVE_MIN
        mid = 1000 + random.gauss(0, 50)  # 50× the baseline noise
        noisy_rows.append(_row(ts, int(mid), 10, 10))
    rows = quiet_rows + noisy_rows
    r = classify(rows, now=now)
    assert r is not None
    assert r.stability == "volatile"


def test_liquidity_band_thresholds():
    assert liquidity_band(0) == "thin"
    assert liquidity_band(999) == "thin"
    assert liquidity_band(1_000) == "medium"
    assert liquidity_band(99_999) == "medium"
    assert liquidity_band(100_000) == "thick"
    assert liquidity_band(10_000_000) == "thick"
