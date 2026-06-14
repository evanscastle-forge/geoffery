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
| prune | (runs in `npm run pipeline`, after collect) | every pipeline pass | db |
| aggregate | `npm run aggregate` | hourly | core |
| export | `npm run export` | hourly (after aggregate) | db |
| scorer | `npm run scorer` | 30 min | core |
| news | `npm run news` | daily (hourly on update days) | db |

The **prune** step hard-trims `prices_5m` and the gzipped archive to a rolling **30 days** — the
store is a cache, the OSRS Wiki is the source of truth (2026-06-13). Nothing older is retained.

## Alerts
- **Collector death is the page-the-owner alert** (spec §11). `staleJobs(store, maxAge)`
  returns jobs whose last OK is older than the threshold; wire it to an alert in prod.
  Locally, check `pipeline_health`:
  ```bash
  node --experimental-strip-types -e "import('@geoffery/data').then(async d=>{const s=d.openStore(process.env.GEOFFERY_DB||'./.data/geoffery.db');console.log(await d.staleJobs(s, 1200));})"
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

## Deploy to Cloudflare — dev + prod (`ops/run.sh`)
`ops/run.sh` dispatches by target: `localhost` (this machine), `dev`
(`dev.geoffery.gg`, Cloudflare Access–gated to the owner), `prod` (`geoffery.gg`).
dev and prod are mechanically identical — only `env/.env.<target>` and the
wrangler `--env` label differ ("works in dev ⇒ works in prod").

    ops/run.sh dev  deploy          # build site + deploy 5 Workers + Pages
    ops/run.sh dev  deploy-workers  # cron/HTTP Workers only
    ops/run.sh dev  deploy-site     # Astro build + wrangler pages deploy
    ops/run.sh dev  tail [worker]   # live logs
    ops/run.sh dev  secret NAME [w] # wrangler secret put (value never printed)
    ops/run.sh prod deploy          # same, against geoffery.gg

First-time provisioning (account/zone, D1/R2 creation, the `.toml` resource ids,
the Pages projects, and the dev Access policy) is the checklist in
`ops/wrangler/ACCESS.md`. Configs live in
`ops/wrangler/{collector,aggregator,scorer,news,consult}.toml` with
`[env.dev]`/`[env.prod]` sections + cron triggers; binding wrappers are
`workers/*/src/worker.ts`. Deploy auth is `wrangler login` once, or a scoped
`CLOUDFLARE_API_TOKEN` in `env/.env.<target>` (never pasted into chat).

### Cloudflare execution (async seam) — DONE
The storage seam (`SqlStore`, `ArchiveStore`) is **async** (Promise-returning), so
Cloudflare's async-only **D1 and R2** satisfy it natively via `D1Store`/`R2Archive`
in `workers/_shared/cloudflare.ts`; the `worker.ts` entries construct them from the
bindings and `await` the portable handler directly. The local `SqliteStore` keeps a
synchronous CORE (`*Sync` + `prepare`/`iterate`/`transactionSync`) for the
millions-of-row backfill/restore tools, and wraps it in the async interface the
handlers ride. Two D1-shaped redesigns came with it (SYSTEM_ARCHITECTURE §3.1/§3.2):
- **`transaction(fn)` → `batch(statements[])`.** D1 has no imperative callback
  transaction and cannot read mid-batch. The collector fetches the item-id set once
  and filters (instead of per-row FK existence checks); the aggregator/scorer gather
  results by awaiting reads first, then commit them as bounded atomic batches
  (`writeAggregateStatement`/`insertOutcomeStatement`).
- **Aggregator scan → keyset pagination.** A single unbounded `ORDER BY (item_id,ts)`
  scan won't fit a D1 query result; it now reads forward in bounded pages keyed on
  the `(item_id, ts)` primary key (`workers/aggregator/src/handler.test.ts` proves
  grouping survives the page boundary). The R2 archive reuses the gzipped-NDJSON day
  codec from `packages/data/src/archive.ts` (`nodejs_compat`).

### Publishing aggregates
The static site reads build-time JSON; cron workers write D1/R2 but the site only
picks it up on the next `deploy-site`. A scheduled Pages rebuild (a deploy hook on
a cron) is the open item — see `ops/wrangler/ACCESS.md`.

### Schema on D1
`packages/data/src/schema.ts` exports `SCHEMA` — the same DDL node:sqlite applies.
For D1 apply it once with `wrangler d1 execute <db> --remote` (from a generated
`.sql` mirror or `--command`); the schema is byte-trivial to port (spec §2.2).

### Rollback
- **Localhost:** revert the commit; `npm run backfill` re-derives D1 from the R2 archive.
- **Cloudflare:** roll Workers/Pages back to the previous version, or redeploy a
  prior SHA. Launch cutover/rollback is DNS, kept viable 30 days (spec §11 Phase 7).

