# Cloudflare hosting — first-time provisioning (dev → prod → launch)

The reproducible, interrogable record of how Geoffery is hosted on Cloudflare. It
covers the whole arc — account prerequisites, per-environment provisioning, DNS, the
dashboard-only steps, the prod mirror, and launch cutover — so it never has to be
re-derived. Owned by the **`db`** agent (deploys, `ops/`, the RUNBOOK).

**Where this fits:** `ops/run.sh` is the launcher; `docs/RUNBOOK.md` covers routine
ops; `ops/wrangler/ACCESS.md` is the Zero-Trust **Access policy** detail. This file is
the first-time **provisioning** authority. To interrogate it live, run
`ops/run.sh <env> doctor` — it reports every prerequisite below and the fix for each.

The two environments are mechanically identical — only `env/.env.<target>`, the
wrangler `--env` label, and the origin differ ("works in dev ⇒ works in prod"):

| | dev | prod |
| --- | --- | --- |
| Origin | `dev.geoffery.gg` | `geoffery.gg` |
| Public? | **No** — Cloudflare Access gate (owner only) | Yes |
| D1 / R2 | `geoffery-dev` / `geoffery-archive-dev` | `geoffery-prod` / `geoffery-archive-prod` |
| Pages project | `geoffery-dev` | `geoffery-prod` |

---

## 1. Account prerequisites (one-time, per Cloudflare account)

These gates are invisible until a command fails with a cryptic API error. Do them once.

### 1a. Install the pinned wrangler, then authenticate
```bash
npm install                 # installs the pinned wrangler (package.json: "wrangler": "^3")
npx wrangler login          # OAuth in a browser; rides your normal Cloudflare user/pass + 2FA
npx wrangler whoami         # confirms auth + prints the account id you'll need below
```
- **Pin matters:** the deploy is built/tested against **wrangler v3**. If `node_modules`
  is missing wrangler, bare `npx wrangler` fetches **v4** (different behaviour). After
  `npm install`, `ops/run.sh` uses `node_modules/.bin/wrangler` (v3) automatically.
- `wrangler login` stores an **OAuth token** (`~/.config/.wrangler/…`), never your
  password. A scoped `CLOUDFLARE_API_TOKEN` in `env/.env.<target>` is the non-interactive
  alternative (never paste it into chat).

### 1b. Enable R2 (object storage)
R2 is a separately-billed product gated behind a one-time opt-in.
- **Symptom if skipped:** `wrangler r2 bucket create …` → `Please enable R2 through the
  Cloudflare Dashboard. [code: 10042]`.
- **Fix:** Cloudflare dashboard → **R2 Object Storage** → **Enable R2** / Get started,
  accept terms (may ask for a payment method even for the free tier).

### 1c. Initialize the `workers.dev` subdomain
A fresh account has no `workers.dev` subdomain, and Cloudflare refuses to attach cron
schedules to a worker until one exists.
- **Symptom if skipped:** `deploy` uploads the worker, then fails registering schedules
  with `You need a workers.dev subdomain … [code: 10063]`.
- **Fix:** dashboard → **Workers & Pages** (Compute). Just opening it the first time
  auto-creates the subdomain (it may ask you to pick a name — any is fine; we serve from
  custom domains, not this).

---

## 2. Per-environment provisioning (do for dev, then repeat for prod)

Substitute `dev`↔`prod` and the resource names from the table above throughout.

### 2a. Fill the env file
```bash
cp env/.env.dev.example env/.env.dev      # then edit in your editor
```
Set `CLOUDFLARE_ACCOUNT_ID` (from `wrangler whoami`) and `GEOFFERY_ZONE=geoffery.gg`.
Leave `CLOUDFLARE_API_TOKEN` empty when using `wrangler login`. `env/.env.*` is gitignored.

### 2b. Create the storage resources
```bash
npx wrangler d1 create geoffery-dev               # prints a database_id
npx wrangler r2 bucket create geoffery-archive-dev
```

### 2c. Paste the D1 id into the wrangler configs
Paste the printed `database_id` over **every** `REPLACE_WITH_DEV_D1_ID` (use
`REPLACE_WITH_PROD_D1_ID` for prod) in all five tomls:
`ops/wrangler/{collector,aggregator,scorer,news,consult}.toml`. (These are committed —
the D1 id is not a secret.)

### 2d. Apply the schema to D1
The source of truth is the `SCHEMA` const in `packages/data/src/schema.ts`. **Do not
hand-write a `.sql` file** — generate it (the three top `PRAGMA` lines must be stripped;
D1 manages journaling/synchronous/foreign-keys itself and rejects them):
```bash
ops/run.sh dev provision-schema     # gen-d1-schema.mjs → PRAGMA-stripped SQL → d1 execute --remote
```
Idempotent (all `CREATE … IF NOT EXISTS`). Expect 12 tables (11 core + `donations`).

### 2e. Smoke, then deploy
```bash
ops/run.sh dev dry-run          # bundles all 5 workers, uploads nothing — catches build errors
ops/run.sh dev deploy-workers   # the 5 cron/HTTP workers (collector cron starts on success)
ops/run.sh dev deploy-site      # Astro build + wrangler pages deploy
# (ops/run.sh dev deploy does workers + site together)
ops/run.sh dev secret ANTHROPIC_API_KEY news   # optional; news degrades gracefully without it
```

---

## 3. DNS / registrar (one-time, per zone)

The zone lives on Cloudflare, but the **registrar** (Porkbun for `geoffery.gg`) must
delegate to Cloudflare's nameservers. The `.gg` registry is Nominet (`dns1-4.nominetdns.uk`).

1. Porkbun → Domain Management → `geoffery.gg` → **Authoritative Nameservers**: delete
   the Porkbun NS and add Cloudflare's two (from the zone's overview, e.g.
   `albert.ns.cloudflare.com` / `isla.ns.cloudflare.com`). Save.
2. Ensure **DNSSEC is off** at the registry (re-enable later via Cloudflare if wanted).
3. Verify propagation (the registry returns the delegation in the **authority** section,
   so `+short` shows nothing — query the TLD directly):
   ```bash
   dig NS geoffery.gg @dns1.nominetdns.uk +noall +authority   # expect the cloudflare NS once live
   dig +short NS geoffery.gg @1.1.1.1                          # populated once propagated
   ```
- Propagation is typically 1–2h, up to 24h. The zone being "Pending" does **not** block
  provisioning (§1–2 run against the API) — only the custom-domain attach (§4) needs it.
- "Only allow Cloudflare IPs at your origin" does **not** apply — there is no separate
  origin; everything is Cloudflare-hosted (Workers/Pages).

---

## 4. Cloudflare dashboard steps (per target)

These cannot be scripted with the current token; do them in the dashboard.

- **Custom domain → Pages:** attach `dev.geoffery.gg` (prod: `geoffery.gg`) to the
  `geoffery-<env>` Pages project. Cloudflare adds the proxied DNS record automatically.
- **dev Access gate:** create a Zero-Trust **self-hosted Access app** on `dev.geoffery.gg`
  (path `*`), policy **Allow → Emails → the owner email**. Detail and rationale live in
  `ops/wrangler/ACCESS.md`. **Prod has no Access app** — it is the public site.

---

## 5. Prod mirror & launch

- **Prod provisioning** = §1c is already done; repeat §2 with prod names and §4's
  custom-domain attach. No Access app.
- **Publishing on cron (resolved):** the static site reads build-time JSON; cron workers
  write D1/R2, and `ops/run.sh <env> publish` pulls the remote D1 → regenerates the JSON →
  builds → deploys. `.github/workflows/deploy.yml` runs `publish` on every push to `main`
  and hourly, so the live site auto-refreshes (`deploy-site` remains the manual
  build-from-local path for the first prod seed). See `docs/GO-LIVE.md` and
  `docs/RUNBOOK.md` → "Publishing aggregates".
- **Launch cutover** is DNS; rollback is a DNS revert, kept viable 30 days (spec §11
  Phase 7). Workers/Pages also roll back to a prior version in the dashboard.

---

## 5b. Monetization activation (Stripe tips + AdSense)

**Tips (Stripe Checkout — the consult worker serves `/api/tip` + `/api/stripe/webhook`):**
1. Stripe → **Test mode** → Developers → API keys → copy the test secret key (`sk_test_…`).
2. `ops/run.sh dev secret STRIPE_SECRET_KEY consult` (wrangler prompts; value never shown).
3. Stripe → Developers → **Webhooks** → add endpoint `https://dev.geoffery.gg/api/stripe/webhook`,
   event `checkout.session.completed`. Copy its signing secret (`whsec_…`) →
   `ops/run.sh dev secret STRIPE_WEBHOOK_SECRET consult`.
4. **Access Bypass for the webhook** (Stripe is server-to-server and can't pass the login wall):
   Zero Trust → Access → Applications → Add → Self-hosted, domain
   `dev.geoffery.gg/api/stripe/webhook`, one policy action **Bypass → Everyone**. The Stripe
   signature (step 3) is the real auth; the main dev app keeps gating everything else.
5. `ops/run.sh dev deploy-workers` (if secrets were set after the last deploy). **Verify:** tip $1
   on `dev.geoffery.gg/money/` → Stripe test Checkout → pay `4242 4242 4242 4242` → the payment
   appears in the Stripe **test** dashboard and a `donations` row lands in D1; the jar/wall update
   after the next `export` + `deploy-site`. Prod swaps `sk_live_…` + a prod webhook (no Access
   Bypass — prod isn't gated).

**Ads (AdSense):** set `PUBLIC_ADSENSE_CLIENT` (`ca-pub-…`) + the three `PUBLIC_ADSENSE_SLOT_*`
unit ids in `env/.env.<env>` once the site is AdSense-approved, then rebuild + `deploy-site`.
Empty → dormant. Keep **Auto Ads off** in the account; the category blocks (gold sellers/RWT,
gambling, get-rich-quick) are a `design/compliance` gate. Real fill is prod-only.

## 6. Aspirational / not-yet-done (capture, don't rediscover)

For the full ordered launch sequence (provision → domain → CI → AdSense), follow
**`docs/GO-LIVE.md`**. Remaining items:

- [ ] Prod environment fully provisioned (§2 + §4 with prod names).
- [ ] Custom domains attached (dev + prod) once DNS is live.
- [ ] dev Access app created.
- [ ] `ANTHROPIC_API_KEY` set on the `news` worker (both envs).
- [x] Scheduled rebuild so the live site auto-refreshes — done via `ops/run.sh <env> publish`
      + `.github/workflows/deploy.yml` (push-to-main + hourly).
- [ ] CI secrets added in GitHub (`CLOUDFLARE_API_TOKEN` scoped, `CLOUDFLARE_ACCOUNT_ID`,
      `GEOFFERY_ZONE`) so the deploy workflow runs — `docs/GO-LIVE.md` §4.
- [ ] Monitoring: wire `staleJobs` → a page-the-owner alert in prod (collector death is
      the one alert that matters — RUNBOOK "Alerts").
- [ ] R2 restore drill run against the prod archive (`npm run restore:drill`).
- [ ] `Base.astro` emits `noindex` for non-prod (belt-and-suspenders behind Access).

---

## 7. Validation

```bash
ops/run.sh dev doctor      # auth · account id/zone · R2 enabled · R2 bucket · D1 schema · DNS
```
Then confirm a first collector run wrote a heartbeat and the site loads behind the gate.

---

## 8. Troubleshooting (symptom → cause → fix)

| Symptom | Cause | Fix |
| --- | --- | --- |
| `[code: 10042]` on `r2 bucket create` | R2 not enabled on the account | §1b — enable R2 in the dashboard |
| `[code: 10063]` on deploy (schedules) | No `workers.dev` subdomain | §1c — open Workers & Pages once |
| `Could not resolve "node:sqlite"` in `dry-run`/deploy | A worker's import graph reached the Node-only local store | A `worker.ts`/`handler.ts` must import only `@geoffery/data` (portable), never `@geoffery/data/node`. See SYSTEM_ARCHITECTURE §2.2/§3.2 |
| `wrangler … --file packages/data/src/schema.sql` not found | There is no committed `.sql` — `schema.ts` is the source | Use `ops/run.sh <env> provision-schema` (generates it) |
| `PRAGMA … not authorized` applying schema | D1 rejects connection PRAGMAs | Use the generator — it strips them |
| `You are not authenticated` | No wrangler OAuth/token | `npx wrangler login` (or set `CLOUDFLARE_API_TOKEN`) |
| `dig +short NS geoffery.gg` empty | Registry delegation not propagated | Wait (≤24h); confirm NS saved at the registrar; query `@dns1.nominetdns.uk +authority` |
| `npx wrangler` shows v4 | wrangler not installed locally | `npm install`; `ops/run.sh` then uses pinned v3 |

---

## 9. As-built record — dev (2026-06-15)

Non-secret identifiers (the D1 id already lives in the committed tomls):

| Item | Value |
| --- | --- |
| Account | id from `wrangler whoami` (not committed) |
| Zone | `geoffery.gg` (registrar Porkbun → Cloudflare NS `albert`/`isla`) |
| D1 | `geoffery-dev` (id in `ops/wrangler/*.toml`) (12 tables incl. `donations`) |
| R2 | `geoffery-archive-dev` |
| wrangler | `3.114.17` (pinned `^3`) |

### Prod (2026-06-18)

| Item | Value |
| --- | --- |
| Origin | `geoffery.gg` (Pages project `geoffery-prod`; **custom-domain attach pending** — §4) |
| D1 | `geoffery-prod` (id in `ops/wrangler/*.toml`) (12 tables) |
| R2 | `geoffery-archive-prod` |
| Workers | `geoffery-{collector,aggregator,scorer,news}-prod` (cron) + `geoffery-consult-prod` (HTTP) |
| Pages | `geoffery-prod` — first deployment live at `geoffery-prod.pages.dev` (seed build, `noindex` until first `publish`) |

**Cron budget:** the free plan caps **5 cron triggers per account**. Prod uses 4
(collector `*/5`, aggregator `0 *`, scorer `*/30`, news `0 */6`); to fit, **dev's crons were
cleared** (`triggers.crons = []` in the `[env.dev]` sections, workers kept). Re-enabling dev
crons needs Workers Paid or freeing prod slots.
