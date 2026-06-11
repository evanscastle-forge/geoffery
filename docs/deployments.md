# Deployments

Geoffery follows the dexter-dev posture: three deployments — `local` / `qa` / `prod` — that run the **same code path**. Only the env file sourced and the `GEOFFERY_DEPLOYMENT_NAME` label differ between qa and prod, which is the "works in qa ⇒ works in prod" fidelity guarantee. `local` is the developer loop and is otherwise identical to qa in posture (noindex, tip jar disabled).

## Behavior matrix

| axis | local | qa | prod |
|---|---|---|---|
| env file sourced | `.env` | `.env.qa` | `.env.prod` |
| `GEOFFERY_DEPLOYMENT_NAME` | `local` | `qa` | `prod` |
| Astro `site` | `http://127.0.0.1:4321` | `https://geoffery.evanscastle-forge.com` | `https://geoffery.gg` |
| `<meta name=robots>` | `noindex, nofollow` | `noindex, nofollow` | `index, follow` |
| `robots.txt` | `Disallow: /` | `Disallow: /` | allow + sitemap |
| `<link rel=canonical>` | omitted | omitted | present |
| OG meta tags | omitted | omitted | present |
| Sitemap integration | off | off | on (`sitemap-index.xml`) |
| Tip jar | locked notice | locked notice | live Stripe links (if `.env.prod` is filled) |
| Top banner | `LOCAL · not the public site` | `QA · not the public site` | none |
| Public reachability | localhost only | Cloudflare Access (email allowlist) | open |
| Search engine indexing | impossible | refused four ways | invited |

Four layers of "qa is hidden":
1. **Cloudflare Access** — the primary gate. Anyone hitting the qa subdomain hits a Zero Trust login first; only allowlisted emails get through. This is what actually keeps strangers out.
2. **`<meta name="robots" content="noindex, nofollow">`** on every page — second line of defence if Access is misconfigured.
3. **`robots.txt` deny-all** at the qa zone — third line of defence for crawlers that ignore meta tags.
4. **No `<link rel=canonical>` to prod from qa** — so a stray indexed qa URL can never consolidate into prod's search authority.

## Launcher

`scripts/run.sh <env> <cmd>` is the single entry point.

```bash
scripts/run.sh local cron        # full ingest → aggregates → news → export
scripts/run.sh local build       # astro build with local site URL
scripts/run.sh local dev         # astro dev server (refused outside local)
scripts/run.sh qa cron           # qa data refresh
scripts/run.sh qa build          # builds with QA banner, noindex, locked tip jar
scripts/run.sh prod build        # the only build that emits canonical + sitemap
scripts/run.sh prod cron         # the only ingestion that should run on prod hardware
```

The launcher computes `GEOFFERY_BUILD_VERSION` from `git rev-parse --short HEAD` and threads it into the `<meta name="x-geoffery-build">` tag (and a future cache-bust query string on assets) — borrowed from dexter-dev's per-deploy cache-bust pattern.

## Cloudflare setup (owner action — see the launch TODO)

The qa zone piggybacks on the operator's existing `evanscastle-forge.com` Cloudflare account, so no second Cloudflare zone is required.

### DNS

| Subdomain | Type | Target | Purpose |
|---|---|---|---|
| `geoffery.evanscastle-forge.com` | CNAME | `<tunnel-id>.cfargotunnel.com` (or Pages project) | qa origin |
| `geoffery.gg` | CNAME | prod origin (or Pages project) | prod origin |

### Zero Trust Access app — qa only

In Cloudflare Zero Trust → Access → Applications:

1. **Application name**: `Geoffery (qa)`
2. **Type**: Self-hosted
3. **Application domain**: `geoffery.evanscastle-forge.com` (entire subdomain — leave path blank).
4. **Identity providers**: `One-time PIN` (simplest) or Google.
5. **Policies → "Allow operators"**:
   - **Action**: `Allow`
   - **Session duration**: 24h
   - **Include**: `Emails` → `evanscastle.forge@gmail.com` (+ any teammates).
6. **Browser rendering**: enable; this is the default. Once saved, every request to `geoffery.evanscastle-forge.com` is intercepted by Cloudflare and shown an Access login before reaching the origin.

Prod (`geoffery.gg`) has **no** Access app — it's public.

### Tunnel / origin

For a static site, the simplest origin is **Cloudflare Pages** — point each Pages project at its build output. For self-hosting on a VPS, `cloudflared` with two ingress rules works:

```yaml
ingress:
  - hostname: geoffery.evanscastle-forge.com
    service: http://localhost:8081
  - hostname: geoffery.gg
    service: http://localhost:8080
  - service: http_status:404
```

Each origin port serves the static `web/dist/` produced by the matching `scripts/run.sh <env> build`. Whichever way you go, **never expose the origin IP directly** — qa specifically must only be reachable through Cloudflare, otherwise Access is moot.

### Build output locations (recommended)

```
/srv/geoffery/qa/data/geoffery.db        # qa SQLite (charter: irreplaceable raw history)
/srv/geoffery/qa/dist/                   # static artifacts served by qa origin
/srv/geoffery/prod/data/geoffery.db      # prod SQLite (separate; never shared)
/srv/geoffery/prod/dist/                 # static artifacts served by prod origin
```

qa and prod run side-by-side: distinct DBs, distinct env files, distinct origins. The collector runs on both (each maintains its own history), so qa can drift from prod by 5 minutes without losing fidelity.

## "How do I know which deployment I'm looking at?"

Three signals, all visible in the page itself:

1. The top banner says `LOCAL` or `QA` (absent on prod).
2. `<meta name="x-geoffery-deployment" content="…">` in `<head>`.
3. `<html data-deployment="…">` — useful for env-conditional CSS or browser-side checks.

## What the protocol borrows from dexter-dev

- The behavior matrix and the "works in qa ⇒ works in prod" fidelity guarantee (lifted directly from `dex/dexter-dev/scripts/run.sh`).
- The `<deployment>` env-var literal pattern (`GEOFFERY_DEPLOYMENT_NAME=local|qa|prod` mirrors `DEXTER_DEPLOYMENT_NAME`).
- Per-deploy cache-bust via git SHA → `GEOFFERY_BUILD_VERSION`.
- Cloudflare Access as the qa gate (lifted from the dexter-dev qa lockdown of 2026-06-05; same email-allowlist Zero Trust app shape).
- The `noindex` posture on every non-prod page (mirrors dexter-dev's `<meta name="robots" content="noindex, nofollow">` rule).

What we did NOT borrow: the OAuth callback / cookie posture / TrustedHosts middleware — Geoffery is account-free static at launch, so there is no auth-bearing request path that needs them.
