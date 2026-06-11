"""Sanity tests for the news → item-id matcher.

The matcher is intentionally fuzzy at the edges (4-char minimum, common-noun
denylist). These tests pin behaviour that future denylist edits must not
silently regress.
"""

from __future__ import annotations

from geoffery_pipeline.news_matcher import (
    COMMON_WORD_DENYLIST,
    build_matcher,
    strip_html,
)


def test_basic_match_on_distinctive_name():
    matcher = build_matcher([(20997, "Twisted bow"), (4151, "Abyssal whip")])
    assert matcher("The new Twisted bow drop rates are unchanged") == {20997}
    assert matcher("we're nerfing the Abyssal whip") == {4151}


def test_word_boundary_prevents_substring_hits():
    matcher = build_matcher([(1, "Whip")])
    # Whip is in the denylist? No, it's 4 chars. Should match standalone.
    assert matcher("got a Whip drop") == {1}
    # 'whiplash' should NOT match Whip — word boundary on /b
    assert matcher("the team made a whiplash decision") == set()


def test_short_names_skipped():
    matcher = build_matcher([(1, "Egg"), (2, "Tea"), (3, "Cake")])
    # All <4 chars except Cake (4), and Cake is in denylist anyway → no hits
    assert matcher("Egg drops in the new event, also a cake mention") == set()


def test_denylist_skips_common_nouns():
    # Hat is in the denylist
    assert "hat" in COMMON_WORD_DENYLIST
    matcher = build_matcher([(1043, "Hat"), (1051, "Cavalier")])
    assert matcher("his Hat fell off") == set()  # Hat denylisted
    assert matcher("the Cavalier hat is back") == {1051}  # Cavalier is fine


def test_case_insensitive():
    matcher = build_matcher([(1, "Dragon scimitar")])
    assert matcher("DRAGON SCIMITAR") == {1}
    assert matcher("dragon scimitar") == {1}


def test_longest_match_preferred():
    # Both "Saradomin sword" and "Sword" are items; longest wins
    matcher = build_matcher([(11838, "Saradomin sword"), (1277, "Sword")])
    hits = matcher("nerfing the Saradomin sword next week")
    assert 11838 in hits


def test_strip_html():
    assert "tag" in strip_html("<b>tag</b>")
    assert "<" not in strip_html("<p>hello <a href='x'>world</a></p>")
    # entity refs are also stripped
    cleaned = strip_html("hello&nbsp;world")
    assert "&" not in cleaned


def test_html_input_still_matches_after_strip():
    matcher = build_matcher([(1, "Bandos chestplate")])
    html = "<p>The <b>Bandos chestplate</b> drops more often now.</p>"
    assert matcher(html) == {1}


def test_empty_inputs_safe():
    matcher = build_matcher([(1, "Twisted bow")])
    assert matcher("") == set()
    assert matcher(None) == set()  # type: ignore[arg-type]


def test_empty_catalog_returns_no_op_matcher():
    matcher = build_matcher([])
    assert matcher("anything goes") == set()


def test_multiple_items_share_name_all_flagged():
    # Some wiki items have the same display name (variants)
    matcher = build_matcher([(100, "Toolkit"), (200, "Toolkit")])
    assert matcher("the Toolkit ships next week") == {100, 200}
