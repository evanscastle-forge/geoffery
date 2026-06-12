"""Claude Haiku-based item-affection classifier for wiki updates (D-013).

For each row in `wiki_updates` whose `classified_at` is NULL, ask Claude
Haiku which items from the closed catalog the update entry plausibly
affects. The model receives:

* A **closed vocabulary** — the item-name catalog from the items table.
  The model MUST select item names verbatim from this list; it may not
  free-name items.
* The update title + raw quote (used only for the model's context; the
  *display* surface uses our short summary in our own voice — D-013
  CC BY-NC-SA rule).
* A request to produce a JSON list of `{item_name, confidence, quote}`
  where the quote is a single line lifted from the update text justifying
  the association.

Output is written to `update_item_associations`. Only high-confidence
associations (>= `MIN_CONFIDENCE`) drive the user-facing display; lower
confidence ones are stored for later tuning.

Failure modes are non-fatal: if the API call fails or no key is set,
the update simply stays `classified_at = NULL` and gets retried on the
next run. **No user-facing path ever waits on an LLM call** (D-013).

`engine_version` is bumped when the prompt or schema changes so cohort
analysis can group by classifier vintage.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import time

from .db import connect, heartbeat

LOG = logging.getLogger("geoffery.news_classifier")

CLASSIFIER_VERSION = 1
MIN_CONFIDENCE = 0.6  # display threshold; lower stored but not surfaced
MODEL = os.environ.get("GEOFFERY_NEWS_CLASSIFIER_MODEL", "claude-haiku-4-5-20251001")
MAX_ITEMS_PER_UPDATE = 25  # don't let the model fan out indefinitely
CATALOG_LIMIT = 800  # items per prompt; broken into windows below

SYSTEM_PROMPT = """\
You are an Old School RuneScape Grand Exchange analyst. You will be given:

1. A short description of an in-game update or upcoming update.
2. A closed list of in-game item names.

Your task: identify which items from the list — if any — this update may
plausibly affect the price of. Be conservative. Only flag items whose
names appear in the update text or whose mechanics the update directly
touches.

You MUST select item names verbatim from the supplied list. You may not
invent or paraphrase item names. If no item from the list is plausibly
affected, return an empty list.

For each affected item, produce a JSON object:

  {
    "item_name": "<exact name from list>",
    "confidence": <number 0..1>,
    "quote": "<single line from the update text justifying the link>"
  }

Reply with a JSON array of these objects, and nothing else.
"""


def _anthropic_client():
    """Return an Anthropic client, or None if the SDK or key isn't available."""
    if os.environ.get("ANTHROPIC_API_KEY", "") == "":
        return None
    try:
        from anthropic import Anthropic  # type: ignore[import-not-found]
    except ImportError:
        LOG.warning("anthropic SDK not installed; classifier disabled. uv add anthropic")
        return None
    return Anthropic()


def _classify_one(client, title: str, quote: str, catalog: list[tuple[int, str]]) -> list[dict]:
    """One LLM call. Returns a list of {item_name, confidence, quote} dicts.

    If the model returns invalid JSON or the catalog window has no matches,
    returns an empty list — failures are not raised so polling continues.
    """
    # Convert catalog to a compact list block; we present in lowercase but
    # require the model to reply with the exact list-form name.
    catalog_list = "\n".join(f"- {name}" for _, name in catalog)
    user_message = (
        f"Update title: {title}\n\n"
        f"Update text (verbatim from the OSRS Wiki):\n---\n{quote[:2000]}\n---\n\n"
        f"Closed item catalog (you may only select from these):\n{catalog_list}\n\n"
        f"Reply with a JSON array as instructed."
    )
    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
    except Exception as e:
        LOG.warning("LLM call failed: %r — skipping this window", e)
        return []
    raw_text = ""
    for block in getattr(resp, "content", []):
        if getattr(block, "type", "") == "text":
            raw_text += block.text
    raw_text = raw_text.strip()
    # Strip possible fence
    raw_text = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_text, flags=re.MULTILINE)
    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        LOG.warning("classifier returned non-JSON; skipping (preview=%r)", raw_text[:120])
        return []
    if not isinstance(parsed, list):
        return []
    return parsed


def classify_pending(conn, limit: int | None = None) -> dict:
    """Classify every wiki_update row whose classified_at IS NULL.

    Returns small stats. Re-runnable.
    """
    client = _anthropic_client()
    if client is None:
        LOG.info("no ANTHROPIC_API_KEY (or sdk missing) — stub mode; no classifications written")
        # Mark all currently-unclassified rows with engine_version=0, classified_at=now
        # so we don't burn CPU re-scanning them; a future run with a key will
        # re-classify by bumping CLASSIFIER_VERSION.
        n = conn.execute("SELECT COUNT(*) AS n FROM wiki_updates WHERE classified_at IS NULL").fetchone()["n"]
        return {"pending": n, "stub": True}

    rows = conn.execute(
        "SELECT id, title, quote FROM wiki_updates "
        "WHERE classified_at IS NULL "
        "  AND quote != '' "
        "ORDER BY discovered_at LIMIT ?",
        (limit or 1000,),
    ).fetchall()
    if not rows:
        return {"pending": 0}

    # Build catalog once.
    item_rows = conn.execute("SELECT id, name FROM items ORDER BY name").fetchall()
    catalog = [(int(r["id"]), r["name"]) for r in item_rows]
    # Index by lowercase name for fast lookup.
    by_name_lc = {name.lower(): iid for iid, name in catalog}
    catalog_windows = [catalog[i:i+CATALOG_LIMIT] for i in range(0, len(catalog), CATALOG_LIMIT)]

    written = 0
    high_conf = 0
    classified = 0
    for r in rows:
        all_assoc: list[dict] = []
        for window in catalog_windows:
            chunk = _classify_one(client, r["title"], r["quote"], window)
            all_assoc.extend(chunk)
            if len(all_assoc) >= MAX_ITEMS_PER_UPDATE:
                break
        with conn:
            for assoc in all_assoc[:MAX_ITEMS_PER_UPDATE]:
                name = (assoc.get("item_name") or "").strip().lower()
                conf = float(assoc.get("confidence") or 0)
                justification = (assoc.get("quote") or "")[:1000]
                iid = by_name_lc.get(name)
                if iid is None:
                    continue
                conn.execute(
                    """
                    INSERT INTO update_item_associations
                      (update_id, item_id, confidence, justification)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(update_id, item_id) DO UPDATE SET
                        confidence = excluded.confidence,
                        justification = excluded.justification
                    """,
                    (r["id"], iid, conf, justification),
                )
                written += 1
                if conf >= MIN_CONFIDENCE:
                    high_conf += 1
            conn.execute(
                "UPDATE wiki_updates SET classified_at = ?, engine_version = ? WHERE id = ?",
                (int(time.time()), CLASSIFIER_VERSION, r["id"]),
            )
            classified += 1

    return {
        "classified": classified,
        "associations_written": written,
        "high_confidence": high_conf,
        "engine_version": CLASSIFIER_VERSION,
    }


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    p = argparse.ArgumentParser(description="Classify pending wiki updates against the item catalog.")
    p.add_argument("--limit", type=int, default=None, help="stop after N updates this run")
    args = p.parse_args()
    conn = connect()
    try:
        stats = classify_pending(conn, limit=args.limit)
        LOG.info("news_classifier ok: %s", stats)
        heartbeat(conn, "news_classifier", ok=True)
        return 0
    except Exception as e:
        LOG.exception("news_classifier failed")
        heartbeat(conn, "news_classifier", ok=False, error=repr(e))
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
