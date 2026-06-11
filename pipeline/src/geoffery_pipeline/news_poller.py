"""Poll the OSRS news RSS feed and persist new items.

Each entry stores `title`, `summary` (cleaned plain text), `url`,
`categories_json`, and `affected_items_json` — the set of item IDs whose
names appear in title+summary, computed by `news_matcher.build_matcher`.

The aggregates layer reads `affected_items_json` to decide *which*
items' gauges flip to "unsettled" when news is recent — a per-item
check rather than the prior blanket "any news → all items unsettled"
rule. Items not mentioned by any recent article keep their real bands.

Every poll re-runs the matcher over every row's stored summary, so the
denylist or the item catalog can change without a separate migration —
the next poll re-derives `affected_items_json` from scratch.
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
from .news_matcher import build_matcher, strip_html

LOG = logging.getLogger("geoffery.news_poller")


def _parse_published(entry) -> int:
    parsed = entry.get("published_parsed")
    if parsed:
        return calendar.timegm(parsed)
    raw = entry.get("published")
    if raw:
        tz = parsedate_tz(raw)
        if tz:
            return mktime_tz(tz)
    return 0


def _entry_summary(entry) -> str:
    """Best-effort plain-text summary from the RSS entry."""
    raw = entry.get("summary") or entry.get("description") or ""
    return strip_html(raw).strip()


def _items_for_matcher(conn) -> list[tuple[int, str]]:
    rows = conn.execute("SELECT id, name FROM items").fetchall()
    return [(r["id"], r["name"]) for r in rows]


def poll(conn) -> dict:
    feed = feedparser.parse(OSRS_NEWS_RSS)
    if getattr(feed, "bozo", False) and not feed.entries:
        raise RuntimeError(f"RSS parse failure: {feed.bozo_exception!r}")

    matcher = build_matcher(_items_for_matcher(conn))

    written = 0
    updated_matches = 0

    with conn:
        for entry in feed.entries:
            url = entry.get("link")
            title = entry.get("title", "(untitled)")
            if not url:
                continue
            published_at = _parse_published(entry)
            summary = _entry_summary(entry)
            categories = [t.term for t in entry.get("tags", []) if getattr(t, "term", None)]
            affected = sorted(matcher(f"{title}\n{summary}"))

            cur = conn.execute(
                """
                INSERT INTO news_events
                    (published_at, title, summary, url, categories_json, affected_items_json)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(url) DO UPDATE SET
                    -- keep the earliest-recorded published_at + title,
                    -- but refresh summary + matches because the denylist /
                    -- item catalog may have shifted.
                    summary = excluded.summary,
                    affected_items_json = excluded.affected_items_json
                """,
                (published_at, title, summary, url, json.dumps(categories), json.dumps(affected)),
            )
            if cur.rowcount and cur.lastrowid:
                # rowcount==1 for both INSERT and UPDATE; distinguish by
                # whether this URL already existed.
                exists = conn.execute(
                    "SELECT 1 FROM news_events WHERE url = ? AND published_at = ?",
                    (url, published_at),
                ).fetchone()
                if exists:
                    written += 1  # rough count; INSERT vs UPDATE granularity is fine
                else:
                    updated_matches += 1

        # Also re-derive matches for any rows the current feed didn't include
        # (rows older than the 15-entry RSS window). This keeps the per-item
        # affected-set fresh against the current denylist / catalog.
        for r in conn.execute(
            "SELECT id, title, summary, affected_items_json FROM news_events"
        ).fetchall():
            new_matches = sorted(matcher(f"{r['title']}\n{r['summary']}"))
            new_json = json.dumps(new_matches)
            if new_json != (r["affected_items_json"] or "[]"):
                conn.execute(
                    "UPDATE news_events SET affected_items_json = ? WHERE id = ?",
                    (new_json, r["id"]),
                )
                updated_matches += 1

    return {"feed_entries": len(feed.entries), "written": written, "matches_updated": updated_matches}


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    conn = connect()
    try:
        stats = poll(conn)
        LOG.info("news_poller ok: %s", stats)
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
