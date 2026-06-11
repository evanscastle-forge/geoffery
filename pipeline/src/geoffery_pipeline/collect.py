"""Top-level collector entry point. Idempotent.

Run every 5 minutes. Refreshes the items mapping daily, then fetches /latest
and the newest /5m bucket and upserts. Records a heartbeat the ops layer alerts
on if it goes stale.

Usage:
    uv run python -m geoffery_pipeline.collect
"""

from __future__ import annotations

import logging
import sys
import time

from . import wiki_api
from .db import connect, heartbeat
from .slug import slugify

LOG = logging.getLogger("geoffery.collect")
MAPPING_TTL_SECONDS = 24 * 60 * 60  # refresh items mapping once a day


def refresh_mapping_if_stale(conn) -> int:
    row = conn.execute("SELECT MAX(updated_at) AS m FROM items").fetchone()
    last = row["m"] or 0
    if time.time() - last < MAPPING_TTL_SECONDS:
        return 0
    LOG.info("refreshing item mapping")
    items = wiki_api.fetch_mapping()
    now = int(time.time())
    # Assign slugs deterministically: the lowest-id item with a given name gets
    # the plain slug; subsequent collisions get -{id} appended. Sorting by id
    # keeps URLs stable across wiki additions (URL is a one-way door).
    existing_slug_for_id = {
        r["id"]: r["slug"] for r in conn.execute("SELECT id, slug FROM items").fetchall()
    }
    used_slugs: set[str] = set(existing_slug_for_id.values())
    slug_map: dict[int, str] = {}
    for item in sorted(items, key=lambda i: i.id):
        if item.id in existing_slug_for_id:
            slug_map[item.id] = existing_slug_for_id[item.id]  # never reassign
            continue
        base = slugify(item.name)
        candidate = base if base not in used_slugs else f"{base}-{item.id}"
        slug_map[item.id] = candidate
        used_slugs.add(candidate)

    with conn:  # one transaction
        for item in items:
            conn.execute(
                """
                INSERT INTO items (id, name, slug, examine, members, ge_limit,
                                   value, highalch, lowalch, icon, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name=excluded.name, examine=excluded.examine,
                    members=excluded.members, ge_limit=excluded.ge_limit,
                    value=excluded.value, highalch=excluded.highalch,
                    lowalch=excluded.lowalch, icon=excluded.icon,
                    updated_at=excluded.updated_at
                """,
                (
                    item.id,
                    item.name,
                    slug_map[item.id],
                    item.examine,
                    1 if item.members else 0,
                    item.limit,
                    item.value,
                    item.highalch,
                    item.lowalch,
                    item.icon,
                    now,
                ),
            )
    return len(items)


def upsert_latest(conn) -> int:
    latest = wiki_api.fetch_latest()
    known = {r["id"] for r in conn.execute("SELECT id FROM items").fetchall()}
    now = int(time.time())
    skipped = 0
    with conn:
        for iid, entry in latest.items():
            if iid not in known:
                skipped += 1
                continue
            conn.execute(
                """
                INSERT INTO prices_latest (item_id, high, high_ts, low, low_ts, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(item_id) DO UPDATE SET
                    high=excluded.high, high_ts=excluded.high_ts,
                    low=excluded.low,   low_ts=excluded.low_ts,
                    fetched_at=excluded.fetched_at
                """,
                (iid, entry.high, entry.high_time, entry.low, entry.low_time, now),
            )
    if skipped:
        LOG.info("skipped %d /latest entries with no mapping row", skipped)
    return len(latest) - skipped


def upsert_5m(conn) -> tuple[int, int]:
    bucket_ts, entries = wiki_api.fetch_5m()
    known = {r["id"] for r in conn.execute("SELECT id FROM items").fetchall()}
    skipped = 0
    with conn:
        for iid, entry in entries.items():
            if iid not in known:
                skipped += 1
                continue
            conn.execute(
                """
                INSERT OR REPLACE INTO prices_5m
                    (item_id, ts, avg_high, avg_low, high_vol, low_vol)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    iid,
                    bucket_ts,
                    entry.avg_high_price,
                    entry.avg_low_price,
                    entry.high_price_volume,
                    entry.low_price_volume,
                ),
            )
    if skipped:
        LOG.info("skipped %d /5m entries with no mapping row", skipped)
    return bucket_ts, len(entries) - skipped


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    conn = connect()
    try:
        n_items = refresh_mapping_if_stale(conn)
        n_latest = upsert_latest(conn)
        bucket_ts, n_5m = upsert_5m(conn)
        LOG.info(
            "collect ok: mapping=%d latest=%d 5m=%d bucket=%s",
            n_items,
            n_latest,
            n_5m,
            bucket_ts,
        )
        heartbeat(conn, "collect", ok=True)
        return 0
    except Exception as e:
        LOG.exception("collect failed")
        heartbeat(conn, "collect", ok=False, error=repr(e))
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
