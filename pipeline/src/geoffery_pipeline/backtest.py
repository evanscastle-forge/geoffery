"""Cold-start backtest: replay the recommendation engine across history (D-011).

The published track record is the moat. Until live consultations accumulate,
the backtest is what fills that ledger: at evenly-spaced timestamps across
the trailing N days, for each item with enough history at that point,
synthesize a consultation (buy + sell × instant + hours + patient) using
the regime/recommend engine. Then use the scorer logic to evaluate whether
each synthetic consultation would have filled in its tolerance window.

The result lives in `calibration` keyed by `confidence_bucket`, identical
to live operation — so the methodology page reads from one table and
doesn't need to distinguish "live" from "backtest" record. The blended
record is honest because the engine version is pinned by D-011.

Performance: scanning a 30d×288 = 8,640 5m bucket history at, say, 200
synthetic consultations per item × 4,500 items × 6 recommendations =
~5M scoring evaluations. We sample sparsely (one synthetic consultation
per item per N hours) to keep the run under ~10 minutes.
"""

from __future__ import annotations

import argparse
import logging
import sqlite3
import sys
import time

from .db import connect, heartbeat
from .recommend import ENGINE_VERSION, recommend
from .regime import classify as classify_regime
from .regime import liquidity_band as compute_liquidity_band
from .scorer import WINDOWS, _filled_within_window, recompute_calibration

LOG = logging.getLogger("geoffery.backtest")

ONE_HOUR = 3600
ONE_DAY = 86400

# Synthetic consultation cadence: one per (item, side, tolerance) per N hours
# of history. Lower = more samples = longer runtime; higher = faster but
# coarser calibration.
DEFAULT_CADENCE_HOURS = 12
DEFAULT_HORIZON_DAYS = 21  # leave a buffer at the recent end so patient (72h) windows have data


def _item_rows_through(conn, item_id: int, end_ts: int, since_ts: int) -> list[dict]:
    rows = conn.execute(
        """
        SELECT ts, avg_high, avg_low, high_vol, low_vol
        FROM prices_5m
        WHERE item_id = ? AND ts >= ? AND ts <= ?
        ORDER BY ts
        """,
        (item_id, since_ts, end_ts),
    ).fetchall()
    return [dict(r) for r in rows]


def _latest_through(conn, item_id: int, ref_ts: int) -> tuple[int | None, int | None]:
    """The most recent insta-buy/sell pair on or before `ref_ts` (proxy for
    `prices_latest` at that point in time)."""
    r = conn.execute(
        """
        SELECT avg_high, avg_low FROM prices_5m
        WHERE item_id = ? AND ts <= ?
        ORDER BY ts DESC LIMIT 1
        """,
        (item_id, ref_ts),
    ).fetchone()
    if not r:
        return None, None
    return r["avg_high"], r["avg_low"]


def backtest(
    conn: sqlite3.Connection,
    *,
    horizon_days: int = DEFAULT_HORIZON_DAYS,
    cadence_hours: int = DEFAULT_CADENCE_HOURS,
) -> dict:
    now = int(time.time())
    horizon_start = now - horizon_days * ONE_DAY
    # leave the most recent 72 hours alone so 'patient' synthetic
    # consultations have a closed evaluation window.
    horizon_end = now - 72 * ONE_HOUR

    items = [r["id"] for r in conn.execute("SELECT id FROM items").fetchall()]

    total_consultations = 0
    total_filled = 0
    by_bucket_total: dict[str, int] = {}
    by_bucket_filled: dict[str, int] = {}

    cadence_seconds = cadence_hours * ONE_HOUR

    for item_id in items:
        # Walk timestamps backward from the horizon_end at cadence steps.
        ref_ts = horizon_end
        while ref_ts >= horizon_start + 7 * ONE_DAY:  # need at least 7d of history
            window_rows = _item_rows_through(
                conn, item_id, end_ts=ref_ts, since_ts=ref_ts - 30 * ONE_DAY
            )
            if len(window_rows) < 60:  # ~5 hours of buckets minimum
                ref_ts -= cadence_seconds
                continue

            regime = classify_regime(window_rows, ref_ts)
            if regime is None:
                ref_ts -= cadence_seconds
                continue

            mids = []
            vol_total = 0
            for r in window_rows:
                if r["avg_high"] is not None and r["avg_low"] is not None:
                    mids.append((r["avg_high"] + r["avg_low"]) / 2.0)
                elif r["avg_high"] is not None:
                    mids.append(float(r["avg_high"]))
                elif r["avg_low"] is not None:
                    mids.append(float(r["avg_low"]))
                vol_total += (r["high_vol"] or 0) + (r["low_vol"] or 0)

            liquidity = compute_liquidity_band(int(vol_total / 30.0))
            insta_buy, insta_sell = _latest_through(conn, item_id, ref_ts)
            sorted_mids = sorted(mids)

            for tolerance in ("instant", "hours", "patient"):
                for side in ("buy", "sell"):
                    r = recommend(
                        side=side,  # type: ignore[arg-type]
                        tolerance=tolerance,  # type: ignore[arg-type]
                        regime=regime,
                        liquidity=liquidity,
                        current_insta_buy=insta_buy,
                        current_insta_sell=insta_sell,
                        recent_mids_sorted=sorted_mids,
                    )
                    if r is None:
                        continue

                    start_off, end_off = WINDOWS[tolerance]
                    win_start = ref_ts + start_off
                    win_end = ref_ts + end_off
                    filled_bool, _ = _filled_within_window(
                        conn, item_id, side, r.price, win_start, win_end
                    )

                    total_consultations += 1
                    if filled_bool:
                        total_filled += 1
                    by_bucket_total[r.confidence_bucket] = by_bucket_total.get(r.confidence_bucket, 0) + 1
                    if filled_bool:
                        by_bucket_filled[r.confidence_bucket] = by_bucket_filled.get(r.confidence_bucket, 0) + 1

            ref_ts -= cadence_seconds

    # Write directly into calibration as a snapshot. If live consultations
    # already exist, merge them in via recompute_calibration afterwards.
    with conn:
        conn.execute("DELETE FROM calibration")
        for bucket, n_total in by_bucket_total.items():
            n_filled = by_bucket_filled.get(bucket, 0)
            conn.execute(
                """
                INSERT INTO calibration (cohort_key, n_total, n_filled, fill_rate, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (bucket, n_total, n_filled, (n_filled / n_total) if n_total else 0.0, now),
            )

    # Merge in any live consultations that already exist.
    recompute_calibration(conn, now=now)

    return {
        "synthetic_consultations": total_consultations,
        "filled": total_filled,
        "overall_fill_rate": (total_filled / total_consultations) if total_consultations else 0.0,
        "cohorts": len(by_bucket_total),
        "horizon_days": horizon_days,
        "cadence_hours": cadence_hours,
        "engine_version": ENGINE_VERSION,
    }


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    p = argparse.ArgumentParser(description="Cold-start backtest of the recommendation engine.")
    p.add_argument("--horizon-days", type=int, default=DEFAULT_HORIZON_DAYS)
    p.add_argument("--cadence-hours", type=int, default=DEFAULT_CADENCE_HOURS)
    args = p.parse_args()

    conn = connect()
    try:
        stats = backtest(conn, horizon_days=args.horizon_days, cadence_hours=args.cadence_hours)
        LOG.info("backtest ok: %s", stats)
        heartbeat(conn, "backtest", ok=True)
        return 0
    except Exception as e:
        LOG.exception("backtest failed")
        heartbeat(conn, "backtest", ok=False, error=repr(e))
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
