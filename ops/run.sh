#!/usr/bin/env bash
# ops/run.sh — single launcher for Geoffery, dispatched by deployment target.
#
# Pattern borrowed from the dexter system's scripts/run.sh: the first positional
# arg is the *target*, a per-target posture matrix sets the env file + labels, a
# required-var preflight aborts before doing anything irreversible, and the
# script never echoes a secret value — only its name.
#
#   ops/run.sh localhost [cmd] [args...]   # local Node stack on 127.0.0.1 (debug)
#   ops/run.sh dev       [cmd] [args...]   # deploy to dev.geoffery.gg (Access-gated)
#   ops/run.sh prod      [cmd] [args...]   # deploy to geoffery.gg
#
# Targets:
#   localhost  Runs the all-TypeScript stack on this machine (scheduler + consult
#              worker + Astro dev site). Nothing is deployed. This is the old
#              localhost-only launcher; every sub-command still dispatches to an
#              npm script (package.json is the single source of entrypoints).
#   dev        Deploys the Cloudflare Workers + Pages to the `dev` environment,
#              served at dev.geoffery.gg. The zone is NOT publicly reachable — a
#              Cloudflare Access policy whitelists the owner (see
#              ops/wrangler/ACCESS.md). Use it to smoke a real deploy safely.
#   prod       Deploys the same artifacts to the `prod` environment at
#              geoffery.gg. Mechanically identical to `dev` — only the env file
#              and the wrangler --env label differ ("works in dev ⇒ works in
#              prod"). The deployment label also drives the site's local/prod
#              rendering toggle.
#
# localhost commands (default: serve):
#   serve         — full stack: scheduler + consult worker (:8787) + Astro (:4321)
#   site          — Astro dev site only (HMR), no worker/scheduler
#   consult       — consult worker only (the Butler's Bell HTTP surface)
#   collect | aggregate | news | scorer | export   — one-shot pipeline steps
#   backfill | backtest [args]   — historical loads (pass-through args)
#   pipeline      — collect → aggregate → news → export, in order
#   build | preview              — astro build / preview the built dist/
#   migrate | verify | restore-drill | check | sh
#
# dev/prod commands (default: deploy):
#   deploy        — build the site, then deploy every Worker + the Pages site
#   deploy-workers — deploy the cron/HTTP Workers only (no site)
#   deploy-site   — build + deploy the Astro static site to Pages only
#   publish       — refresh the site's data from the remote D1, then build + deploy the
#                 site. How fresh prices + committed code reach prod; used by CI on
#                 push-to-main and on an hourly schedule.
#   backfill-history — one-time: backfill the remote D1's 30-day price history from the OSRS
#                 Wiki timeseries (a fresh DB has none); coarse 6h points, idempotent upsert
#   provision-schema — apply the D1 schema (generated from schema.ts) to the remote
#                 DB; idempotent (CREATE … IF NOT EXISTS). See docs/CLOUDFLARE-SETUP.md
#   doctor        — read-only check of every provisioning prerequisite (auth, account
#                 id/zone, R2 enabled, D1 schema, R2 bucket, DNS), with the fix for each
#   tail [worker] — stream live logs (wrangler tail) for one worker (default: consult)
#   secret <NAME> [worker]  — set a Worker secret via `wrangler secret put`
#                 (wrangler prompts for the value on its own tty; this script
#                  NEVER takes a secret as an argument and never prints one)
#   dry-run       — wrangler deploy --dry-run for every Worker (no upload)
#
# This script never echoes secret values to stdout — only their names.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
WRANGLER_DIR="${SCRIPT_DIR}/wrangler"
cd "${REPO_ROOT}"

# The five deployable Workers, in dependency-friendly order (collector first so
# fresh data exists before anything reads it). Each has ops/wrangler/<name>.toml.
WORKERS=(collector aggregator scorer news consult)

usage() { sed -n '2,60p' "$0" >&2; exit "${1:-2}"; }

# ── per-deploy cache-bust token (borrowed from dexter) ──────────────────────
# Threaded into the site build so each deploy ships fresh asset URLs; Cloudflare
# and the browser both cache by URL. Git short SHA is the canonical "what code
# shipped" signal; fall back to a per-launch sentinel if git is unavailable.
if BUILD_SHA="$(git rev-parse --short HEAD 2>/dev/null)" && [[ -n "${BUILD_SHA}" ]]; then
    export GEOFFERY_BUILD_VERSION="${BUILD_SHA}"
else
    export GEOFFERY_BUILD_VERSION="dev-$(date +%s)"
fi
# Human release version (package.json) + ISO build time — baked into the site and surfaced
# at /version.json; the commit sha above is the provenance beneath it. The prod deploy guard
# (guard_no_regression) compares these against what is already live.
GEOFFERY_APP_VERSION="$(node -p "require('./package.json').version" 2>/dev/null || echo "0.0.0")"
GEOFFERY_BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export GEOFFERY_APP_VERSION GEOFFERY_BUILT_AT

# ── arg parse: target first ─────────────────────────────────────────────────
TARGET="${1:-}"
case "${TARGET}" in
    localhost|dev|prod) shift ;;
    -h|--help|"")       usage 0 ;;
    *) echo "[run] unknown target: ${TARGET} (expected localhost|dev|prod)" >&2; usage 2 ;;
esac
LOG="[run:${TARGET}]"

# ── per-target posture matrix ───────────────────────────────────────────────
#   ENV_FILE        which env file run.sh sources
#   DEPLOY_NAME     GEOFFERY_DEPLOYMENT_NAME (drives the site local/prod toggle)
#   SITE_URL        canonical origin for this target
#   WR_ENV          wrangler --env label (empty for localhost)
#   PUBLIC          1 ⇒ this is a real deploy; run the required-var preflight
case "${TARGET}" in
    localhost) ENV_FILE=".env";          DEPLOY_NAME="local"; SITE_URL="http://127.0.0.1:4321"; WR_ENV="";     PUBLIC=0 ;;
    dev)       ENV_FILE="env/.env.dev";  DEPLOY_NAME="dev";   SITE_URL="https://dev.geoffery.gg"; WR_ENV="dev";  PUBLIC=1 ;;
    prod)      ENV_FILE="env/.env.prod"; DEPLOY_NAME="prod";  SITE_URL="https://geoffery.gg";     WR_ENV="prod"; PUBLIC=1 ;;
esac

# ── source the env file ─────────────────────────────────────────────────────
if [[ -f "${ENV_FILE}" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
    set +a
elif [[ "${PUBLIC}" == "1" && -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
    # CI mode: no committed env file — config arrives via the process environment
    # (e.g. GitHub Actions secrets). The preflight below still validates the required vars.
    echo "${LOG} no ${ENV_FILE}; using config from the environment (CI mode)" >&2
elif [[ "${PUBLIC}" == "1" ]]; then
    echo "${LOG} env file ${ENV_FILE} not found." >&2
    echo "${LOG}   cp env/.env.${TARGET}.example ${ENV_FILE} and fill it in (account id, zone," >&2
    echo "${LOG}   D1/R2/KV ids). Secrets go via 'ops/run.sh ${TARGET} secret <NAME>', not this file." >&2
    exit 2
else
    echo "${LOG} env file ${ENV_FILE} not found." >&2
    echo "${LOG}   copy from .env.example and fill it in:  cp .env.example .env" >&2
    exit 2
fi

# Pin the deployment label + canonical origin for every child process.
export GEOFFERY_DEPLOYMENT_NAME="${GEOFFERY_DEPLOYMENT_NAME:-${DEPLOY_NAME}}"
export GEOFFERY_SITE_URL="${GEOFFERY_SITE_URL:-${SITE_URL}}"
CONSULT_PORT="${GEOFFERY_CONSULT_PORT:-8787}"

# ── localhost: the existing Node stack ──────────────────────────────────────
ensure_site_deps() {
    if [[ ! -d "${REPO_ROOT}/node_modules" ]]; then
        echo "${LOG} installing workspace deps (one-time)…" >&2
        npm install --silent
    fi
}

run_localhost() {
    local cmd="${1:-serve}"; shift || true
    case "${cmd}" in
        serve)
            ensure_site_deps
            echo "${LOG} serving full stack:" >&2
            echo "${LOG}   consult worker → http://127.0.0.1:${CONSULT_PORT}" >&2
            echo "${LOG}   site           → ${GEOFFERY_SITE_URL}" >&2
            exec npm run dev ;;
        site)
            ensure_site_deps
            echo "${LOG} serving site only (astro dev, HMR) → ${GEOFFERY_SITE_URL}" >&2
            exec npm run dev:site ;;
        consult)              exec npm run consult ;;
        collect)              exec npm run collect ;;
        aggregate|aggregates) exec npm run aggregate ;;
        news)                 exec npm run news ;;
        scorer)               exec npm run scorer ;;
        export)               exec npm run export ;;
        backfill)             exec npm run backfill -- "$@" ;;
        backtest)             exec npm run backtest -- "$@" ;;
        pipeline|cron)        exec npm run pipeline ;;
        build)                ensure_site_deps; exec npm --workspace site run build ;;
        preview)              exec npm --workspace site run preview ;;
        migrate)              exec npm run migrate:legacy ;;
        verify)               exec npm run migrate:verify ;;
        restore-drill)        exec npm run restore:drill ;;
        check)                exec npm run check ;;
        sh)                   exec "${SHELL:-/bin/sh}" ;;
        *) echo "${LOG} unknown localhost command: ${cmd}" >&2; usage ;;
    esac
}

# ── dev/prod: deploy via wrangler ───────────────────────────────────────────
# wrangler is read from the local node_modules (devDependency) when present,
# else npx fetches it. Auth is the operator's responsibility: run `wrangler
# login` once, or export CLOUDFLARE_API_TOKEN in env/.env.<target> (a scoped
# token, never pasted into chat).
WRANGLER=(npx --yes wrangler)
if [[ -x "${REPO_ROOT}/node_modules/.bin/wrangler" ]]; then
    WRANGLER=("${REPO_ROOT}/node_modules/.bin/wrangler")
fi

preflight_deploy() {
    # Required for any real deploy. Account id + zone identify where; the token
    # (or an interactive `wrangler login` session) authorizes. We check the
    # token is PRESENT but never print it.
    local missing=()
    [[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]] || missing+=("CLOUDFLARE_ACCOUNT_ID")
    [[ -n "${GEOFFERY_ZONE:-}"          ]] || missing+=("GEOFFERY_ZONE")
    if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]] && ! "${WRANGLER[@]}" whoami >/dev/null 2>&1; then
        missing+=("CLOUDFLARE_API_TOKEN (or run 'wrangler login' once)")
    fi
    if [[ "${#missing[@]}" -gt 0 ]]; then
        echo "${LOG} ERROR: required deploy config not set:" >&2
        for v in "${missing[@]}"; do echo "${LOG}   - ${v}" >&2; done
        echo "${LOG} populate ${ENV_FILE} (see env/.env.${TARGET}.example) and retry." >&2
        exit 1
    fi
    # Guard against a label/file mismatch — the dexter "works in dev ⇒ works in
    # prod" fidelity check: the env file must declare the target it claims.
    if [[ "${GEOFFERY_DEPLOYMENT_NAME}" != "${DEPLOY_NAME}" ]]; then
        echo "${LOG} ERROR: ${ENV_FILE} sets GEOFFERY_DEPLOYMENT_NAME='${GEOFFERY_DEPLOYMENT_NAME}', expected '${DEPLOY_NAME}'." >&2
        exit 1
    fi
}

# Prevent accidentally shipping older code to prod: compare the local release version +
# commit against what /version.json reports live. Refuse a lower semver, or a deploy whose
# checkout is BEHIND the live commit (a stale local tree). GEOFFERY_FORCE_DEPLOY=1 overrides
# (an intentional rollback). prod-only; first deploy / unreachable live site → no-op.
guard_no_regression() {
    [[ "${TARGET}" == "prod" ]] || return 0
    if [[ "${GEOFFERY_FORCE_DEPLOY:-}" == "1" ]]; then
        echo "${LOG} ⚠ GEOFFERY_FORCE_DEPLOY=1 — skipping the version regression guard"
        return 0
    fi
    local live local_ver live_ver live_commit
    live="$(curl -fsS --max-time 10 "${SITE_URL}/version.json" 2>/dev/null || true)"
    if [[ -z "${live}" ]]; then
        echo "${LOG} regression guard: no live /version.json yet (first deploy or unreachable) — proceeding"
        return 0
    fi
    local_ver="$(node -p "require('./package.json').version" 2>/dev/null || echo "0.0.0")"
    live_ver="$(printf '%s' "${live}"    | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).version || ""' 2>/dev/null || true)"
    live_commit="$(printf '%s' "${live}" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).commit  || ""' 2>/dev/null || true)"
    if [[ -n "${live_ver}" ]] && ! node "${SCRIPT_DIR}/scheduler/semver-gte.mjs" "${local_ver}" "${live_ver}"; then
        echo "${LOG} ✗ regression: would ship v${local_ver} over the live v${live_ver}." >&2
        echo "${LOG}   Bump package.json (npm version …), or set GEOFFERY_FORCE_DEPLOY=1 for an intentional rollback." >&2
        exit 1
    fi
    if [[ -n "${live_commit}" && "${live_commit}" != "unknown" ]] && git cat-file -e "${live_commit}^{commit}" 2>/dev/null; then
        if ! git merge-base --is-ancestor "${live_commit}" HEAD 2>/dev/null; then
            echo "${LOG} ✗ regression: prod's live commit ${live_commit} is not in this checkout's history — prod is ahead of you." >&2
            echo "${LOG}   Pull/rebase onto the deployed commit, or set GEOFFERY_FORCE_DEPLOY=1 to override." >&2
            exit 1
        fi
    fi
    echo "${LOG} ✓ regression guard ok: v${local_ver} ≥ live v${live_ver:-none}; HEAD contains the live commit"
}

deploy_worker() { # <worker>
    local w="$1"
    echo "${LOG} ▶ deploy worker: ${w}"
    "${WRANGLER[@]}" deploy --config "${WRANGLER_DIR}/${w}.toml" --env "${WR_ENV}"
}

deploy_workers() {
    for w in "${WORKERS[@]}"; do deploy_worker "${w}"; done
}

deploy_site() {
    guard_no_regression
    echo "${LOG} ▶ build site (v${GEOFFERY_APP_VERSION} · ${GEOFFERY_BUILD_VERSION})"
    ensure_site_deps
    npm --workspace site run build
    echo "${LOG} ▶ deploy Pages site → ${SITE_URL}"
    "${WRANGLER[@]}" pages deploy "${REPO_ROOT}/site/dist" \
        --project-name "geoffery-${TARGET}" --branch "${TARGET}"
}

# Republish the live site from a snapshot of the remote D1: pull the DB → generate the
# site JSON → build + deploy. This is how fresh prices AND committed code reach the static
# site (the site reads build-time JSON, so it only changes on a rebuild). CI runs this on
# push-to-main and on an hourly schedule; it is equally runnable by hand. The export reads
# a local node:sqlite file, so we first pull the remote DB into a snapshot (D1 holds the
# ~30-day hot window the sparklines + aggregates need).
publish() {
    echo "${LOG} ▶ publish: refresh data from remote D1, then build + deploy the site"
    ensure_site_deps
    refresh_data_from_remote
    deploy_site
}

refresh_data_from_remote() {
    local db="geoffery-${TARGET}"
    local work="${TMPDIR:-/tmp}/geoffery-publish-${TARGET}"
    local dump="${work}/d1-dump.sql"
    local snapshot="${work}/geoffery.db"
    rm -rf "${work}"; mkdir -p "${work}"
    echo "${LOG} ▶ export remote D1 '${db}' → SQL dump"
    "${WRANGLER[@]}" d1 export "${db}" --remote --output "${dump}"
    echo "${LOG} ▶ load dump → local snapshot (${snapshot})"
    node "${SCRIPT_DIR}/scheduler/load-d1-dump.mjs" "${dump}" "${snapshot}"
    echo "${LOG} ▶ recompute aggregates from the snapshot (a stale prod aggregates table can't blank the site)"
    GEOFFERY_DB="${snapshot}" npm run aggregate
    echo "${LOG} ▶ generate site JSON from the snapshot"
    GEOFFERY_DB="${snapshot}" npm run export
    guard_thin_data
}

# Refuse to ship a thin build: the generated aggregates must cover a real chunk of the catalogue
# with live prices. Stops a freshly-provisioned / half-populated D1 (no history) from blanking
# the live site. Override an intentional first publish with GEOFFERY_FORCE_DEPLOY=1.
guard_thin_data() {
    [[ "${GEOFFERY_FORCE_DEPLOY:-}" == "1" ]] && { echo "${LOG} ⚠ GEOFFERY_FORCE_DEPLOY=1 — skipping the thin-data guard"; return 0; }
    local min="${GEOFFERY_MIN_PRICED_ITEMS:-1000}" priced
    priced="$(node -e 'const a=require(process.argv[1]);let n=0;for(const k in a)if(a[k]&&a[k].currentPrice!=null)n++;console.log(n)' "${REPO_ROOT}/site/src/generated/aggregates.json" 2>/dev/null || echo 0)"
    if [[ "${priced}" -lt "${min}" ]]; then
        echo "${LOG} ✗ thin data: only ${priced} items have a live price (need ≥ ${min})." >&2
        echo "${LOG}   The DB likely lacks history — run 'ops/run.sh ${TARGET} backfill-history' first," >&2
        echo "${LOG}   or set GEOFFERY_FORCE_DEPLOY=1 to publish anyway." >&2
        exit 1
    fi
    echo "${LOG} ✓ data guard: ${priced} items priced (≥ ${min})"
}

# One-time history backfill (a fresh D1 has no 30-day history). Fetch the OSRS Wiki per-item 6h
# timeseries → a SQL file → import into the remote D1 (upsert). Coarse points are enough for the
# 30-day gauge/sparklines; the live 5m collector supersedes them over ~30 days. See
# workers/collector/src/backfill-timeseries.node.ts.
backfill_history() {
    local db="geoffery-${TARGET}" out="${TMPDIR:-/tmp}/geoffery-backfill-${TARGET}.sql"
    ensure_site_deps
    echo "${LOG} ▶ fetch wiki timeseries → ${out} (~4,600 gentle wiki calls; a few minutes)"
    GEOFFERY_BACKFILL_OUT="${out}" npm run backfill:history
    echo "${LOG} ▶ import → D1 '${db}' (upsert)"
    "${WRANGLER[@]}" d1 import "${db}" --remote --file "${out}"
}

# Apply the D1 schema to the remote DB. The SQL is generated from the SCHEMA const
# in packages/data/src/schema.ts (PRAGMAs stripped — D1 manages those itself) by
# ops/gen-d1-schema.mjs; no committed .sql artifact, so it can never drift. Idempotent:
# the schema is all CREATE … IF NOT EXISTS, so re-running is a no-op.
provision_schema() {
    local db="geoffery-${TARGET}"
    local sql="${TMPDIR:-/tmp}/geoffery-schema-${TARGET}.sql"
    node "${SCRIPT_DIR}/gen-d1-schema.mjs" "${sql}"
    echo "${LOG} ▶ apply schema → D1 '${db}' (--remote, idempotent)"
    "${WRANGLER[@]}" d1 execute "${db}" --remote --file "${sql}" --yes
}

# Read-only provisioning diagnostic: report each prerequisite + the exact fix for the
# account-level gates that otherwise surface only as cryptic API errors (see
# docs/CLOUDFLARE-SETUP.md). Makes the setup interrogable by a human or a future agent.
deploy_doctor() {
    local db="geoffery-${TARGET}" bucket="geoffery-archive-${TARGET}" cnt
    echo "${LOG} ▶ doctor: ${TARGET} (read-only)"
    if "${WRANGLER[@]}" whoami >/dev/null 2>&1; then
        echo "  ✓ wrangler authenticated"
    else
        echo "  ✗ wrangler NOT authenticated → run: npx wrangler login"
    fi
    [[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]] && echo "  ✓ CLOUDFLARE_ACCOUNT_ID set" \
        || echo "  ✗ CLOUDFLARE_ACCOUNT_ID missing → fill ${ENV_FILE}"
    [[ -n "${GEOFFERY_ZONE:-}" ]] && echo "  ✓ GEOFFERY_ZONE=${GEOFFERY_ZONE}" \
        || echo "  ✗ GEOFFERY_ZONE missing → fill ${ENV_FILE}"
    if "${WRANGLER[@]}" r2 bucket list >/dev/null 2>&1; then
        echo "  ✓ R2 enabled on account"
        if "${WRANGLER[@]}" r2 bucket list 2>/dev/null | grep -q "${bucket}"; then
            echo "  ✓ R2 bucket '${bucket}' exists"
        else
            echo "  ✗ R2 bucket '${bucket}' missing → run: wrangler r2 bucket create ${bucket}"
        fi
    else
        echo "  ✗ R2 not enabled (API 10042) → enable R2 in the Cloudflare dashboard → R2"
    fi
    cnt="$("${WRANGLER[@]}" d1 execute "${db}" --remote --json \
        --command "SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'" 2>/dev/null \
        | grep -oE '"n": *[0-9]+' | grep -oE '[0-9]+' | head -1 || true)"
    if [[ -z "${cnt}" ]]; then
        echo "  ✗ D1 '${db}' not reachable/created → run: wrangler d1 create ${db}"
        echo "      then paste the database_id over REPLACE_WITH_$(echo "${TARGET}" | tr a-z A-Z)_D1_ID in ops/wrangler/*.toml"
    elif [[ "${cnt}" -ge 11 ]]; then
        echo "  ✓ D1 '${db}' schema applied (${cnt} tables)"
    else
        echo "  ✗ D1 '${db}' has only ${cnt} tables → run: ops/run.sh ${TARGET} provision-schema"
    fi
    if command -v dig >/dev/null 2>&1 && [[ -n "${GEOFFERY_ZONE:-}" ]]; then
        if dig +short NS "${GEOFFERY_ZONE}" @1.1.1.1 2>/dev/null | grep -qi cloudflare; then
            echo "  ✓ DNS: ${GEOFFERY_ZONE} delegated to Cloudflare"
        else
            echo "  – DNS: ${GEOFFERY_ZONE} not yet on Cloudflare NS (registrar/propagation) — does NOT block provisioning"
        fi
    fi
    echo "  – workers.dev subdomain: checked at deploy time; if a deploy fails with API 10063,"
    echo "      open Workers & Pages in the dashboard once to auto-create it"
}

run_deploy() {
    local cmd="${1:-deploy}"; shift || true
    case "${cmd}" in
        deploy)         preflight_deploy; deploy_workers; deploy_site ;;
        deploy-workers) preflight_deploy; deploy_workers ;;
        deploy-site)    preflight_deploy; deploy_site ;;
        publish)        preflight_deploy; publish ;;
        backfill-history) preflight_deploy; backfill_history ;;
        provision-schema) preflight_deploy; provision_schema ;;
        doctor)         deploy_doctor ;;
        dry-run)
            preflight_deploy
            for w in "${WORKERS[@]}"; do
                echo "${LOG} ▶ dry-run: ${w}"
                "${WRANGLER[@]}" deploy --dry-run --config "${WRANGLER_DIR}/${w}.toml" --env "${WR_ENV}"
            done ;;
        tail)
            local w="${1:-consult}"
            exec "${WRANGLER[@]}" tail --config "${WRANGLER_DIR}/${w}.toml" --env "${WR_ENV}" ;;
        secret)
            local name="${1:-}" w="${2:-consult}"
            if [[ -z "${name}" ]]; then
                echo "${LOG} usage: ops/run.sh ${TARGET} secret <NAME> [worker]" >&2; exit 2
            fi
            # wrangler reads the value from its own prompt/stdin; we pass only the
            # NAME. The secret is never an argument here and never printed.
            echo "${LOG} setting secret '${name}' on worker '${w}' (wrangler will prompt; value not shown)" >&2
            exec "${WRANGLER[@]}" secret put "${name}" --config "${WRANGLER_DIR}/${w}.toml" --env "${WR_ENV}" ;;
        *) echo "${LOG} unknown ${TARGET} command: ${cmd}" >&2; usage ;;
    esac
}

# ── dispatch ────────────────────────────────────────────────────────────────
if [[ "${PUBLIC}" == "0" ]]; then
    run_localhost "$@"
else
    run_deploy "$@"
fi
