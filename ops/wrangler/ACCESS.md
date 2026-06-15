# Cloudflare deploy — provisioning + the dev access gate

`ops/run.sh dev` and `ops/run.sh prod` deploy the same artifacts (5 Workers +
the Astro Pages site) to two Cloudflare environments. They are mechanically
identical — only the env file (`env/.env.dev` vs `env/.env.prod`), the wrangler
`--env` label, and the origin differ. This file is the operator checklist and
the record of the **dev whitelisting** model.

> The storage seam is async and the workers are wired to D1/R2 (`D1Store`/
> `R2Archive` in `workers/_shared/cloudflare.ts`) — see `docs/RUNBOOK.md →
> "Cloudflare execution (async seam)"`. Remaining work is operator-side
> provisioning (account/zone, D1/R2 creation + ids, schema, Access app), below.

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

The full reproducible sequence — account prerequisites (R2 enablement / error
`10042`, the `workers.dev` subdomain / error `10063`), `wrangler login` + the v3 pin,
D1/R2 creation, the `.toml` ids, schema apply, dry-run/deploy, the DNS/registrar
steps, and the dashboard custom-domain attach — lives in **`docs/CLOUDFLARE-SETUP.md`**
(the authority). Highlights:

- Apply the schema with `ops/run.sh <env> provision-schema` — it generates a
  PRAGMA-stripped `.sql` from `packages/data/src/schema.ts` (there is **no** committed
  `schema.sql`) and runs `wrangler d1 execute --remote`. Idempotent.
- `ops/run.sh <env> doctor` checks every prerequisite and prints the fix for each.
- `ops/run.sh <env> deploy` = `deploy-workers` + `deploy-site` once the one-time
  resources exist.

Then create the **Access application** below so the dev origin is gated.

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
