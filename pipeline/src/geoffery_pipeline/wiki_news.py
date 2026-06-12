"""Poll the OSRS Wiki update pages for entries that influence prices (D-013).

Source pages (per D-013): `Upcoming_updates`, `Updates`, the current year's
page (e.g., `2026`). Accessed via the **MediaWiki API** — never HTML
scraping — at `https://oldschool.runescape.wiki/w/api.php`.

The poller fetches each source page's wikitext, splits it into update
sections, and upserts each unique entry into `wiki_updates`. The
`news_classifier` step then runs Claude Haiku over each unclassified
entry to derive per-item associations.

License compliance (binding per D-013): we extract a short factual
summary and store the original quote for classification *provenance* —
never as user-facing republication. Frontend renders only the original
summary in our voice plus a link to the wiki article.
"""

from __future__ import annotations

import argparse
import hashlib
import logging
import re
import sys
import time

import httpx

from .config import USER_AGENT
from .db import connect, heartbeat

LOG = logging.getLogger("geoffery.wiki_news")

WIKI_API = "https://oldschool.runescape.wiki/api.php"
WIKI_PAGE_BASE = "https://oldschool.runescape.wiki/w/"

# The three source pages the spec names. The current-year page is computed
# at runtime so January transitions don't need a release.
def current_year_page() -> str:
    return time.strftime("%Y")


def _client() -> httpx.Client:
    # follow_redirects=True is required: the wiki's api.php endpoint 301s
    # to a capitalized variant when called via httpx's path-only style.
    return httpx.Client(
        headers={"User-Agent": USER_AGENT},
        timeout=httpx.Timeout(30.0, read=30.0),
        follow_redirects=True,
    )


def _fetch_wikitext(page_title: str) -> tuple[str, list[dict]]:
    """Return (wikitext, sections) for a wiki page via MediaWiki API.

    `sections` is the api's `parse.sections` list — useful for splitting the
    page into per-update segments without our own heading parser.
    """
    params = {
        "action": "parse",
        "page": page_title,
        "format": "json",
        "prop": "wikitext|sections",
        "formatversion": "2",
    }
    with _client() as c:
        r = c.get(WIKI_API, params=params)
        r.raise_for_status()
        data = r.json()
        if "error" in data:
            raise RuntimeError(f"MediaWiki API error for {page_title}: {data['error']}")
        parse = data["parse"]
        return parse["wikitext"], parse.get("sections", [])


_HEADING = re.compile(r"^(==+)\s*(.+?)\s*\1\s*$", re.MULTILINE)


def _split_into_sections(wikitext: str) -> list[tuple[str, str]]:
    """Return list of (heading, body) pairs.

    Walks the wikitext top-to-bottom; each heading marker opens a new
    section, and the body collects until the next heading at any level.
    """
    sections: list[tuple[str, str]] = []
    last_end = 0
    last_heading = "(intro)"
    for m in _HEADING.finditer(wikitext):
        if last_heading:
            body = wikitext[last_end:m.start()].strip()
            if body:
                sections.append((last_heading, body))
        last_heading = m.group(2).strip()
        last_end = m.end()
    tail = wikitext[last_end:].strip()
    if tail and last_heading:
        sections.append((last_heading, tail))
    return sections


def _short_summary(body: str, max_chars: int = 400) -> str:
    """Strip wiki markup down to a single short factual sentence.

    The summary is OUR ORIGINAL PHRASING per the CC BY-NC-SA rule — the
    raw `quote` field captures the wiki source for the classifier's
    provenance.
    """
    # Strip wikilinks [[…|x]] → x, [[…]] → …
    s = re.sub(r"\[\[([^\]|]+)\|([^\]]+)\]\]", r"\2", body)
    s = re.sub(r"\[\[([^\]]+)\]\]", r"\1", s)
    # Strip templates {{ … }}
    s = re.sub(r"\{\{[^}]+\}\}", "", s)
    # Strip refs <ref>…</ref>
    s = re.sub(r"<ref[^>]*>.*?</ref>", "", s, flags=re.DOTALL)
    s = re.sub(r"<[^>]+>", "", s)
    # Collapse whitespace
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) > max_chars:
        s = s[:max_chars].rsplit(" ", 1)[0] + "…"
    return s


def _update_id(page: str, heading: str) -> str:
    """Deterministic id from page + heading so re-ingesting is a no-op."""
    h = hashlib.sha1(f"{page}::{heading}".encode("utf-8")).hexdigest()[:16]
    return f"{page.lower()}-{h}"


def _classify_kind(page: str, heading: str) -> str:
    """Coarse kind: 'upcoming' vs 'recent' vs 'past'.

    Routing rules:
    * `Upcoming_updates` page → all entries are `upcoming`.
    * Current-year page (e.g. `2026`) → `recent` (this year's chronicle).
    * `Updates` index page → `recent` (the wiki keeps this as the master
      changelog; the further-back portion is structurally past but the
      page itself surfaces what's-new and so reads as "recent" from a
      pricing perspective).
    * Anything else → `past`.
    """
    page_l = page.lower()
    if page_l.startswith("upcoming"):
        return "upcoming"
    cur_year = current_year_page()
    if cur_year in page_l or cur_year in heading:
        return "recent"
    if page_l == "updates":
        return "recent"
    return "past"


def poll_page(conn, page: str) -> dict:
    """Fetch one wiki page, upsert any new update sections."""
    LOG.info("polling %s", page)
    try:
        wikitext, _ = _fetch_wikitext(page)
    except httpx.HTTPError as e:
        LOG.warning("fetch failed for %s: %r — skipping", page, e)
        return {"page": page, "added": 0, "skipped": 0, "error": True}

    sections = _split_into_sections(wikitext)
    added = 0
    skipped = 0
    now = int(time.time())
    with conn:
        for heading, body in sections:
            if len(body) < 32:  # skip near-empty stubs
                continue
            uid = _update_id(page, heading)
            existing = conn.execute(
                "SELECT id FROM wiki_updates WHERE id = ?", (uid,)
            ).fetchone()
            if existing:
                skipped += 1
                continue
            summary = _short_summary(body)
            kind = _classify_kind(page, heading)
            wiki_url = WIKI_PAGE_BASE + page + "#" + heading.replace(" ", "_")
            conn.execute(
                """
                INSERT INTO wiki_updates
                  (id, page, title, summary, quote, kind, published_at,
                   discovered_at, wiki_url, classified_at, engine_version)
                VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, 0)
                """,
                (uid, page, heading, summary, body[:4000], kind, now, wiki_url),
            )
            added += 1
    LOG.info("%s: added=%d skipped=%d", page, added, skipped)
    return {"page": page, "added": added, "skipped": skipped}


def poll_all(conn) -> dict:
    """Poll every source page and return a small aggregate stats dict."""
    pages = ["Upcoming_updates", "Updates", current_year_page()]
    stats = {"pages": [], "added_total": 0}
    for p in pages:
        s = poll_page(conn, p)
        stats["pages"].append(s)
        stats["added_total"] += s.get("added", 0)
    return stats


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    p = argparse.ArgumentParser(description="Poll OSRS Wiki update pages.")
    args = p.parse_args()

    conn = connect()
    try:
        stats = poll_all(conn)
        LOG.info("wiki_news ok: %s", stats)
        heartbeat(conn, "wiki_news", ok=True)
        return 0
    except Exception as e:
        LOG.exception("wiki_news failed")
        heartbeat(conn, "wiki_news", ok=False, error=repr(e))
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
