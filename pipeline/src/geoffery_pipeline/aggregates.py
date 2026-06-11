"""Compute the deal gauge.

Inputs: prices_5m + prices_latest + news_events.
Output: one row per item in `aggregates` — the contract that frontend reads.

Gauge v1 (intentionally simple per spec §4):

  * Build the trailing 30-day volume-weighted distribution of mid-prices
    (mid = mean of avg_high and avg_low) per item.
  * Compute current mid and its percentile in that distribution.
  * Bands:
      good     = current mid <= p25  (below IQR)
      average  = p25 <  current mid <= p75
      poor     = current mid >  p75  (above IQR)
  * Unsettled when:
      - sample_count < MIN_SAMPLES (history too thin to be honest), or
      - 24h volume > VOLUME_SPIKE_MULTIPLE * 30-day baseline, or
      - a news event in the last NEWS_LOOKBACK_DAYS touched a category we'd
        match to this item (currently: every item; v1 has no category map yet
        so news events flip the entire market briefly — surface-honest), or
      - prices are missing.

Wording is **descriptive, not prescriptive**: "12% above 30-day average",
never "BUY/SELL". Methodology page renders the same text — Reddit-skeptic
verifiable (spec §4 prime directive).
"""

from __future__ import annotations

import json
import logging
import sqlite3
import statistics
import sys
import time

from .db import connect, heartbeat

LOG = logging.getLogger("geoffery.aggregates")

THIRTY_DAYS = 30 * 24 * 60 * 60
ONE_DAY = 24 * 60 * 60
MIN_SAMPLES = 30  # ~2.5 hours of 5m buckets; gauge is "unsettled" below this
VOLUME_SPIKE_MULTIPLE = 3.0
NEWS_LOOKBACK_DAYS = 3


def _mid(avg_high: int | None, avg_low: int | None) -> float | None:
    if avg_high is None and avg_low is None:
        return None
    if avg_high is None:
        return float(avg_low)  # type: ignore[arg-type]
    if avg_low is None:
        return float(avg_high)
    return (avg_high + avg_low) / 2.0


def _weighted_quantiles(
    prices: list[float], weights: list[float], qs: tuple[float, ...]
) -> tuple[float, ...]:
    """Volume-weighted quantile via cumulative weights. Simple, no scipy."""
    pairs = sorted(zip(prices, weights), key=lambda p: p[0])
    total = sum(w for _, w in pairs)
    if total <= 0:
        # fall back to unweighted
        sorted_p = sorted(prices)
        return tuple(statistics.quantiles(sorted_p, n=100)[int(q * 100) - 1] for q in qs)
    cum = 0.0
    targets = [q * total for q in qs]
    out: list[float] = []
    ti = 0
    for price, w in pairs:
        cum += w
        while ti < len(targets) and cum >= targets[ti]:
            out.append(price)
            ti += 1
    while ti < len(targets):
        out.append(pairs[-1][0])
        ti += 1
    return tuple(out)


def _percentile_rank(value: float, prices: list[float]) -> float:
    """Plain percentile rank (unweighted on sorted prices)."""
    if not prices:
        return 0.5
    below = sum(1 for p in prices if p < value)
    return below / len(prices)


def _band(current: float, p25: float, p75: float) -> str:
    if current <= p25:
        return "good"
    if current <= p75:
        return "average"
    return "poor"


def _verdict_text(band: str, percent_vs_p50: float) -> str:
    sign = "above" if percent_vs_p50 >= 0 else "below"
    pct = abs(round(percent_vs_p50))
    if band == "good":
        return f"{pct}% {sign} the 30-day median — the market favours you."
    if band == "average":
        return f"{pct}% {sign} the 30-day median — typical."
    return f"{pct}% {sign} the 30-day median — the market does not favour you."


def _has_recent_news(conn: sqlite3.Connection, since: int) -> bool:
    row = conn.execute(
        "SELECT 1 FROM news_events WHERE published_at >= ? LIMIT 1", (since,)
    ).fetchone()
    return row is not None


def compute_for_item(
    conn: sqlite3.Connection,
    item_id: int,
    now: int,
    has_recent_news: bool,
) -> dict | None:
    """Return aggregate dict for one item, or None if nothing to compute."""
    cutoff = now - THIRTY_DAYS
    rows = conn.execute(
        """
        SELECT ts, avg_high, avg_low, high_vol, low_vol
        FROM prices_5m
        WHERE item_id = ? AND ts >= ?
        ORDER BY ts
        """,
        (item_id, cutoff),
    ).fetchall()

    prices: list[float] = []
    weights: list[float] = []
    vol_24h = 0
    vol_total = 0
    day_cutoff = now - ONE_DAY
    for r in rows:
        mid = _mid(r["avg_high"], r["avg_low"])
        if mid is None:
            continue
        vol = (r["high_vol"] or 0) + (r["low_vol"] or 0)
        prices.append(mid)
        weights.append(float(vol or 1))  # weight=1 if zero so the price still counts
        vol_total += vol
        if r["ts"] >= day_cutoff:
            vol_24h += vol

    latest = conn.execute(
        "SELECT high, low FROM prices_latest WHERE item_id = ?", (item_id,)
    ).fetchone()
    current = _mid(latest["high"] if latest else None, latest["low"] if latest else None)

    flags: list[str] = []
    sample_count = len(prices)
    if sample_count < MIN_SAMPLES or current is None:
        if sample_count < MIN_SAMPLES:
            flags.append("thin-history")
        if current is None:
            flags.append("no-current-price")
        return {
            "item_id": item_id,
            "computed_at": now,
            "sample_count": sample_count,
            "p25": None,
            "p50": None,
            "p75": None,
            "current_price": current,
            "current_percentile": None,
            "band": "unsettled",
            "verdict_text": "The figures are unsettled. I would not stake my wages on them today.",
            "flags_json": json.dumps(flags),
            "volume_24h": vol_24h,
            "volume_baseline": 0,
        }

    p25, p50, p75 = _weighted_quantiles(prices, weights, (0.25, 0.5, 0.75))
    pct_rank = _percentile_rank(current, prices)

    avg_daily_volume = vol_total / 30.0
    volume_spike = avg_daily_volume > 0 and vol_24h > VOLUME_SPIKE_MULTIPLE * avg_daily_volume
    if volume_spike:
        flags.append("volume-spike")
    if has_recent_news:
        flags.append("recent-news")

    if volume_spike or has_recent_news:
        band = "unsettled"
        verdict = "The figures are unsettled. I would not stake my wages on them today."
    else:
        band = _band(current, p25, p75)
        verdict = _verdict_text(band, ((current - p50) / p50) * 100 if p50 else 0.0)

    return {
        "item_id": item_id,
        "computed_at": now,
        "sample_count": sample_count,
        "p25": p25,
        "p50": p50,
        "p75": p75,
        "current_price": current,
        "current_percentile": pct_rank,
        "band": band,
        "verdict_text": verdict,
        "flags_json": json.dumps(flags),
        "volume_24h": vol_24h,
        "volume_baseline": int(avg_daily_volume),
    }


def recompute_all(conn: sqlite3.Connection) -> int:
    now = int(time.time())
    news_since = now - NEWS_LOOKBACK_DAYS * ONE_DAY
    has_recent_news = _has_recent_news(conn, news_since)
    items = [r["id"] for r in conn.execute("SELECT id FROM items")]
    written = 0
    with conn:
        for iid in items:
            row = compute_for_item(conn, iid, now, has_recent_news)
            if row is None:
                continue
            conn.execute(
                """
                INSERT INTO aggregates
                    (item_id, computed_at, sample_count, p25, p50, p75,
                     current_price, current_percentile, band, verdict_text, flags_json,
                     volume_24h, volume_baseline)
                VALUES (:item_id, :computed_at, :sample_count, :p25, :p50, :p75,
                        :current_price, :current_percentile, :band, :verdict_text, :flags_json,
                        :volume_24h, :volume_baseline)
                ON CONFLICT(item_id) DO UPDATE SET
                    computed_at=excluded.computed_at, sample_count=excluded.sample_count,
                    p25=excluded.p25, p50=excluded.p50, p75=excluded.p75,
                    current_price=excluded.current_price,
                    current_percentile=excluded.current_percentile,
                    band=excluded.band, verdict_text=excluded.verdict_text,
                    flags_json=excluded.flags_json,
                    volume_24h=excluded.volume_24h, volume_baseline=excluded.volume_baseline
                """,
                row,
            )
            written += 1
    return written


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    conn = connect()
    try:
        n = recompute_all(conn)
        LOG.info("aggregates ok: %d items", n)
        heartbeat(conn, "aggregates", ok=True)
        return 0
    except Exception as e:
        LOG.exception("aggregates failed")
        heartbeat(conn, "aggregates", ok=False, error=repr(e))
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
