"""Item slug generation. The slug is part of the URL pattern (one-way door):

    /item/{slug} → "Twisted bow GE price & deal rating — Geoffery"

URL pattern is owned jointly by frontend + growth-seo; changes are CROSS-MODULE.
Keep this function pure and stable; an item name change in the wiki must keep
its slug stable across releases, so we slug from name once at first sight and
do not regenerate.
"""

from __future__ import annotations

import re

_PUNCT = re.compile(r"[^a-z0-9]+")


def slugify(name: str) -> str:
    s = name.lower().replace("&", "and").replace("'", "")
    s = _PUNCT.sub("-", s).strip("-")
    return s or "item"
