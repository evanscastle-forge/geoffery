"""Pin the 4-sig-fig rounding rule (D-011)."""

from __future__ import annotations

from geoffery_pipeline.rounding import round_for_side, round_sig


def test_4_sig_figs_nearest():
    # 1,594,231 → 1,594,000 at 4 sig figs (nearest)
    assert round_sig(1_594_231, 4, "nearest") == 1_594_000
    # 23,847 → 23,850 at 4 sig figs (nearest)
    assert round_sig(23_847, 4, "nearest") == 23_850


def test_buy_rounds_up():
    # buy direction → ceiling at step
    assert round_for_side(1_594_231, "buy") == 1_595_000
    assert round_for_side(23_847, "buy") == 23_850
    assert round_for_side(187, "buy") == 187  # already <4 sig figs, no change


def test_sell_rounds_down():
    # sell direction → floor at step
    assert round_for_side(1_594_231, "sell") == 1_594_000
    assert round_for_side(23_847, "sell") == 23_840
    assert round_for_side(187, "sell") == 187


def test_already_at_or_below_step_is_noop():
    # Values with fewer significant figures than the limit don't change
    assert round_sig(187, 4, "nearest") == 187
    assert round_sig(187, 4, "up") == 187
    assert round_sig(187, 4, "down") == 187
    assert round_sig(9, 4, "up") == 9
    assert round_sig(9999, 4, "up") == 9999
    assert round_sig(10_000, 4, "up") == 10_000


def test_exact_step_is_noop():
    # A value already exactly on the 4-sig-fig step doesn't move
    assert round_sig(1_500_000, 4, "up") == 1_500_000
    assert round_sig(1_500_000, 4, "down") == 1_500_000


def test_small_values_passthrough_cleanly():
    assert round_sig(0, 4, "up") == 0
    assert round_sig(1, 4, "up") == 1
    assert round_sig(10, 4, "down") == 10


def test_buy_up_sell_down_never_cross():
    # For any value, the buy-rounded price is never less than the sell-rounded.
    for v in (1, 187, 1234, 23_847, 1_594_231, 9_847_612, 999_999_999):
        b = round_for_side(v, "buy")
        s = round_for_side(v, "sell")
        assert b >= s, f"buy must >= sell at {v}: buy={b} sell={s}"


def test_examples_from_spec():
    # 1,594,231 → 1,594,000 (sell/nearest), 1,595,000 (buy)
    assert round_for_side(1_594_231, "sell") == 1_594_000
    assert round_for_side(1_594_231, "buy") == 1_595_000
    # 23,847 → 23,850 (nearest), 23,840 (sell), 23,850 (buy)
    assert round_sig(23_847, 4, "nearest") == 23_850
    assert round_for_side(23_847, "sell") == 23_840
    assert round_for_side(23_847, "buy") == 23_850


def test_returns_int():
    # Even when input is a float (intermediate algebra), output is always int gp
    assert isinstance(round_sig(1_594_231.7, 4, "up"), int)
    assert isinstance(round_for_side(23_847.123, "sell"), int)
