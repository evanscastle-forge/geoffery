"""One-shot historical backfill of the 5-minute price series.

Geoffery's gauge uses a 30-day window (see `aggregates.py:THIRTY_DAYS`),
so until 30 days of history accrue from the live collector, every gauge
reads "unsettled". The wiki's `/5m?timestamp=<ts>` endpoint serves
historical buckets too — this module walks it backward from now to a
target horizon, upserting into `prices_5m` (same schema, same conflict
rule the live collector uses, so the two paths are idempotent against
each other).

Wiki etiquette:
- Sustained rate: ~1 request per second.
- Courtesy pause every 100 requests.
- Descriptive User-Agent (set in `config.py`).
- Resumable: `--resume` (default) picks up from the oldest existing 5m
  row and only fetches buckets older than that, so re-running after a
  crash doesn't re-burn the rate budget.

Usage:
    uv run python -m geoffery_pipeline.backfill              # 30 days, resume
    uv run python -m geoffery_pipeline.backfill --days 7     # last week
    uv run python -m geoffery_pipeline.backfill --no-resume  # restart from now
"""

from __future__ import annotations

import argparse
import logging
import sys
import time

from . import wiki_api
from .db import connect, heartbeat

LOG = logging.getLogger("geoffery.backfill")

FIVE_MIN = 5 * 60
ONE_DAY = 86400
DEFAULT_DAYS = 30

SUSTAINED_SLEEP = 1.0      # seconds between requests
COURTESY_PAUSE_EVERY = 100  # requests
COURTESY_PAUSE = 2.0
PROGRESS_EVERY = 50


def _bucket_floor(ts: int) -> int:
    """Snap a unix timestamp down to the nearest 5-minute boundary."""
    return (ts // FIVE_MIN) * FIVE_MIN


def _earliest_existing_bucket(conn) -> int | None:
    row = conn.execute("SELECT MIN(ts) AS m FROM prices_5m").fetchone()
    return row["m"] if row and row["m"] is not None else None


def _known_item_ids(conn) -> set[int]:
    return {r["id"] for r in conn.execute("SELECT id FROM items").fetchall()}


def backfill(days: int, *, resume: bool) -> dict:
    """Walk /5m backward; return a small stats dict for callers."""
    conn = connect()
    now = int(time.time())
    target_oldest = now - days * ONE_DAY
    bucket_ts = _bucket_floor(now) - FIVE_MIN

    if resume:
        earliest = _earliest_existing_bucket(conn)
        if earliest is not None and earliest > target_oldest:
            # We already have buckets between [earliest, now] — keep
            # walking backward from before the earliest known row.
            bucket_ts = earliest - FIVE_MIN
            LOG.info("resuming from %s (one bucket older than earliest existing)", bucket_ts)
        elif earliest is not None and earliest <= target_oldest:
            LOG.info(
                "already backfilled past target (earliest=%s, target=%s); nothing to do",
                earliest,
                target_oldest,
            )
            return {"requests": 0, "rows_written": 0, "stopped_at": earliest}

    known = _known_item_ids(conn)
    if not known:
        raise RuntimeError(
            "items table is empty — run `collect` once first to populate /mapping"
        )

    LOG.info(
        "backfilling /5m from ts=%d back to ts=%d (~%d buckets, items=%d)",
        bucket_ts,
        target_oldest,
        max(0, (bucket_ts - target_oldest) // FIVE_MIN),
        len(known),
    )

    requests = 0
    rows_written = 0
    skipped_unknown = 0
    skipped_empty = 0
    started = time.time()

    try:
        while bucket_ts >= target_oldest:
            try:
                ts_returned, entries = wiki_api.fetch_5m(bucket_ts)
            except Exception as e:
                LOG.warning("fetch failed at ts=%s (%r); pausing 30s and retrying once", bucket_ts, e)
                time.sleep(30)
                ts_returned, entries = wiki_api.fetch_5m(bucket_ts)

            requests += 1

            if not entries:
                # Wiki returned an empty bucket — either pre-dates retention or
                # was a quiet window. Step back and keep going.
                skipped_empty += 1
            else:
                with conn:
                    for iid, entry in entries.items():
                        if iid not in known:
                            skipped_unknown += 1
                            continue
                        conn.execute(
                            """
                            INSERT OR REPLACE INTO prices_5m
                                (item_id, ts, avg_high, avg_low, high_vol, low_vol)
                            VALUES (?, ?, ?, ?, ?, ?)
                            """,
                            (
                                iid,
                                ts_returned,
                                entry.avg_high_price,
                                entry.avg_low_price,
                                entry.high_price_volume,
                                entry.low_price_volume,
                            ),
                        )
                        rows_written += 1

            if requests % PROGRESS_EVERY == 0:
                elapsed = time.time() - started
                rate = requests / elapsed if elapsed > 0 else 0
                LOG.info(
                    "progress: requests=%d rows=%d empty_buckets=%d ts=%s rate=%.1f req/s",
                    requests, rows_written, skipped_empty, bucket_ts, rate,
                )
                heartbeat(conn, "backfill", ok=True)

            if requests % COURTESY_PAUSE_EVERY == 0:
                time.sleep(COURTESY_PAUSE)
            else:
                time.sleep(SUSTAINED_SLEEP)

            bucket_ts -= FIVE_MIN
    except KeyboardInterrupt:
        LOG.warning("interrupted at ts=%s — partial backfill persisted", bucket_ts)
        heartbeat(conn, "backfill", ok=False, error="interrupted by user")
        return {
            "requests": requests,
            "rows_written": rows_written,
            "stopped_at": bucket_ts + FIVE_MIN,
            "interrupted": True,
        }

    heartbeat(conn, "backfill", ok=True)
    return {
        "requests": requests,
        "rows_written": rows_written,
        "stopped_at": bucket_ts + FIVE_MIN,
        "interrupted": False,
        "skipped_unknown": skipped_unknown,
        "skipped_empty": skipped_empty,
    }


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    p = argparse.ArgumentParser(description="Backfill /5m prices from the wiki API.")
    p.add_argument("--days", type=int, default=DEFAULT_DAYS, help="how many days back to fetch")
    p.add_argument("--no-resume", action="store_true", help="restart from now even if buckets exist")
    args = p.parse_args()

    stats = backfill(days=args.days, resume=not args.no_resume)
    LOG.info("backfill complete: %s", stats)
    return 0


if __name__ == "__main__":
    sys.exit(main())
