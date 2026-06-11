"""Pin the consultation scorer + calibration tabulation (D-011)."""

from __future__ import annotations

import os
import time
from pathlib import Path

import pytest


@pytest.fixture
def conn(tmp_path, monkeypatch):
    """Fresh on-disk DB. We monkeypatch GEOFFERY_DB so the connect()
    helper resolves to a per-test file."""
    db = tmp_path / "test.db"
    monkeypatch.setenv("GEOFFERY_DB", str(db))
    # Reload config + db so DB_PATH picks up the env.
    import importlib
    from geoffery_pipeline import config as cfg_mod
    from geoffery_pipeline import db as db_mod
    importlib.reload(cfg_mod)
    importlib.reload(db_mod)
    conn = db_mod.connect()
    yield conn
    conn.close()


def _seed_item(conn, item_id: int):
    conn.execute(
        "INSERT INTO items (id, name, slug, members, updated_at) VALUES (?, ?, ?, 0, ?)",
        (item_id, f"Item {item_id}", f"item-{item_id}", int(time.time())),
    )


def _seed_consultation(conn, *, id, item_id, side, tolerance, price, created_at, bucket="hours/buy/thick/steady"):
    conn.execute(
        """
        INSERT INTO consultations
          (id, client_id, item_id, side, tolerance, recommended_price,
           confidence_bucket, engine_version, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
        """,
        (id, "client-1", item_id, side, tolerance, price, bucket, created_at),
    )


def _seed_5m(conn, item_id, ts, avg_high=None, avg_low=None, high_vol=10, low_vol=10):
    conn.execute(
        "INSERT INTO prices_5m (item_id, ts, avg_high, avg_low, high_vol, low_vol) VALUES (?, ?, ?, ?, ?, ?)",
        (item_id, ts, avg_high, avg_low, high_vol, low_vol),
    )


def test_buy_filled_when_low_crosses_rec_price(conn):
    """A buy at 1000 fills if any avg_low ≤ 1000 trades within hours window."""
    from geoffery_pipeline import scorer

    _seed_item(conn, 1)
    created = 100_000
    _seed_consultation(conn, id="c1", item_id=1, side="buy",
                       tolerance="hours", price=1000, created_at=created)
    # hours window: 4h..8h after created.
    _seed_5m(conn, 1, ts=created + 5 * 3600,  # within window
             avg_high=1050, avg_low=995, low_vol=5)

    stats = scorer.score_pending(conn, now=created + 9 * 3600)
    assert stats["evaluated"] == 1
    assert stats["filled"] == 1


def test_buy_not_filled_when_no_crossing(conn):
    from geoffery_pipeline import scorer
    _seed_item(conn, 2)
    created = 200_000
    _seed_consultation(conn, id="c2", item_id=2, side="buy",
                       tolerance="hours", price=1000, created_at=created)
    # all 5m buckets above 1000
    _seed_5m(conn, 2, ts=created + 5 * 3600, avg_high=1100, avg_low=1050, low_vol=5)

    stats = scorer.score_pending(conn, now=created + 9 * 3600)
    assert stats["evaluated"] == 1
    assert stats["filled"] == 0


def test_sell_filled_when_high_crosses_rec_price(conn):
    from geoffery_pipeline import scorer
    _seed_item(conn, 3)
    created = 300_000
    _seed_consultation(conn, id="c3", item_id=3, side="sell",
                       tolerance="hours", price=1000, created_at=created,
                       bucket="hours/sell/thick/steady")
    _seed_5m(conn, 3, ts=created + 5 * 3600,
             avg_high=1050, avg_low=995, high_vol=5)
    stats = scorer.score_pending(conn, now=created + 9 * 3600)
    assert stats["evaluated"] == 1
    assert stats["filled"] == 1


def test_skips_consultation_whose_window_has_not_closed(conn):
    from geoffery_pipeline import scorer
    _seed_item(conn, 4)
    created = 400_000
    _seed_consultation(conn, id="c4", item_id=4, side="buy",
                       tolerance="patient", price=1000, created_at=created)
    # patient window ends 72h after created; we evaluate at +1h
    stats = scorer.score_pending(conn, now=created + 3600)
    assert stats["evaluated"] == 0
    assert stats["window_not_closed"] == 1


def test_no_volume_does_not_fill(conn):
    from geoffery_pipeline import scorer
    _seed_item(conn, 5)
    created = 500_000
    _seed_consultation(conn, id="c5", item_id=5, side="buy",
                       tolerance="hours", price=1000, created_at=created)
    _seed_5m(conn, 5, ts=created + 5 * 3600, avg_high=1050, avg_low=995, low_vol=0)
    stats = scorer.score_pending(conn, now=created + 9 * 3600)
    assert stats["evaluated"] == 1
    assert stats["filled"] == 0


def test_calibration_tabulates_per_bucket(conn):
    from geoffery_pipeline import scorer
    _seed_item(conn, 6)
    # 3 buys at the same bucket, 2 fill, 1 doesn't
    for i, (price, fill_low) in enumerate([(1000, 995), (1000, 995), (1000, 1100)]):
        created = 600_000 + i * 10_000
        _seed_consultation(conn, id=f"c6{i}", item_id=6, side="buy",
                           tolerance="hours", price=price, created_at=created,
                           bucket="hours/buy/thick/steady")
        _seed_5m(conn, 6, ts=created + 5 * 3600, avg_high=1100, avg_low=fill_low, low_vol=5)

    scorer.score_pending(conn, now=700_000 + 9 * 3600)
    row = conn.execute(
        "SELECT * FROM calibration WHERE cohort_key = 'hours/buy/thick/steady'"
    ).fetchone()
    assert row is not None
    assert row["n_total"] == 3
    assert row["n_filled"] == 2
    assert abs(row["fill_rate"] - 2/3) < 1e-6
