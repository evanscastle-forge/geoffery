"""Evaluate consultations against subsequent wiki data (D-011).

For each consultation whose tolerance window has elapsed but lacks an
outcome, scan the `prices_5m` table within the window and decide whether
the recommended level was crossed with nonzero volume:

  buy:  any 5m bucket within window where avg_low  <= rec_price AND
        low_vol > 0    → filled
  sell: any 5m bucket within window where avg_high >= rec_price AND
        high_vol > 0   → filled

The scorer evaluates the **rounded** price, never an internal unrounded
one (D-011 rounding rule). Outcomes write to `consultation_outcomes`;
`calibration` is re-tabulated per `confidence_bucket` afterwards.

Tolerance windows (tunable):
  instant  → 0..30 minutes after recommendation
  hours    → 4..8 hours
  patient  → 48..72 hours

This module is pure with respect to the SQLite connection — no D1, no
HTTP. The D1 sync layer in `d1_sync.py` is responsible for pulling
pending consultations from the edge before the scorer runs and for
pushing outcomes back after.
"""

from __future__ import annotations

import logging
import sqlite3
import sys
import time

from .db import connect, heartbeat

LOG = logging.getLogger("geoffery.scorer")

ONE_MIN = 60
ONE_HOUR = 3600
ONE_DAY = 86400

# (start_offset_seconds, end_offset_seconds) per tolerance class
WINDOWS = {
    "instant": (0,            30 * ONE_MIN),
    "hours":   (4 * ONE_HOUR, 8 * ONE_HOUR),
    "patient": (48 * ONE_HOUR, 72 * ONE_HOUR),
}


def _filled_within_window(
    conn: sqlite3.Connection,
    item_id: int,
    side: str,
    rec_price: int,
    window_start: int,
    window_end: int,
) -> tuple[bool, int | None]:
    """Return (filled, filled_at_ts). Scan ordered ascending so filled_at is
    the *first* bucket where the cross happened."""
    if side == "buy":
        # buy fills when something trades at or below the rec price with
        # nonzero volume on the low (insta-sell) side.
        rows = conn.execute(
            """
            SELECT ts FROM prices_5m
            WHERE item_id = ? AND ts >= ? AND ts < ?
              AND avg_low IS NOT NULL AND avg_low <= ?
              AND low_vol > 0
            ORDER BY ts LIMIT 1
            """,
            (item_id, window_start, window_end, rec_price),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT ts FROM prices_5m
            WHERE item_id = ? AND ts >= ? AND ts < ?
              AND avg_high IS NOT NULL AND avg_high >= ?
              AND high_vol > 0
            ORDER BY ts LIMIT 1
            """,
            (item_id, window_start, window_end, rec_price),
        ).fetchall()
    if rows:
        return True, rows[0]["ts"]
    return False, None


def score_pending(conn: sqlite3.Connection, now: int | None = None) -> dict:
    """Evaluate every consultation whose tolerance window has elapsed but
    lacks an outcome row. Returns a small stats dict."""
    now = now or int(time.time())
    rows = conn.execute(
        """
        SELECT c.id, c.item_id, c.side, c.tolerance, c.recommended_price,
               c.confidence_bucket, c.created_at
        FROM consultations c
        LEFT JOIN consultation_outcomes o ON o.consultation_id = c.id
        WHERE o.consultation_id IS NULL
        ORDER BY c.created_at
        """
    ).fetchall()

    evaluated = 0
    filled = 0
    skipped = 0
    with conn:
        for r in rows:
            start_off, end_off = WINDOWS[r["tolerance"]]
            window_start = r["created_at"] + start_off
            window_end = r["created_at"] + end_off
            if window_end > now:
                skipped += 1
                continue  # window not closed yet

            filled_bool, filled_at = _filled_within_window(
                conn,
                item_id=r["item_id"],
                side=r["side"],
                rec_price=int(r["recommended_price"]),
                window_start=window_start,
                window_end=window_end,
            )
            conn.execute(
                """
                INSERT INTO consultation_outcomes
                    (consultation_id, filled, filled_at,
                     eval_window_start, eval_window_end, evaluated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(consultation_id) DO UPDATE SET
                    filled = excluded.filled,
                    filled_at = excluded.filled_at,
                    eval_window_start = excluded.eval_window_start,
                    eval_window_end = excluded.eval_window_end,
                    evaluated_at = excluded.evaluated_at
                """,
                (r["id"], 1 if filled_bool else 0, filled_at,
                 window_start, window_end, now),
            )
            evaluated += 1
            if filled_bool:
                filled += 1

    if evaluated > 0:
        recompute_calibration(conn, now=now)

    return {
        "considered": len(rows),
        "evaluated": evaluated,
        "filled": filled,
        "window_not_closed": skipped,
    }


def recompute_calibration(conn: sqlite3.Connection, now: int | None = None) -> int:
    """Rebuild the per-cohort fill-rate table from all scored outcomes."""
    now = now or int(time.time())
    # Aggregate fill rates per confidence_bucket key.
    rows = conn.execute(
        """
        SELECT c.confidence_bucket,
               COUNT(*) AS n_total,
               SUM(o.filled) AS n_filled
        FROM consultations c
        JOIN consultation_outcomes o ON o.consultation_id = c.id
        GROUP BY c.confidence_bucket
        """
    ).fetchall()
    with conn:
        conn.execute("DELETE FROM calibration")
        for r in rows:
            n_total = int(r["n_total"])
            n_filled = int(r["n_filled"] or 0)
            fill_rate = n_filled / n_total if n_total > 0 else 0.0
            conn.execute(
                """
                INSERT INTO calibration (cohort_key, n_total, n_filled, fill_rate, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (r["confidence_bucket"], n_total, n_filled, fill_rate, now),
            )
    return len(rows)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    conn = connect()
    try:
        stats = score_pending(conn)
        LOG.info("scorer ok: %s", stats)
        heartbeat(conn, "scorer", ok=True)
        return 0
    except Exception as e:
        LOG.exception("scorer failed")
        heartbeat(conn, "scorer", ok=False, error=repr(e))
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
