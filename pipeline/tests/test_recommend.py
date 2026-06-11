"""Pin the recommendation engine (D-011)."""

from __future__ import annotations

from geoffery_pipeline.recommend import recommend
from geoffery_pipeline.regime import RegimeResult


def _regime(power="balanced", stability="steady"):
    return RegimeResult(
        power=power, stability=stability,
        trend_pct=0.0, high_share=0.5, volatility_z=0.0,
    )


def test_instant_buy_uses_insta_buy_rounded_up():
    r = recommend(
        side="buy", tolerance="instant",
        regime=_regime(), liquidity="thick",
        current_insta_buy=1_594_231, current_insta_sell=1_580_000,
        recent_mids_sorted=[],
    )
    assert r is not None
    assert r.price == 1_595_000  # round_up to 4 sig figs
    assert r.confidence_bucket == "instant/buy/thick/steady"


def test_instant_sell_uses_insta_sell_rounded_down():
    r = recommend(
        side="sell", tolerance="instant",
        regime=_regime(), liquidity="thick",
        current_insta_buy=1_600_000, current_insta_sell=1_594_231,
        recent_mids_sorted=[],
    )
    assert r is not None
    assert r.price == 1_594_000


def test_hours_buy_uses_p20_then_rounds_up():
    # 100 mids from 1000..1099 → p20 ≈ 1019.8 → buy round-up to 4sf = 1020
    mids = sorted(range(1000, 1100))
    r = recommend(
        side="buy", tolerance="hours",
        regime=_regime(), liquidity="medium",
        current_insta_buy=None, current_insta_sell=None,
        recent_mids_sorted=[float(m) for m in mids],
    )
    assert r is not None
    assert 1000 <= r.price <= 1030
    assert r.confidence_bucket == "hours/buy/medium/steady"


def test_patient_buy_lower_than_hours_buy():
    mids = sorted(float(m) for m in range(1_000_000, 2_000_000, 1000))
    rh = recommend(
        side="buy", tolerance="hours",
        regime=_regime(), liquidity="thick",
        current_insta_buy=None, current_insta_sell=None,
        recent_mids_sorted=mids,
    )
    rp = recommend(
        side="buy", tolerance="patient",
        regime=_regime(), liquidity="thick",
        current_insta_buy=None, current_insta_sell=None,
        recent_mids_sorted=mids,
    )
    assert rh and rp
    assert rp.price <= rh.price, "patient buy should target a cheaper price than hours buy"


def test_sellers_market_nudges_buys_higher():
    mids = sorted(float(m) for m in range(1_000_000, 2_000_000, 1000))
    balanced = recommend(
        side="buy", tolerance="hours",
        regime=_regime("balanced", "steady"), liquidity="thick",
        current_insta_buy=None, current_insta_sell=None,
        recent_mids_sorted=mids,
    )
    sellers = recommend(
        side="buy", tolerance="hours",
        regime=_regime("seller", "steady"), liquidity="thick",
        current_insta_buy=None, current_insta_sell=None,
        recent_mids_sorted=mids,
    )
    assert balanced and sellers
    # Sellers' market: buyers must pay more for the same fill probability.
    assert sellers.price >= balanced.price


def test_volatile_stability_widens_buy_upward():
    mids = sorted(float(m) for m in range(1_000_000, 2_000_000, 1000))
    steady = recommend(
        side="buy", tolerance="hours",
        regime=_regime("balanced", "steady"), liquidity="thick",
        current_insta_buy=None, current_insta_sell=None,
        recent_mids_sorted=mids,
    )
    volatile = recommend(
        side="buy", tolerance="hours",
        regime=_regime("balanced", "volatile"), liquidity="thick",
        current_insta_buy=None, current_insta_sell=None,
        recent_mids_sorted=mids,
    )
    assert steady and volatile
    assert volatile.price >= steady.price


def test_no_data_no_rec():
    r = recommend(
        side="buy", tolerance="instant",
        regime=_regime(), liquidity="thin",
        current_insta_buy=None, current_insta_sell=None,
        recent_mids_sorted=[],
    )
    assert r is None


def test_all_outputs_round_to_4_sig_figs():
    mids = [1_594_231.7] * 10
    for side in ("buy", "sell"):
        for tol in ("instant", "hours", "patient"):
            r = recommend(
                side=side, tolerance=tol,
                regime=_regime(), liquidity="thick",
                current_insta_buy=1_594_231 if tol == "instant" else None,
                current_insta_sell=1_594_231 if tol == "instant" else None,
                recent_mids_sorted=mids,
            )
            assert r is not None
            s = str(r.price).rstrip("0")
            assert len(s) <= 4, f"{side}/{tol}: price {r.price} has >4 sig figs"
