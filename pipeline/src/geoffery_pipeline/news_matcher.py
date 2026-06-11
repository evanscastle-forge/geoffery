"""Map OSRS news article text to the set of item IDs it mentions.

Strategy: pre-compile one alternation regex over all sufficiently-distinctive
item names (case-insensitive, word-boundary). Names shorter than
`MIN_NAME_LEN` characters or in the common-word denylist are skipped — the
cost of missing a match for noisy common-noun items beats the cost of
unsettling every gauge whenever an article uses the word "bar" or "hat".

The matcher is built from the items table by the news poller. Built once per
poll; the regex compile is the only nontrivial cost (~0.1s for 4,000+
patterns) and each scan over a news article is sub-millisecond.

Per the Algorithms agent prime directive: descriptive, never prescriptive.
A news mention shifts the band to `unsettled`; it does NOT predict direction.
"""

from __future__ import annotations

import re
from collections.abc import Callable, Iterable

MIN_NAME_LEN = 4

# Common English words that are also OSRS item names. Matching these in
# article text produces too many false positives — articles use these words
# in everyday senses ("a key feature", "a hat of options"). Items whose
# lowercased name is in this set are skipped by the matcher. Add to it when
# a noisy match becomes a problem; subtract when an unsettled signal is
# being missed for a real, news-relevant item.
COMMON_WORD_DENYLIST = frozenset({
    "ale", "ball", "bar", "bell", "bone", "bones", "bread", "cake", "cape",
    "coal", "coin", "coins", "cup", "egg", "fish", "gold", "hat", "key",
    "log", "logs", "net", "ore", "pie", "plant", "ring", "rope", "salt",
    "saw", "stew", "tea", "wine",
})

# Strips HTML tags and entity refs into plain text. Cheap — feedparser
# summaries usually contain a few <p> / <a> tags.
_TAG = re.compile(r"<[^>]+>")
_ENTITY = re.compile(r"&[a-zA-Z#0-9]+;")


def strip_html(text: str) -> str:
    s = _TAG.sub(" ", text or "")
    return _ENTITY.sub(" ", s)


Matcher = Callable[[str], set[int]]


def build_matcher(items: Iterable[tuple[int, str]]) -> Matcher:
    """`items`: iterable of (item_id, item_name). Returns text → set of ids.

    Multiple items may share a name (variants in the wiki); a hit on a
    shared name flags all of them.
    """
    by_name: dict[str, list[int]] = {}
    for iid, name in items:
        lname = (name or "").lower().strip()
        if len(lname) < MIN_NAME_LEN or lname in COMMON_WORD_DENYLIST:
            continue
        by_name.setdefault(lname, []).append(iid)

    if not by_name:
        return lambda _text: set()

    # Sort by length descending so the regex engine's leftmost-longest pass
    # prefers "Saradomin sword" over "sword" when both appear in the text.
    names_sorted = sorted(by_name.keys(), key=len, reverse=True)
    pattern = "|".join(re.escape(n) for n in names_sorted)
    regex = re.compile(r"\b(?:" + pattern + r")\b", re.IGNORECASE)

    def match(text: str) -> set[int]:
        if not text:
            return set()
        hits: set[int] = set()
        for m in regex.finditer(strip_html(text)):
            for iid in by_name[m.group(0).lower()]:
                hits.add(iid)
        return hits

    return match
