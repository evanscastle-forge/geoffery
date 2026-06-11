# Geoffery

> OSRS Grand Exchange price oracle. *"I am Geoffery, humble attendant to your GE offers."*

KBB/Zillow for OSRS prices: ~4,600 item pages with current bid/ask, sparklines, and a percentile-based deal gauge (good / average / poor / unsettled), fronted by Geoffery, an original butler-like ledger-keeper.

Spec lives in `docs/design-spec.md`. Hard constraints in `CHARTER.md`. Per-decision rationale in `DECISIONS.md`. What-changed-and-why in `CHANGELOG.md` (one entry per commit). Dispatch + agent rules in `.claude/prompts.md`. Deployment posture in `docs/deployments.md`.

## Repo layout

```
geoffery/
├── CHARTER.md              non-negotiable constraints — every agent reads this first
├── DECISIONS.md            append-only log of cross-agent decisions and rationale
├── CHANGELOG.md            append-only log of what changed and why (one entry / commit)
├── docs/
│   ├── design-spec.md      full product/technical spec (source of truth)
│   └── deployments.md      local/qa/prod posture + Cloudflare Access setup
├── .claude/
│   ├── prompts.md          top-level dispatch rules — every agent reads this first
│   ├── agents/             8 agent definitions (Claude Code subagent format)
│   └── proposals/          drafts for CROSS-MODULE changes (see CHARTER §protocol)
├── scripts/
│   └── run.sh              single launcher: `scripts/run.sh <local|qa|prod> <cmd>`
├── env/
│   ├── .env.local.example  templates — copy to .env / .env.qa / .env.prod
│   ├── .env.qa.example
│   └── .env.prod.example
├── pipeline/               Python (uv): collector, aggregates, news poller
├── web/                    Astro: static-generated site + PWA
└── data/                   SQLite db (gitignored) — irreplaceable raw history
```

## The team

| Agent | Owns | Spec § |
|---|---|---|
| **product-lead** | Sequencing, decisions, definition-of-done | §10 |
| **data-engineer** | Wiki API ingestion, time-series, aggregates — *activates first* | §5 |
| **algorithms** | Deal gauge, unsettled state, methodology, ledger tiers | §4 |
| **frontend** | Item pages, search, PWA, dialogue component, tip jar UI, ledger page | §§2–3 |
| **design-character** | Geoffery look/voice, design tokens, copy lines, iconography | §1 |
| **monetization** | Ads policy, tips, deferred subs, locked-model guardian | §6 |
| **growth-seo** | URL/title patterns, domains, programmatic SEO | §7 |
| **compliance** | Jagex/IP review (veto), data sourcing, disclaimers | §8 |
| **ops** | Hosting, scheduling, monitoring, minimal-maintenance budget | §9 |

## How collaboration works

Charter constraints are non-negotiable. Conflicts follow the charter protocol: pros/cons → eliminate constraint violations → most-complete-whole-product wins → tie-breakers (less maintenance, simpler UX, easier reversal, cheaper) → deadlocks escalate to product-lead. Resolutions go in `DECISIONS.md`. Compliance's Jagex-IP veto is the one veto outside trade-off analysis.

## Kickoff sequence (MVP, ~spec §10)

1. product-lead reads charter + spec, opens `DECISIONS.md`, activates data-engineer.
2. data-engineer ships the collector — the only hard deadline; history can't be backfilled. compliance signs off on sourcing.
3. growth-seo + frontend settle URL/title architecture (one-way door). compliance runs name/domain diligence.
4. data-engineer + algorithms agree aggregate shapes; algorithms ships gauge v1 + methodology page.
5. design-character delivers tokens, dialogue states, ~25 copy lines; compliance reviews brief and panel design before art is commissioned.
6. frontend assembles item pages, search, dialogue component, ledger, tip jar UI; monetization wires tips; ops stands up hosting/monitoring.
7. product-lead verifies definition-of-done.

## Running

Everything routes through the deployment-aware launcher.

```bash
# First time: seed env files from the templates.
cp env/.env.local.example .env
cp env/.env.qa.example    .env.qa
cp env/.env.prod.example  .env.prod
# Install deps.
cd pipeline && uv sync && cd ../web && npm install && cd ..

# Local loop.
./scripts/run.sh local cron      # collect + aggregates + news + export
./scripts/run.sh local dev       # astro dev at :4321
./scripts/run.sh local build     # build with local site URL
./scripts/run.sh local preview   # serve dist/ at :4321

# qa / prod — same code path, different env file + label.
./scripts/run.sh qa cron && ./scripts/run.sh qa build
./scripts/run.sh prod cron && ./scripts/run.sh prod build
```

qa is hidden from the public via **Cloudflare Access (Zero Trust)** gating the entire qa subdomain to an email allowlist; defence-in-depth via `<meta name="robots" content="noindex, nofollow">` on every page and a `Disallow: /` robots.txt. Live Stripe tip-jar URLs only render when the build's deployment label is `prod`. Full posture in `docs/deployments.md`.

Cron entries for collector (every 5 min), aggregates+export (hourly), and news poller (hourly) live in `pipeline/launchd/` and are installed via `pipeline/launchd/install.sh <env>`.
