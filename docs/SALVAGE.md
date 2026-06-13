# SALVAGE — provenance log for anything carried from the reference repo

Reference (read-only): `~/code/geoffery-dev/geoffery_old`. Per spec, every constant,
workaround, or insight carried over is recorded here with provenance: what it is, where it
came from, why it is trusted. Code is written fresh against the spec; only knowledge is carried.

## Data export (Phase 0)
- **Source storage format:** SQLite `data/geoffery.db`, table `prices_5m(item_id, ts,
  avg_high, avg_low, high_vol, low_vol)`, ~12.35M rows, 31 UTC days (2026-05-12 .. 2026-06-11).
  Provenance: `pipeline/src/geoffery_pipeline/db.py`. Trusted: it is the live schema the
  reference collector wrote to. Read-only export, never modified.
- **Item dimension:** `items(id, name, slug, examine, members, ge_limit, value, highalch,
  lowalch, icon, updated_at)`. Slugs are immutable URL one-way doors — carried verbatim.

## Algorithm constants (Phase 2) — carried, re-implemented fresh in TS
Provenance file = `pipeline/src/geoffery_pipeline/<file>.py` in the reference.

- **Rounding** (`rounding.py`): 4 significant figures; buy rounds UP, sell rounds DOWN;
  `step = 10**max(0, floor(log10(|v|)) - sigs + 1)`; values < 10^(sigs-1) pass through.
- **Gauge** (`aggregates.py`): volume-weighted p25/p50/p75 over trailing 30 days; mid =
  (avg_high+avg_low)/2; bands good (≤p25) / average / poor (>p75). Unsettled when
  `MIN_SAMPLES=30` not met, OR 24h volume > `VOLUME_SPIKE_MULTIPLE=3.0` × baseline, OR a
  relevant update within `NEWS_LOOKBACK_DAYS=3`, OR missing current price.
- **Regime** (`regime.py`): power axis `TREND_PCT_THRESHOLD=0.015`,
  `SPREAD_SHARE_THRESHOLD=0.55`; stability axis `VOLATILITY_Z_THRESHOLD=2.0` with
  `NEWS_TIEBREAKER_MARGIN=0.4`; `SHORT_WINDOW_DAYS=3`, `BASELINE_WINDOW_DAYS=30`, rolling
  window = 12 buckets (1h). Liquidity thick ≥100k, medium ≥1k, thin <1k (volume baseline).
  Population stdev (not sample).
- **Offer engine** (`recommend.py`): base percentiles buy/hours 0.20, buy/patient 0.10,
  sell/hours 0.80, sell/patient 0.90; instant = current insta price for the side; regime
  shifts ±0.05 (power) ±0.03 (volatile); thin-liquidity widen ±0.02; clamp [0.02, 0.98].
- **Scorer** (`scorer.py`): windows instant (0, 30m), hours (4h, 8h), patient (48h, 72h);
  buy fills if any 5m bucket has `avg_low ≤ price AND low_vol > 0`; sell fills if
  `avg_high ≥ price AND high_vol > 0`; evaluates the rounded price as shown.
- **Cohort key** shape: `tolerance/side/liquidity/stability`.

## Character / copy (Phase 4)
- Geoffery's voice and the ~78 dialogue lines + ledger tier copy are carried as *reference
  for tone*; new strings are authored fresh in `packages/content` (sole source of his words).
  Provenance: `web/src/content/geoffery-lines.json`, `web/src/content/ledger.json`.
