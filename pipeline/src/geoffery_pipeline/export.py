"""Export JSON snapshots that Astro reads at build time.

The frontend never opens the SQLite db directly; it reads these JSON files,
which are written atomically by this script. That gives Astro a stable input
format and lets the build run with no Python in scope.

Output files (in the target directory):
    items.json        — search index: id, slug, name, members, icon
    aggregates.json   — keyed by slug: band, verdict, percentile, prices, flags
    sparklines.json   — keyed by slug: { "1d": [...], "1w": [...], "1m": [...] }
    news.json         — last 14 days of news events
    health.json       — heartbeat snapshot for the public methodology / ops page
    meta.json         — overall freshness timestamp

Run after collect + aggregates. The site rebuild reads these.
"""

from __future__ import annotations

import json
import logging
import sys
import time
from pathlib import Path

from .db import connect

LOG = logging.getLogger("geoffery.export")

ONE_DAY = 24 * 60 * 60
SPARKLINE_WINDOWS = {"1d": ONE_DAY, "1w": 7 * ONE_DAY, "1m": 30 * ONE_DAY}
SPARKLINE_POINTS = 48  # downsample each window to ~48 points


def _atomic_write(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, separators=(",", ":")))
    tmp.replace(path)


def _downsample(points: list[tuple[int, float]], target: int) -> list[tuple[int, float]]:
    if len(points) <= target:
        return points
    step = len(points) / target
    out: list[tuple[int, float]] = []
    for i in range(target):
        out.append(points[int(i * step)])
    out.append(points[-1])
    return out


def export_items(conn, out_dir: Path) -> int:
    rows = conn.execute(
        "SELECT id, slug, name, members, icon FROM items ORDER BY name"
    ).fetchall()
    items = [
        {"id": r["id"], "slug": r["slug"], "name": r["name"],
         "members": bool(r["members"]), "icon": r["icon"]}
        for r in rows
    ]
    _atomic_write(out_dir / "items.json", items)
    return len(items)


def _build_news_citations_by_item(conn, lookback_days: int = 3) -> dict[int, list[dict]]:
    """Per-item list of recent news articles that named it.

    Matches the per-item rule in `aggregates.recompute_all`: lookback window
    is the same NEWS_LOOKBACK_DAYS so citations and the unsettled-by-news
    band stay in lockstep.
    """
    cutoff = int(time.time()) - lookback_days * ONE_DAY
    rows = conn.execute(
        """
        SELECT published_at, title, url, affected_items_json
        FROM news_events
        WHERE published_at >= ?
        ORDER BY published_at DESC
        """,
        (cutoff,),
    ).fetchall()
    by_item: dict[int, list[dict]] = {}
    for r in rows:
        try:
            affected = json.loads(r["affected_items_json"] or "[]")
        except (TypeError, ValueError):
            continue
        citation = {
            "title": r["title"],
            "url": r["url"],
            "published_at": r["published_at"],
        }
        for iid in affected:
            by_item.setdefault(int(iid), []).append(citation)
    return by_item


def export_aggregates(conn, out_dir: Path) -> int:
    rows = conn.execute(
        """
        SELECT i.id AS item_id, i.slug, i.name, a.*
        FROM items i
        LEFT JOIN aggregates a ON a.item_id = i.id
        """
    ).fetchall()
    agg: dict[str, dict] = {}
    latest_rows = {
        r["item_id"]: r
        for r in conn.execute(
            "SELECT item_id, high, high_ts, low, low_ts, fetched_at FROM prices_latest"
        ).fetchall()
    }
    citations_by_item = _build_news_citations_by_item(conn)
    for r in rows:
        latest = latest_rows.get(r["item_id"])
        agg[r["slug"]] = {
            "slug": r["slug"],
            "name": r["name"],
            "band": r["band"] or "unsettled",
            "verdict_text": r["verdict_text"] or "Geoffery has not yet appraised this item.",
            "percentile": r["current_percentile"],
            "p25": r["p25"],
            "p50": r["p50"],
            "p75": r["p75"],
            "current_price": r["current_price"],
            "flags": json.loads(r["flags_json"] or "[]"),
            "sample_count": r["sample_count"] or 0,
            "volume_24h": r["volume_24h"] or 0,
            "volume_baseline": r["volume_baseline"] or 0,
            "computed_at": r["computed_at"],
            "high": latest["high"] if latest else None,
            "high_ts": latest["high_ts"] if latest else None,
            "low": latest["low"] if latest else None,
            "low_ts": latest["low_ts"] if latest else None,
            "news_citations": citations_by_item.get(r["item_id"], []),
            "regime": {
                "power": r["regime_power"],
                "stability": r["regime_stability"],
                "liquidity": r["liquidity_band"],
            },
            "recommendations": {
                "instant": {"buy": r["rec_instant_buy"], "sell": r["rec_instant_sell"]},
                "hours":   {"buy": r["rec_hours_buy"],   "sell": r["rec_hours_sell"]},
                "patient": {"buy": r["rec_patient_buy"], "sell": r["rec_patient_sell"]},
            },
            "engine_version": r["engine_version"] or 0,
        }
    _atomic_write(out_dir / "aggregates.json", agg)
    return len(agg)


def export_sparklines(conn, out_dir: Path) -> int:
    now = int(time.time())
    items = conn.execute("SELECT id, slug FROM items").fetchall()
    out: dict[str, dict[str, list[list[float]]]] = {}
    for item in items:
        windows: dict[str, list[list[float]]] = {}
        for label, span in SPARKLINE_WINDOWS.items():
            rows = conn.execute(
                """
                SELECT ts, avg_high, avg_low FROM prices_5m
                WHERE item_id = ? AND ts >= ? ORDER BY ts
                """,
                (item["id"], now - span),
            ).fetchall()
            points: list[tuple[int, float]] = []
            for r in rows:
                ah, al = r["avg_high"], r["avg_low"]
                if ah is None and al is None:
                    continue
                mid = (ah + al) / 2 if ah is not None and al is not None else (ah or al)
                points.append((r["ts"], float(mid)))
            if not points:
                continue
            windows[label] = [[ts, p] for ts, p in _downsample(points, SPARKLINE_POINTS)]
        if windows:
            out[item["slug"]] = windows
    _atomic_write(out_dir / "sparklines.json", out)
    return len(out)


def export_news(conn, out_dir: Path) -> int:
    cutoff = int(time.time()) - 14 * ONE_DAY
    rows = conn.execute(
        """
        SELECT published_at, title, url, categories_json
        FROM news_events
        WHERE published_at >= ?
        ORDER BY published_at DESC
        """,
        (cutoff,),
    ).fetchall()
    out = [
        {
            "published_at": r["published_at"],
            "title": r["title"],
            "url": r["url"],
            "categories": json.loads(r["categories_json"] or "[]"),
        }
        for r in rows
    ]
    _atomic_write(out_dir / "news.json", out)
    return len(out)


def export_methodology_stats(conn, out_dir: Path) -> dict:
    """Write methodology-stats.json — the published accuracy record (D-011).

    Aggregates the `calibration` table into:
      - overall fill rate
      - per-cohort fill rates and sample counts
      - per-tolerance roll-ups (instant/hours/patient)

    Frontend uses these on /methodology and on the Bell consultation dialog
    to render in-character confidence statements.
    """
    rows = conn.execute(
        "SELECT cohort_key, n_total, n_filled, fill_rate FROM calibration"
    ).fetchall()
    cohorts: dict[str, dict] = {}
    total_n = 0
    total_f = 0
    by_tolerance: dict[str, dict[str, int]] = {}
    for r in rows:
        key = r["cohort_key"]
        n_total = int(r["n_total"])
        n_filled = int(r["n_filled"])
        cohorts[key] = {
            "n_total": n_total,
            "n_filled": n_filled,
            "fill_rate": float(r["fill_rate"]),
        }
        total_n += n_total
        total_f += n_filled
        # cohort_key shape: tolerance/side/liquidity/stability
        tol = key.split("/")[0] if "/" in key else "unknown"
        bucket = by_tolerance.setdefault(tol, {"n_total": 0, "n_filled": 0})
        bucket["n_total"] += n_total
        bucket["n_filled"] += n_filled

    for tol, b in by_tolerance.items():
        if b["n_total"] > 0:
            b["fill_rate"] = b["n_filled"] / b["n_total"]
        else:
            b["fill_rate"] = 0.0

    stats = {
        "overall": {
            "n_total": total_n,
            "n_filled": total_f,
            "fill_rate": (total_f / total_n) if total_n else 0.0,
        },
        "by_tolerance": by_tolerance,
        "cohorts": cohorts,
        "engine_version": _engine_version_from_aggregates(conn),
        "exported_at": int(time.time()),
    }
    _atomic_write(out_dir / "methodology-stats.json", stats)
    # Also publish to /methodology-stats.json so the frontend's fetch() works.
    public_path = out_dir.parent.parent.parent / "public" / "methodology-stats.json"
    if public_path.parent.exists():
        _atomic_write(public_path, stats)
    return stats


def _engine_version_from_aggregates(conn) -> int:
    row = conn.execute(
        "SELECT MAX(engine_version) AS v FROM aggregates"
    ).fetchone()
    return int(row["v"] or 0)


def export_health(conn, out_dir: Path) -> None:
    rows = conn.execute("SELECT * FROM pipeline_health").fetchall()
    _atomic_write(
        out_dir / "health.json",
        {
            r["job_name"]: {
                "last_ok_at": r["last_ok_at"],
                "last_run_at": r["last_run_at"],
                "last_status": r["last_status"],
                "last_error": r["last_error"],
            }
            for r in rows
        },
    )


def export_meta(out_dir: Path) -> None:
    from .config import DEPLOYMENT_NAME

    _atomic_write(
        out_dir / "meta.json",
        {"exported_at": int(time.time()), "deployment": DEPLOYMENT_NAME},
    )


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    if len(sys.argv) < 2:
        print("usage: python -m geoffery_pipeline.export <out_dir>", file=sys.stderr)
        return 2
    out_dir = Path(sys.argv[1]).resolve()
    conn = connect()
    try:
        n_items = export_items(conn, out_dir)
        n_agg = export_aggregates(conn, out_dir)
        n_spark = export_sparklines(conn, out_dir)
        n_news = export_news(conn, out_dir)
        export_health(conn, out_dir)
        export_meta(out_dir)
        stats = export_methodology_stats(conn, out_dir)
        LOG.info(
            "methodology-stats: overall=%d/%d (%.1f%%) cohorts=%d",
            stats["overall"]["n_filled"],
            stats["overall"]["n_total"],
            stats["overall"]["fill_rate"] * 100,
            len(stats["cohorts"]),
        )
        LOG.info(
            "export ok → %s (items=%d agg=%d sparklines=%d news=%d)",
            out_dir, n_items, n_agg, n_spark, n_news,
        )
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
