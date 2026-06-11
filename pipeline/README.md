# pipeline — Geoffery data layer

uv-managed Python. Owns the OSRS Wiki price ingestion, derived aggregates, news poller, and a SQLite time-series DB at `../data/geoffery.db`. **The collector starts before everything else** (charter constraint 5: history can't be backfilled).

## Modules

- `geoffery_pipeline.db` — SQLite open, WAL mode, schema migrations.
- `geoffery_pipeline.wiki_api` — typed client for the OSRS Wiki real-time prices API (`/mapping`, `/latest`, `/5m`, `/1h`). Sets a descriptive User-Agent per wiki etiquette.
- `geoffery_pipeline.collect` — entry point: refresh mapping if stale, fetch latest + 5m, upsert, log heartbeat.
- `geoffery_pipeline.aggregates` — recompute trailing 30-day percentiles, volume baselines, gauge bands per item. Writes `aggregates` table that frontend consumes at build time.
- `geoffery_pipeline.news_poller` — RSS feed of OSRS updates → keyword→category matcher → `news_events`. Drives the "unsettled" gauge state.
- `geoffery_pipeline.export` — dumps the small JSON files Astro reads at build time (`items.json`, `aggregates.json`, `news.json`).

## Setup

Everything goes through `scripts/run.sh` so the right env file is sourced:

```bash
cd pipeline && uv sync && cd ..
./scripts/run.sh local cron       # collect + aggregates + news + export, in order
./scripts/run.sh qa collect       # one-shot on qa env
./scripts/run.sh prod aggregates  # gauge recompute on prod env
```

The launcher resolves the `GEOFFERY_DB` path (relative paths are relative to repo root) and sets `GEOFFERY_DEPLOYMENT_NAME` so the collector tags the wiki User-Agent and the export `meta.json` honestly.

## Scheduling

`launchd/install.sh <local|qa|prod>` installs the three jobs into `~/Library/LaunchAgents` under env-namespaced labels (e.g. `com.geoffery.qa.collect`). qa and prod can coexist on one host with separate DB paths. On a Linux host swap launchd for systemd timers; the labels and `scripts/run.sh` invocations carry over. The single alert that pages the owner is collector heartbeat staleness — see `ops.md` agent.

## Schema contract

`aggregates(item_id, computed_at, percentile, band, verdict_text, flags_json)` is the gauge contract between data-engineer ↔ algorithms ↔ frontend. Adding columns is a CROSS-MODULE change (file a proposal).
