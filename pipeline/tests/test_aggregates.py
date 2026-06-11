"""Sanity tests for the gauge math. Not exhaustive — the values are descriptive,
which means a bad band is a visible bug, not a silent regression. Run:

    cd pipeline && uv run --extra dev pytest
"""

from __future__ import annotations

import time

from geoffery_pipeline import aggregates
from geoffery_pipeline.db import connect


def _seed(tmp_path, item_id: int, mids: list[int], current: int):
    import os

    os.environ["GEOFFERY_DB"] = str(tmp_path / "test.db")
    from importlib import reload

    from geoffery_pipeline import config, db as db_mod

    reload(config)
    reload(db_mod)
    conn = db_mod.connect()
    now = int(time.time())
    conn.execute(
        "INSERT INTO items (id, name, slug, members, updated_at) VALUES (?, ?, ?, 0, ?)",
        (item_id, f"Item {item_id}", f"item-{item_id}", now),
    )
    # spread points across the trailing 30 days
    span = 30 * 24 * 60 * 60
    for i, mid in enumerate(mids):
        ts = now - span + int(i * (span / max(len(mids), 1)))
        conn.execute(
            "INSERT INTO prices_5m (item_id, ts, avg_high, avg_low, high_vol, low_vol) "
            "VALUES (?, ?, ?, ?, 100, 100)",
            (item_id, ts, mid + 5, mid - 5),
        )
    conn.execute(
        "INSERT INTO prices_latest (item_id, high, high_ts, low, low_ts, fetched_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (item_id, current + 5, now, current - 5, now, now),
    )
    return conn


def test_unsettled_when_history_thin(tmp_path):
    conn = _seed(tmp_path, 1, mids=[100, 110, 105], current=108)
    row = aggregates.compute_for_item(conn, 1, int(time.time()), has_recent_news=False)
    assert row is not None
    assert row["band"] == "unsettled"
    assert "thin-history" in row["flags_json"]


def test_good_below_iqr(tmp_path):
    conn = _seed(tmp_path, 2, mids=list(range(100, 200)), current=110)
    row = aggregates.compute_for_item(conn, 2, int(time.time()), has_recent_news=False)
    assert row is not None
    assert row["band"] == "good"
    assert row["p25"] is not None and row["current_price"] <= row["p25"] + 1


def test_poor_above_iqr(tmp_path):
    conn = _seed(tmp_path, 3, mids=list(range(100, 200)), current=190)
    row = aggregates.compute_for_item(conn, 3, int(time.time()), has_recent_news=False)
    assert row is not None
    assert row["band"] == "poor"


def test_news_forces_unsettled(tmp_path):
    conn = _seed(tmp_path, 4, mids=list(range(100, 200)), current=110)
    row = aggregates.compute_for_item(conn, 4, int(time.time()), has_recent_news=True)
    assert row is not None
    assert row["band"] == "unsettled"
    assert "recent-news" in row["flags_json"]
