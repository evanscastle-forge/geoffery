"""Poll the OSRS news RSS feed and persist new items.

The v1 categorization is intentionally coarse: a news item touches "the market"
or it doesn't. Aggregates treat any news in the last NEWS_LOOKBACK_DAYS as a
reason to flip ALL gauges to "unsettled" — honest about the fact that we have
no category mapping yet (spec §4 trust-via-transparency directive).

When a category map is added (post-MVP), per-item matching lands here.
"""

from __future__ import annotations

import calendar
import json
import logging
import sys
from email.utils import parsedate_tz, mktime_tz

import feedparser

from .config import OSRS_NEWS_RSS
from .db import connect, heartbeat

LOG = logging.getLogger("geoffery.news_poller")


def _parse_published(entry) -> int:
    """RSS entries carry published_parsed; fall back to email format."""
    parsed = entry.get("published_parsed")
    if parsed:
        return calendar.timegm(parsed)
    raw = entry.get("published")
    if raw:
        tz = parsedate_tz(raw)
        if tz:
            return mktime_tz(tz)
    return 0


def poll(conn) -> int:
    feed = feedparser.parse(OSRS_NEWS_RSS)
    if getattr(feed, "bozo", False) and not feed.entries:
        raise RuntimeError(f"RSS parse failure: {feed.bozo_exception!r}")
    written = 0
    with conn:
        for entry in feed.entries:
            url = entry.get("link")
            title = entry.get("title", "(untitled)")
            if not url:
                continue
            published_at = _parse_published(entry)
            categories = [t.term for t in entry.get("tags", []) if getattr(t, "term", None)]
            cur = conn.execute(
                """
                INSERT OR IGNORE INTO news_events (published_at, title, url, categories_json)
                VALUES (?, ?, ?, ?)
                """,
                (published_at, title, url, json.dumps(categories)),
            )
            if cur.rowcount:
                written += 1
    return written


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    conn = connect()
    try:
        n = poll(conn)
        LOG.info("news_poller ok: %d new entries", n)
        heartbeat(conn, "news_poller", ok=True)
        return 0
    except Exception as e:
        LOG.exception("news_poller failed")
        heartbeat(conn, "news_poller", ok=False, error=repr(e))
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
