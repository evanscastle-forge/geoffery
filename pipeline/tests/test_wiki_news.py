"""Tests for the wiki update parser (D-013).

These pin the wikitext → sections + summary logic that the live MediaWiki
poller depends on. The HTTP fetch itself is not unit-tested (live URL
verification done in the integration run).
"""

from __future__ import annotations

from geoffery_pipeline.wiki_news import (
    _classify_kind,
    _short_summary,
    _split_into_sections,
    _update_id,
)


SAMPLE_WIKITEXT = """\
This page lists upcoming updates.

== Confirmed updates ==
* '''Tombs of Amascut''' — release scheduled.
* New twisted bow rebalance per Mod feedback.

== Speculative updates ==
The following are unconfirmed:
* PVP overhaul.
* Wilderness rework.

== References ==
<references/>
"""


def test_split_into_sections_returns_headed_blocks():
    sections = _split_into_sections(SAMPLE_WIKITEXT)
    titles = [t for t, _ in sections]
    assert "Confirmed updates" in titles
    assert "Speculative updates" in titles
    assert "References" in titles


def test_split_includes_intro_when_present():
    sections = _split_into_sections(SAMPLE_WIKITEXT)
    intro = next((b for t, b in sections if t == "(intro)"), None)
    assert intro is not None
    assert "upcoming updates" in intro.lower()


def test_short_summary_strips_wiki_markup():
    body = (
        "[[Twisted bow]] is being [[balance|rebalanced]] this week.\n"
        "{{Update|date=2026-06-12}}\n"
        "See <ref>Mod blog</ref>{{cn}}."
    )
    s = _short_summary(body)
    assert "Twisted bow" in s
    assert "rebalanced" in s
    assert "{{" not in s
    assert "<ref" not in s
    assert "[[" not in s


def test_short_summary_truncates_long_text():
    body = "x " * 1000
    s = _short_summary(body, max_chars=80)
    assert len(s) <= 81  # +1 for the ellipsis


def test_update_id_is_deterministic():
    a = _update_id("Upcoming_updates", "Confirmed updates")
    b = _update_id("Upcoming_updates", "Confirmed updates")
    c = _update_id("Updates", "Confirmed updates")
    assert a == b
    assert a != c


def test_classify_kind_routes_pages_to_buckets():
    assert _classify_kind("Upcoming_updates", "Anything") == "upcoming"
    # current-year page → recent
    import time

    year = time.strftime("%Y")
    assert _classify_kind(year, "Anything") == "recent"
    # Updates index page → recent (current chronicle of what shipped)
    assert _classify_kind("Updates", "Anything") == "recent"
    # Old year page → past
    assert _classify_kind("2019", "Anything") == "past"
