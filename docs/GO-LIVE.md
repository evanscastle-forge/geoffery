# Go-live runbook — geoffery.gg

The ordered path from "code-complete" to **public** and then to **serving ads**. Steps
marked **OWNER** require a dashboard/account you must drive (I can't click those); the rest
are commands you run in the repo. Detail lives in `docs/CLOUDFLARE-SETUP.md`; this is the
sequence.

**State (2026-06-18):** code complete — monetization model is now *unlimited usage, voluntary
tips, ads = revenue*; the legal pages (privacy/terms/cookies) + methodology page are live;
CI/CD is wired (`.github/workflows/deploy.yml` + `ops/run.sh prod publish`). Prereqs already
done: `wrangler login`, R2 enabled, prod DNS delegated. `env/.env.prod` is created (account id
+ zone; no secrets). Ads are **dormant** until a publisher id is set.

> Ads cannot *serve* until Google approves the live site (days–weeks). Everything below gets
> you to a public site + an AdSense submission; ads switch on automatically once approved and
> the four `PUBLIC_ADSENSE_*` vars are set (step 6).

---

## 1. Provision prod (your machine, ~10 min)

```bash
cd <repo>
./ops/run.sh prod doctor            # sanity: auth ✓, R2 ✓, DNS ✓, D1/R2 bucket "missing" (expected)

npx wrangler d1 create geoffery-prod            # → copy the printed database_id
npx wrangler r2 bucket create geoffery-archive-prod
```

Paste the printed D1 `database_id` over **every** `REPLACE_WITH_PROD_D1_ID` in the five
configs: `ops/wrangler/{collector,aggregator,scorer,news,consult}.toml`. Then:

```bash
./ops/run.sh prod provision-schema  # apply schema (idempotent) — expect 12 tables
./ops/run.sh prod dry-run           # bundle all 5 workers, upload nothing (catches build errors)
./ops/run.sh prod deploy-workers    # deploy the 5 workers — collector cron starts ingesting live data
# optional news classifier:
./ops/run.sh prod secret ANTHROPIC_API_KEY news
```

## 2. First site publish (seed from local data)

The site builds from generated JSON. Prod D1 is brand-new (little history yet), so seed the
*first* deploy from your local pipeline, which already has 30 days of history:

```bash
# make sure local .data/geoffery.db is fresh, then:
./ops/run.sh prod deploy-site       # builds from site/src/generated/*.json and deploys
```

Once prod D1 has accrued data, publish from live prod data instead (and CI does this for you):

```bash
./ops/run.sh prod publish           # pull prod D1 → regenerate JSON → build → deploy
```

## 3. Attach the domain — **OWNER** (Cloudflare dashboard)

Workers & Pages → `geoffery-prod` → **Custom domains** → add `geoffery.gg`. Cloudflare adds
the proxied DNS record and issues the cert. **No Access app** — prod is the public site.

Verify: `https://geoffery.gg` loads, and `/privacy/`, `/terms/`, `/cookies/`, `/methodology/`
all resolve; the footer shows the legal links; an item page shows the "not financial advice"
line and dormant ad placeholders.

## 4. CI/CD — automatic deploys — **OWNER** (GitHub → Settings → Secrets → Actions)

Add these **repository secrets** (never paste a token into chat — type it into GitHub directly):

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | from `wrangler whoami` |
| `GEOFFERY_ZONE` | `geoffery.gg` |
| `CLOUDFLARE_API_TOKEN` | a **scoped** token (create at dash.cloudflare.com/profile/api-tokens) |

Token scopes (Account-level, for the account above): **Cloudflare Pages: Edit · Workers
Scripts: Edit · D1: Edit · Workers R2 Storage: Edit** (plus the default Account Settings: Read).

Then `.github/workflows/deploy.yml` deploys on every push to `main` and hourly (keeps prices
fresh). Workers deploy only via a manual **Run workflow** with the *deploy-workers* box ticked.
Until the secrets exist the workflow stays green and skips. **Verify:** push a trivial change
to `main` → Actions tab → the run builds from prod data and the change appears at geoffery.gg.

## 5. (Optional, before public launch) Stripe live keys — **OWNER**

Tips are voluntary, but the button should work. Per `CLOUDFLARE-SETUP.md` §5b (prod variant):

```bash
./ops/run.sh prod secret STRIPE_SECRET_KEY consult       # sk_live_...
./ops/run.sh prod secret STRIPE_WEBHOOK_SECRET consult   # whsec_... from the prod webhook
./ops/run.sh prod deploy-workers
```

Stripe (live mode) → Webhooks → add `https://geoffery.gg/api/stripe/webhook`, event
`checkout.session.completed`. **No** Access bypass (prod is ungated). If keys aren't ready at
launch, soften the tip CTA instead. Off the ads critical path.

## 6. AdSense — submit, then activate — **OWNER** (+ a deploy)

1. Create a Google AdSense account; add site `geoffery.gg` → obtain your publisher id `ca-pub-…`.
2. Set it in `env/.env.prod` **and** as the GitHub secret `PUBLIC_ADSENSE_CLIENT`, leaving the
   three slot ids **empty**. Deploy (`./ops/run.sh prod deploy-site`, or push). Every page now
   carries the AdSense verification meta + loader; ad units stay dormant (empty slots).
3. In AdSense, request review / verify ownership. **Wait days–weeks.**
4. **After approval:**
   - AdSense dashboard: keep **Auto Ads OFF**; set **category blocks** (real-money gaming /
     gold sellers / RWT, gambling, get-rich-quick — `design/compliance` gate); configure the
     **GDPR + CCPA consent messages** (Google's certified CMP); create **3 manual display
     units** → 3 slot ids.
   - Add the `ads.txt` line Google gives you to `site/public/ads.txt`; verify `https://geoffery.gg/ads.txt`.
   - Set the three slot ids in `env/.env.prod` (+ GitHub secrets `PUBLIC_ADSENSE_SLOT_ITEM_MID`,
     `…_ITEM_BOTTOM`, `…_MOBILE`) and deploy. **Ads now serve** on item pages; the money page
     stays ad-free.

## 7. Post-launch (recommended fast-follows)

- Wire `staleJobs` → an owner alert (collector death is the one alert that matters — see RUNBOOK).
- Run the R2 restore drill against the prod archive: `npm run restore:drill`.
- Record the prod as-built row (D1 id, R2 bucket, date) in `docs/CLOUDFLARE-SETUP.md` §9.

## Versioning & rollback

- **Version** = `package.json` `version` (semver). Cut a release with `npm version patch|minor|major`
  (bumps + commits + tags in one step). There is no per-commit auto-bump; most builds reuse the
  current version, and the commit + build time pin the exact build. Builds trigger on push to
  `main`, the hourly cron (data refresh), or a manual run — never on a bare commit.
- **What's live:** `curl https://geoffery.gg/version.json` → `{ version, commit, builtAt, deployment }`,
  also shown as `v<version>` in the footer.
- **Regression guard:** a prod deploy (`deploy-site`/`publish`) refuses to ship a *lower* semver, or a
  checkout that is *behind* the live commit (a stale local tree). Override a deliberate rollback with
  `GEOFFERY_FORCE_DEPLOY=1 ./ops/run.sh prod deploy-site`.
- **Instant rollback:** Pages dashboard → `geoffery-prod` → Deployments → roll back (bypasses the
  script). Or `git revert` + push.
