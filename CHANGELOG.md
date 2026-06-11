# Geoffery System Changelog

Newest entries at the top. Every change ships with one entry — see `.claude/prompts.md` "CHANGELOG discipline" for the format and rules. Each entry corresponds to one git commit.

---

## 2026-06-11 — ops — SCOPE: LOCAL
**Summary**: `scripts/run.sh` is now the single verb-less serve script: `./scripts/run.sh <localhost|local|qa|prod>` defaults to `serve`. `localhost` runs `astro dev` (HMR, no build). `qa` / `prod` write a `web/dist/.build-stamp` of env+version+epoch, and `serve` rebuilds only if missing, env-mismatched, version-mismatched, or any source file newer than the stamp. Auto-installs `node_modules/` on first run.
**Files touched**:
- `scripts/run.sh` — `serve` command, `needs_rebuild`, stamp, `localhost` alias for `local`.
**Verification**: built dist/ fresh; `./scripts/run.sh qa serve` skipped build ("dist/ is fresh"); switching qa → prod triggered rebuild ("stamp env=qa, requested=prod"); `touch web/src/pages/index.astro` then prod serve triggered rebuild ("source newer than stamp"); `localhost serve` served `astro dev` with HMR.

---

## 2026-06-11 — retroactive seed — covers commit 93272e7

The two entries below describe work that landed in the repo's initial commit, before the CHANGELOG file existed. They're seeded here for continuity; from this commit forward, one entry maps 1:1 to one git commit.

## 2026-06-11 — ops — SCOPE: CROSS-MODULE
**Summary**: Replicated the dexter-dev local / qa / prod deployment split. One launcher (`scripts/run.sh <env> <cmd>`), three env-file templates under `env/`, `GEOFFERY_DEPLOYMENT_NAME` label that flows through pipeline (`config.py`, `export.py`) and Astro build (`astro.config.mjs`, `src/lib/env.ts`). qa is hidden four ways: Cloudflare Access (primary, owner-action), `<meta name="robots" content="noindex, nofollow">` on every page, `Disallow: /` robots.txt, omitted canonical (so accidental qa indexing can never consolidate into prod's rank). Live Stripe URLs structurally refuse to render outside `DEPLOYMENT_NAME=prod`, eliminating accidental real-money flow on qa. Top banner shows `LOCAL` / `QA` band on non-prod; absent on prod. Sitemap integration is enabled only on prod. `pipeline/launchd/install.sh <env>` namespaces jobs so qa and prod coexist on one host. Per-deploy cache-bust token (`GEOFFERY_BUILD_VERSION`) derived from `git rev-parse --short HEAD`, fallback `<env>-<unix>`.
**Files touched**:
- `scripts/run.sh` — new dispatcher.
- `env/.env.{local,qa,prod}.example`, `env/README.md` — env templates.
- `pipeline/src/geoffery_pipeline/config.py` — `DEPLOYMENT_NAME`, `is_prod()`, `is_local()`.
- `pipeline/src/geoffery_pipeline/export.py` — `deployment` in `meta.json`.
- `pipeline/launchd/{install.sh,com.geoffery.*.plist}` — env-aware plists.
- `web/astro.config.mjs` — `site` per env, sitemap on prod only.
- `web/src/lib/env.ts` — `deployment`, `isProd`, `robotsContent`, `buildVersion`.
- `web/src/layouts/Base.astro` — robots meta, conditional canonical/OG, env banner.
- `web/src/components/TipJar.astro` — refuses live URLs outside prod.
- `web/src/pages/robots.txt.ts` — deployment-aware robots.txt.
- `docs/deployments.md` — Cloudflare Access setup, behavior matrix.
- `.claude/agents/ops.md` — deployment posture section.
- `DECISIONS.md`, `README.md`, `pipeline/README.md` — updates.
- `.gitignore` — exclude all three filled env files.
**Affected agents**: ops (initiator), data-engineer, frontend, monetization.
**Verification**: built all three envs in sequence; verified robots/canonical/sitemap/banner/tip-jar matrix against the build matrix in `docs/deployments.md`; `uv run pytest` still passes 4/4.

## 2026-06-11 — product-lead — SCOPE: CROSS-MODULE
**Summary**: Initial Geoffery MVP. Repo scaffolded: `CHARTER.md`, `docs/design-spec.md`, eight agent prompts under `.claude/agents/`, `.claude/proposals/` for cross-module changes, `DECISIONS.md`. `pipeline/` (uv) runs the OSRS Wiki API collector, computes percentile-based deal-gauge aggregates, polls the OSRS news RSS, and exports JSON snapshots. `web/` (Astro) static-generates ~4,600 item pages + chrome (search, methodology, how-we-make-money, ledger, about, 404), with Geoffery dialogue component, tip jar dialog, PWA manifest + service worker. Charter constraint 5 honoured: collector lives before anything else.
**Files touched**: ~70 files across `.claude/`, `docs/`, `pipeline/`, `web/`, root.
**Affected agents**: all eight.
**Verification**: pipeline collected 4,572 items, 4,420 latest prices, 1,588 active 5m buckets; aggregates computed for all items (unsettled until 30d history accrues, as designed); news poller pulled 15 RSS entries; Astro build produced 4,578 pages in 7.4s; `uv run pytest` passes 4/4 (gauge math: thin-history / good / poor / news-forces-unsettled).
**Follow-on (owner)**: register `geoffery.gg` + `geoffrey.*` redirects; trademark / OSRS-tool collision search; install local launchd; commission character art via `design-character` brief; fill `.env.prod` with Stripe Payment Link URLs (in the editor, not in chat).
