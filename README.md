# Geoffery

A price oracle and decision assistant for Old School RuneScape's Grand Exchange —
~4,600 item pages with a deal gauge, market-regime label, sparklines, and **the Butler's
Bell**: an elderly ledger-keeper who turns your intent (buy/sell + time tolerance) into a
recommended price, logs it as a falsifiable prediction, and is scored against the market.

Built as an all-TypeScript monorepo: a pure domain core with zero I/O; a two-layer store
(an append-only R2 archive + a queryable D1 store); a static Astro site. Production targets
Cloudflare; this build runs entirely on **localhost** (see `SYSTEM_ARCHITECTURE.md` for the
runtime model and its documented deviations).

## Run it on localhost

```bash
nvm use && npm ci
cp .env.example .env                     # edit; never paste secrets in chat

npm run migrate:legacy                   # Phase 0 — export all price history (once)
npm run migrate:verify                   # GATE 0 — reconcile + spot-check
npm run backfill                         # archive → local D1 (SQLite)
npm run backtest                         # cold-start calibration + track record
npm run pipeline                         # collect → aggregate → news → export
npm run dev                              # scheduler + consult (:8787) + site (:4321)
```

Open <http://127.0.0.1:4321>. Optional: add `ANTHROPIC_API_KEY` to `.env` to enable the
Haiku news classifier (without it, updates are stored but unannotated — the site is
unaffected).

## Layout
| Path | What |
| --- | --- |
| `packages/core` | Pure domain: rounding, gauge, regime, offers, scoring, ledger (zero I/O) |
| `packages/data` | Storage adapters: R2 archive codec, D1 SqlStore, wiki/MediaWiki clients |
| `packages/content` | All of Geoffery's words + design tokens (the sole source of his voice) |
| `workers/*` | collector · aggregator · scorer · news (cron) · consult (HTTP) |
| `site` | Astro static site + PWA |
| `tools/*` | `migrate-legacy` (Phase 0) · `backtest` |
| `ops` | scheduler, `dev-up`, wrangler configs (owned by the `db` agent) |
| `docs` | project documentation — changelog, runbook, ad policy, salvage, wiki-style (see `docs/README.md`) |
| `config` | relocatable build config not bound to root discovery (`tsconfig.base.json`) |

## Checks
```bash
npm run check         # typecheck + eslint + core-purity + repo-layout + 52 unit/property tests
npm run restore:drill # R2 restore drill (sha256 integrity + row reconciliation)
```

See `docs/README.md` (full doc index), `SYSTEM_ARCHITECTURE.md` (as-built module map +
routing), `docs/RUNBOOK.md` (ops), `docs/SALVAGE.md` (carried constants), and
`tools/parity-checklist.md` (feature parity vs the reference).

Not affiliated with or endorsed by Jagex.
