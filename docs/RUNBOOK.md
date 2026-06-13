# RUNBOOK — Geoffery

Operational procedures for the localhost build, with the Cloudflare production
counterparts noted. The localhost runtime is Node-portable (DECISIONS D-LOCAL-001).

## Bring the whole product up (localhost)

```bash
nvm use && npm ci
cp .env.example .env            # edit values; never paste secrets in chat
npm run migrate:legacy          # Phase 0 — export all history (irreversible; once)
npm run migrate:verify          # GATE 0 — row counts + spot-checks
npm run backfill                # load archive → local D1 (SQLite)
npm run backtest                # cold-start calibration + launch track record
npm run pipeline                # collect → aggregate → news → export (one pass)
npm run dev                     # scheduler + consult worker (:8787) + site (:4321)
```

Open `http://127.0.0.1:4321`. The collector ticks every 5 min; aggregate+export hourly.

## Routine jobs (and cadence)
| Job | Command | Cadence | Owner area |
| --- | --- | --- | --- |
| collect | `npm run collect` | 5 min | db |
| aggregate | `npm run aggregate` | hourly | core |
| export | `npm run export` | hourly (after aggregate) | db |
| scorer | `npm run scorer` | 30 min | core |
| news | `npm run news` | daily (hourly on update days) | db |

## Alerts
- **Collector death is the page-the-owner alert** (spec §11). `staleJobs(store, maxAge)`
  returns jobs whose last OK is older than the threshold; wire it to an alert in prod.
  Locally, check `pipeline_health`:
  ```bash
  node --experimental-strip-types -e "import('@geoffery/data').then(async d=>{const s=d.openStore(process.env.GEOFFERY_DB||'./.data/geoffery.db');console.log(d.staleJobs(s, 1200));})"
  ```
- News/LLM failures are **non-fatal** — updates stay unclassified and retry; no user path waits.

## Rollback
- **Localhost:** revert the git commit; re-run `npm run pipeline`. The R2 archive is the
  source of truth — `npm run backfill` re-derives the D1 store from it.
- **Production (Cloudflare):** cutover is DNS to the new deployment; rollback = DNS revert,
  kept viable 30 days (spec §11 Phase 7). Workers/Pages roll back to the previous version.

## R2 restore drill (spec §7/§11)
```bash
npm run restore:drill           # sha256-verify every day object, re-read via the
                                # ArchiveStore into a fresh store, reconcile row count
```
The archive (`.data/archive/`, R2 in prod) is the irreplaceable asset — backed up and
restore-tested. The D1/SQLite store is always re-derivable from it via `backfill`.

## Data flow (two-layer storage, spec §2)
```
OSRS Wiki API ──collector──▶ R2 archive (daily NDJSON, source of truth)
                       └────▶ D1 hot window (prices_5m, prices_latest)
R2/D1 ──aggregator──▶ aggregates (gauge/regime/recs)
D1 ──export──▶ site/src/generated/*.json ──Astro──▶ static site
consult worker ──▶ consultations ──scorer──▶ outcomes ──▶ calibration
news worker ──▶ wiki_updates + associations (display-only; firewalled from offers)
```

## Production deploy (Cloudflare — not exercised on localhost)
Out of localhost scope (DECISIONS D-LOCAL-004): Pages (site), Workers (consult/cron),
D1, R2, KV. The worker handlers are already portable (a `worker.ts` wraps each handler
with bindings); `ops/wrangler/` holds the configs. Steps: provision R2+D1+KV, push the
archive to R2, run migrations on D1, deploy Workers + Pages, configure Cron Triggers,
verify, then DNS cutover.
```

