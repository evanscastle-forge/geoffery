# Recommendation methodology — how Geoffery prices an offer

*Owner-facing rationale for the offer model in `packages/core/src/offers.ts`. Written for a
skeptic: every step is a closed form you can check by hand.*

## Philosophy (read this first)
This is **financial advice, not authoritative modelling**. The goal is to help someone get a fair
purchase and **move on with their day** — not to flip items or extract every last coin. So the
model is deliberately simple, deterministic, and honest about its limits. "Reasonable and
explainable" beats "optimal and opaque." When the market is already a fair price, we say so and
stop talking.

## What the user asks, quantitatively
Each wait class is a concrete fill-probability target — "**≥ 90% chance the order fills within
W**":

| Wait class | Window W | 5-min buckets *n* |
| --- | --- | --- |
| Right now | 30 seconds | ~0.1 |
| A few hours | 2 hours | 24 |
| A day or two | 2 days | 576 |
| A really long time | 1 month | 8,640 |

## The model: a first-passage (barrier) fill model
We model the log mid-price as a **driftless random walk** with a robust per-bucket volatility
**σ̂**. A *buy* placed a relative discount **δ** below the current mid fills the moment the market
trades down to it — i.e. when the running **minimum** of the walk dips by δ. By the **reflection
principle** for a random walk, over *n* buckets:

> P(fill within n) ≈ 2·Φ(−δ / (σ̂·√n))

Inverting for the 90% target gives the discount we recommend:

> **δ(n) = Z_FILL · σ̂ · √n**, with **Z_FILL = −Φ⁻¹(0.90/2) ≈ 0.1257**

Sells are symmetric (a premium δ above mid). Two consequences fall out *for free*:
- **Monotonicity**: √n grows with the window, so a more patient buyer is quoted a strictly lower
  price (and a patient seller a higher one). Longer wait ⇒ better price, always.
- **Instant ≈ market**: at n → 0 the discount vanishes, so "right now" is essentially the spread.
  In fact we **pin** the instant offers to the live insta-buy / insta-sell — crossing the spread
  is the only way to actually fill in 30 seconds.

### Why a 90% target gives a *small* discount
The running minimum of a walk over n buckets typically reaches about −0.8·σ̂·√n. A 90%-fill barrier
sits much shallower (−0.13·σ̂·√n), because a shallow dip is *very likely* to occur. To get a great
price you accept a low fill probability; to fill with high probability you ask for only a modest
discount. The user wants the latter — fill, don't gamble.

## News sentiment: a drift term that scales with the horizon
When the news layer associates a recent wiki update with the item, it carries a **sentiment**
(positive / neutral / negative) and a **strength** (the classifier's confidence). We add a small
**drift** μ̂ to the walk, measured in the item's *own* volatility units:

> μ̂ = κ · dir · strength · σ̂   (per bucket),  net buy discount **δ(n) = Z_FILL·σ̂·√n − μ̂·n**

This is the crux of the design: **diffusion scales as √n, drift scales as n.** So the sentiment
term is negligible at the 30-second horizon and dominant at the 1-month horizon — exactly the
requested behaviour ("instant barely moves; the long offer can move a lot"), achieved by the
mathematics rather than by hand-tuning each window. Positive news shrinks a buy's discount (pay
closer to market, because the dip you were waiting for is now less likely); negative news widens
it. The signal **decays linearly to zero over ~2 weeks** (`SENTIMENT_DECAY_DAYS`).

**Safety rails** (this is advice, not a hedge fund): the cumulative sentiment move is capped at a
**±5% absolute ceiling** (`SENTIMENT_CAP`), so one mis-classified update can't wreck a thin-market
item, and sentiment is **never the only signal** — it perturbs a volatility-grounded offer.

## Two more guards
- **Empirical clamp**: a recommended buy is never below the lowest mid observed in the 30-day
  window (and a sell never above the highest). Random walks don't extrapolate through mean
  reversion; clamping to observed reality is a cheap, honest shrinkage.
- **Strong monotonicity, enforced**: after rounding, the four buy offers are projected to be
  non-increasing (running min) and the four sells non-decreasing (running max). The barrier model
  is already monotone, but sentiment and clamping can perturb it — this projection guarantees the
  ordering for *every* input. (Tested as a property over random inputs.)

## The fair-price short-circuit
If an offer lands **within ~1.5% of market** (`FAIR_MARGIN`), we don't invent a discount — Geoffery
says *"market price is a fair offer — buy at X and move on."* This keeps the advice from
over-managing: on a calm item near its median, every wait class is simply "go ahead."

## Tuned constants
`Z_FILL ≈ 0.1257` (the 90% barrier), `κ = 0.00135` (chosen so a strong, fresh signal reaches the
±5% cap at the 1-month horizon for a typically-volatile item, and stays well under it for calm
ones), `SENTIMENT_CAP = 0.05`, `SENTIMENT_DECAY_DAYS = 14`, `FAIR_MARGIN = 0.015`. σ̂ is the
scaled median-absolute-deviation of recent 5-minute log returns (robust to single bad prints).

## Why this method, and not the others
- **Plain percentile of recent mids** (the previous engine) — has *no time semantics*: the 20th
  percentile of the last month isn't "90% to fill in 2 hours". The barrier model ties price to a
  concrete window and probability.
- **ARIMA / GARCH / state-space forecasting** — heavier, needs fitting per item per run, and
  produces a point forecast, not a fill probability. Overkill for "advice," and not a single
  deterministic call.
- **Monte-Carlo first-passage simulation** — would give the same answer the reflection principle
  gives in closed form, but slower and non-deterministic. We use the closed form.

The barrier approach is standard where "will this price level be reached in time?" is the question:
**first-passage times of Brownian motion** and **barrier-option pricing** (Glasserman, *Monte Carlo
Methods in Financial Engineering*); **limit-order fill-probability** models in market
microstructure (Cont, Stoikov & Talreja; Avellaneda & Stoikov, *High-frequency trading in a limit
order book*); and the **signal-grows-as-t, noise-grows-as-√t** horizon scaling that underlies
Sharpe-ratio-∝-√T results. Robust volatility (MAD/EWMA) and shrinkage-to-observed-bounds are
standard defensive estimation.

## Assumptions and where they break (we'd rather say it)
- The driftless random-walk baseline is a *short-horizon* approximation. Over a month, mean
  reversion dominates and √n over-states the spread — which is exactly why the **empirical clamp**
  exists. The 1-month offer should be read as "a patient target," not a forecast.
- Fill probabilities are *targets*, validated offline (the scorer + backtest report realized fill
  rates near 90% at the evaluable horizons). On a **30-day price cache** the 1-month window is only
  ever partially evaluable — we don't pretend otherwise.
- Sentiment depends on an LLM reading of patch notes. It is bounded, decayed, capped, and never the
  sole input precisely because it can be wrong.
