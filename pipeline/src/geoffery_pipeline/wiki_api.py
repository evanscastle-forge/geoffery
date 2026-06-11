"""Typed client for the OSRS Wiki real-time prices API.

Endpoints:
    GET /mapping   — list of all tradeable items (relatively static)
    GET /latest    — most-recent high (insta-buy) and low (insta-sell) per item
    GET /5m        — 5-minute bucketed averages (paged by timestamp)
    GET /1h        — 1-hour bucketed averages

Etiquette: descriptive User-Agent, modest polling rates, attribution in product
footer. Compliance has signed off on the wiki API as a community-blessed source
(charter constraint 3).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from .config import USER_AGENT, WIKI_API_BASE


@dataclass(frozen=True)
class MappingItem:
    id: int
    name: str
    examine: str
    members: bool
    limit: int | None
    value: int | None
    highalch: int | None
    lowalch: int | None
    icon: str | None


@dataclass(frozen=True)
class LatestEntry:
    high: int | None
    high_time: int | None
    low: int | None
    low_time: int | None


@dataclass(frozen=True)
class FiveMinEntry:
    avg_high_price: int | None
    high_price_volume: int
    avg_low_price: int | None
    low_price_volume: int


def _client() -> httpx.Client:
    return httpx.Client(
        base_url=WIKI_API_BASE,
        headers={"User-Agent": USER_AGENT},
        timeout=httpx.Timeout(20.0, read=20.0),
    )


def fetch_mapping() -> list[MappingItem]:
    with _client() as c:
        r = c.get("/mapping")
        r.raise_for_status()
        return [
            MappingItem(
                id=int(d["id"]),
                name=d["name"],
                examine=d.get("examine", ""),
                members=bool(d.get("members", False)),
                limit=d.get("limit"),
                value=d.get("value"),
                highalch=d.get("highalch"),
                lowalch=d.get("lowalch"),
                icon=d.get("icon"),
            )
            for d in r.json()
        ]


def _entry_dict(raw: dict[str, Any]) -> dict[int, dict[str, Any]]:
    return {int(k): v for k, v in raw.get("data", {}).items()}


def fetch_latest() -> dict[int, LatestEntry]:
    with _client() as c:
        r = c.get("/latest")
        r.raise_for_status()
        return {
            iid: LatestEntry(
                high=d.get("high"),
                high_time=d.get("highTime"),
                low=d.get("low"),
                low_time=d.get("lowTime"),
            )
            for iid, d in _entry_dict(r.json()).items()
        }


def fetch_5m(timestamp: int | None = None) -> tuple[int, dict[int, FiveMinEntry]]:
    """Return (bucket_ts, {item_id: 5m entry}) for one 5-minute bucket.

    If `timestamp` omitted, returns the most recent bucket.
    """
    params = {"timestamp": timestamp} if timestamp is not None else None
    with _client() as c:
        r = c.get("/5m", params=params)
        r.raise_for_status()
        raw = r.json()
        bucket_ts = int(raw["timestamp"])
        entries = {
            iid: FiveMinEntry(
                avg_high_price=d.get("avgHighPrice"),
                high_price_volume=int(d.get("highPriceVolume") or 0),
                avg_low_price=d.get("avgLowPrice"),
                low_price_volume=int(d.get("lowPriceVolume") or 0),
            )
            for iid, d in _entry_dict(raw).items()
        }
        return bucket_ts, entries
