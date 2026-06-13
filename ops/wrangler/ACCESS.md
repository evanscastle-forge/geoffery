# Cloudflare deploy — provisioning + the dev access gate

`ops/run.sh dev` and `ops/run.sh prod` deploy the same artifacts (5 Workers +
the Astro Pages site) to two Cloudflare environments. They are mechanically
identical — only the env file (`env/.env.dev` vs `env/.env.prod`), the wrangler
`--env` label, and the origin differ. This file is the operator checklist and
the record of the **dev whitelisting** model.

> ⚠ Before these deploys can *execute*, the storage seam must go async — see
> `docs/RUNBOOK.md → "Cloudflare execution (async seam)"`. The configs, wrappers,
> and this checklist are complete; the workers currently fail loudly
> (`seamNotWired`) until that conversion lands.

## The two environments

| | dev | prod |
| --- | --- | --- |
| Origin | `dev.geoffery.gg` | `geoffery.gg` |
| Public? | **No** — Cloudflare Access gate (owner only) | Yes |
| Deployment label | `dev` | `prod` |
| D1 / R2 names | `geoffery-dev` / `geoffery-archive-dev` | `geoffery-prod` / `geoffery-archive-prod` |
| Pages project | `geoffery-dev` | `geoffery-prod` |

`dev.geoffery.gg` resolves on the public internet (it is a normal proxied DNS
record on the `geoffery.gg` zone) but is **not publicly reachable**: a Cloudflare
Access (Zero Trust) self-hosted application sits in front of it and only the
owner's identity passes. This is the "whitelisted through Cloudflare" gate.

## The dev Access policy (Zero Trust → Access → Applications)

Create a **self-hosted application** (once):

- **Application domain:** `dev.geoffery.gg`, path `*` (covers the site and the
  consult worker's `/api/*` route on the same host).
- **Session duration:** 24h is fine for a solo dev gate.
- **Policy:** action **Allow**, rule **Emails** → `evanscastle.forge@gmail.com`.
  Everyone else gets the Access login wall and never reaches the origin.
- **Identity provider:** the built-in One-time PIN is enough for a single owner;
  add Google later if desired.
- For any *automated* hit on dev (a smoke script, CI), add a **Service Token**
  and a second Allow rule for it — do not weaken the email rule.

Prod (`geoffery.gg`) has **no** Access application — it is the public site.

## First-time provisioning (per environment)

Run these once for `dev`, then again for `prod` (substitute the names from the
table). `wrangler` comes from the repo devDependency; `npm install` first.

```bash
wrangler login                                   # OAuth; or set CLOUDFLARE_API_TOKEN
cp env/.env.dev.example env/.env.dev             # fill account id + zone in your editor

wrangler d1 create geoffery-dev                  # → copy database_id into ops/wrangler/*.toml
wrangler r2 bucket create geoffery-archive-dev   # ARCHIVE bucket

# Paste the printed database_id over every REPLACE_WITH_DEV_D1_ID in ops/wrangler/*.toml.

# Apply the schema to D1 (packages/data/src/schema.ts is the source of truth):
wrangler d1 execute geoffery-dev --remote --file packages/data/src/schema.sql   # see RUNBOOK note

# Push the archive history into R2 (the irreplaceable asset), then the workers:
ops/run.sh dev deploy-workers
ops/run.sh dev secret ANTHROPIC_API_KEY news     # wrangler prompts; value never shown

# Pages site: create the project (once), then deploy.
wrangler pages project create geoffery-dev --production-branch dev
ops/run.sh dev deploy-site                       # build + wrangler pages deploy
# In the dashboard, add the custom domain dev.geoffery.gg to the geoffery-dev Pages project.

# Finally, create the Access application above so the dev origin is gated.
```

`ops/run.sh dev deploy` does `deploy-workers` + `deploy-site` together once the
above one-time resources exist.

## Publishing aggregates (open design item)

The site is static and reads build-time JSON (`site/src/generated/*.json`). On
Cloudflare the cron workers write fresh data into D1/R2, but the *site* only
picks it up on the next `deploy-site` (a Pages rebuild). Until a scheduled
rebuild (a Pages deploy hook fired on a cron, or a "rebuild" worker) is wired,
publishing new prices to the live site is a manual `ops/run.sh <env> deploy-site`.
Tracked in `docs/RUNBOOK.md`.

## Rollback

- **Workers / Pages:** roll back to the previous version in the dashboard, or
  redeploy a prior git SHA (`ops/run.sh <env> deploy` rebuilds from the checkout).
- **Cutover/rollback at launch** is DNS, kept viable 30 days (spec §11 Phase 7).
