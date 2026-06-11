#!/usr/bin/env bash
# scripts/run.sh — single launcher for Geoffery.
#
# Dispatches by deployment env. `local`, `qa`, and `prod` follow the same
# code path; the env file sourced + the GEOFFERY_DEPLOYMENT_NAME label
# are the only differences ("works in qa ⇒ works in prod" fidelity).
#
# Usage:
#   scripts/run.sh <env> <cmd> [args...]
#
#   <env>   local | qa | prod
#   <cmd>   collect       — one-shot price ingestion
#           aggregates    — recompute gauges
#           news          — poll news RSS
#           export        — write JSON snapshots for the frontend
#           cron          — collect + aggregates + news + export, in order
#           build         — astro build (uses GEOFFERY_SITE_URL)
#           dev           — astro dev (local only)
#           preview       — astro preview
#           sh            — drop into a shell with env loaded
#
# Per-env behavior matrix:
#
#   axis              | local            | qa              | prod
#   ------------------+------------------+-----------------+---------------
#   env file sourced  | .env             | .env.qa         | .env.prod
#   DEPLOYMENT_NAME   | local            | qa              | prod
#   SITE_URL default  | http://127.0.0.1 | qa subdomain    | geoffery.gg
#   robots policy     | noindex          | noindex+deny    | indexed
#   tip jar           | disabled         | disabled        | live links
#   public access     | localhost only   | CF Access gated | public
#
# qa is hidden from the public via Cloudflare Access (Zero Trust) gating
# the entire zone to an email allowlist. The robots noindex + robots.txt
# deny-all on qa are belt-and-suspenders for the rare crawler that gets
# past Access via a misconfigured rule.
#
# This script never echoes secret values to stdout — only their names.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

usage() {
    sed -n '2,32p' "$0" >&2
    exit "${1:-2}"
}

ENV_NAME="${1:-}"
shift || true
CMD="${1:-}"
shift || true

case "${ENV_NAME}" in
    local) ENV_FILE=".env" ;;
    qa)    ENV_FILE=".env.qa" ;;
    prod)  ENV_FILE=".env.prod" ;;
    -h|--help|"") usage 0 ;;
    *)
        echo "unknown env: ${ENV_NAME}" >&2
        usage
        ;;
esac

if [[ ! -f "${ENV_FILE}" ]]; then
    echo "env file ${ENV_FILE} not found." >&2
    echo "copy from env/.env.${ENV_NAME}.example and fill it in." >&2
    exit 2
fi

# Source the env file. `set -a` exports everything we read.
set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

# Resolve a relative GEOFFERY_DB against repo root so cd-ing into pipeline/
# below doesn't repoint at pipeline/data/. Absolute paths pass through.
if [[ -n "${GEOFFERY_DB:-}" && "${GEOFFERY_DB}" != /* ]]; then
    export GEOFFERY_DB="${REPO_ROOT}/${GEOFFERY_DB#./}"
fi

# Per-deploy cache-bust token for static assets (borrowed from dexter-dev).
# The Astro build threads this into the asset query strings so each commit
# ships a fresh URL — Cloudflare + browser caches both miss for new commits.
if BUILD_SHA="$(git rev-parse --short HEAD 2>/dev/null)" && [[ -n "${BUILD_SHA}" ]]; then
    export GEOFFERY_BUILD_VERSION="${BUILD_SHA}"
else
    export GEOFFERY_BUILD_VERSION="${ENV_NAME}-$(date +%s)"
fi

if [[ -z "${CMD}" ]]; then
    echo "no command. try: scripts/run.sh ${ENV_NAME} {collect|aggregates|news|export|cron|build|dev|preview|sh}" >&2
    exit 2
fi

run_pipeline() {
    cd "${REPO_ROOT}/pipeline"
    uv run python -m "geoffery_pipeline.$1"
}

case "${CMD}" in
    collect)    run_pipeline collect ;;
    aggregates) run_pipeline aggregates ;;
    news)       run_pipeline news_poller ;;
    export)
        cd "${REPO_ROOT}/pipeline"
        uv run python -m geoffery_pipeline.export "${REPO_ROOT}/web/src/content/generated"
        ;;
    cron)
        cd "${REPO_ROOT}/pipeline"
        uv run python -m geoffery_pipeline.collect
        uv run python -m geoffery_pipeline.aggregates
        uv run python -m geoffery_pipeline.news_poller
        uv run python -m geoffery_pipeline.export "${REPO_ROOT}/web/src/content/generated"
        ;;
    build)
        cd "${REPO_ROOT}/web"
        npm run build
        ;;
    dev)
        if [[ "${ENV_NAME}" != "local" ]]; then
            echo "astro dev refused outside local." >&2; exit 2
        fi
        cd "${REPO_ROOT}/web"
        npm run dev
        ;;
    preview)
        cd "${REPO_ROOT}/web"
        npx astro preview --port "${GEOFFERY_PREVIEW_PORT:-4321}"
        ;;
    sh)
        exec "${SHELL:-/bin/sh}"
        ;;
    *)
        echo "unknown command: ${CMD}" >&2
        usage
        ;;
esac
