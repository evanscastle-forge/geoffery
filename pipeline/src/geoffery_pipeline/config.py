"""Runtime config. Read once at module load; everything else stays pure.

`GEOFFERY_DEPLOYMENT_NAME` is the one switch — `local` / `qa` / `prod` —
that names which deployment this process is. The launcher (`scripts/run.sh`)
sets it; downstream code uses `is_prod()` for any posture flip (live tip
jar, indexable robots, etc.). qa and prod are mechanically identical
otherwise — the "works in qa ⇒ works in prod" fidelity guarantee.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = REPO_ROOT / "data"

DeploymentName = Literal["local", "qa", "prod"]
DEPLOYMENT_NAME: DeploymentName = os.environ.get("GEOFFERY_DEPLOYMENT_NAME", "local")  # type: ignore[assignment]
if DEPLOYMENT_NAME not in ("local", "qa", "prod"):
    raise RuntimeError(
        f"GEOFFERY_DEPLOYMENT_NAME={DEPLOYMENT_NAME!r}; expected one of local/qa/prod"
    )

DB_PATH = Path(os.environ.get("GEOFFERY_DB", DATA_DIR / "geoffery.db"))

# Wiki etiquette: identify ourselves so they can throttle/contact us, and
# distinguish dev/qa/prod traffic in their logs.
# https://oldschool.runescape.wiki/w/RuneScape:Real-time_Prices
USER_AGENT = os.environ.get(
    "GEOFFERY_USER_AGENT",
    f"Geoffery {DEPLOYMENT_NAME} (evanscastle.forge@gmail.com)",
)

WIKI_API_BASE = "https://prices.runescape.wiki/api/v1/osrs"
OSRS_NEWS_RSS = "https://secure.runescape.com/m=news/latest_news.rss?oldschool=1"


def is_prod() -> bool:
    return DEPLOYMENT_NAME == "prod"


def is_local() -> bool:
    return DEPLOYMENT_NAME == "local"
