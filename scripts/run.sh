#!/usr/bin/env bash
# scripts/run.sh — single launcher for Geoffery.
#
# Dispatches by deployment env. `local`, `qa`, and `prod` follow the same
# code path; the env file sourced + the GEOFFERY_DEPLOYMENT_NAME label
# are the only differences ("works in qa ⇒ works in prod" fidelity).
#
# Usage:
#   scripts/run.sh <env> [cmd] [args...]
#
#   <env>   local | localhost | qa | prod
#           ("localhost" is an alias for "local" — accepts the colloquial
#            form per dexter-dev §P11. Internally we always call it "local".)
#   <cmd>   (default: serve)
#           serve         — rebuild dist/ if stale (qa/prod) and start a
#                           local server. localhost runs `astro dev` (HMR).
#           collect       — one-shot price ingestion
#           aggregates    — recompute gauges
#           news          — poll news RSS
#           backfill      — fetch historical /5m buckets from the wiki
#                           (use `--days N` to control horizon; resumable)
#           scorer        — evaluate pending consultations against 5m data
#           backtest      — cold-start: replay engine across history,
#                           seed calibration with synthetic fill rates
#           export        — write JSON snapshots for the frontend
#           cron          — collect + aggregates + news + export, in order
#           build         — astro build (uses GEOFFERY_SITE_URL)
#           rebuild       — force a fresh build, ignore the stamp
#           dev           — astro dev (local only)
#           preview       — astro preview (no auto-rebuild — use `serve`)
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
#   `serve` runs      | astro dev (HMR)  | preview on dist | preview on dist
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
    sed -n '2,46p' "$0" >&2
    exit "${1:-2}"
}

ENV_INPUT="${1:-}"
shift || true
CMD="${1:-serve}"
shift || true

case "${ENV_INPUT}" in
    local|localhost) ENV_NAME="local"; ENV_FILE=".env" ;;
    qa)              ENV_NAME="qa";    ENV_FILE=".env.qa" ;;
    prod)            ENV_NAME="prod";  ENV_FILE=".env.prod" ;;
    -h|--help|"")    usage 0 ;;
    *)
        echo "unknown env: ${ENV_INPUT}" >&2
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

run_pipeline() {
    cd "${REPO_ROOT}/pipeline"
    uv run python -m "geoffery_pipeline.$1"
}

# Track what produced dist/ — env label + build version + epoch. Used by
# `serve` to decide whether a rebuild is warranted. A stale stamp (env
# mismatch, version mismatch, or any source file newer than the stamp)
# triggers a rebuild before previewing.
STAMP="${REPO_ROOT}/web/dist/.build-stamp"

stamp_write() {
    mkdir -p "$(dirname "${STAMP}")"
    printf 'env=%s\nversion=%s\nbuilt_at=%s\n' \
        "${ENV_NAME}" "${GEOFFERY_BUILD_VERSION}" "$(date +%s)" > "${STAMP}"
}

# Returns 0 (true) if dist/ is missing, stamp is missing, env doesn't match,
# version doesn't match, or any source file is newer than the stamp.
needs_rebuild() {
    local dist="${REPO_ROOT}/web/dist"
    if [[ ! -d "${dist}" || ! -f "${STAMP}" ]]; then
        return 0
    fi
    local stamped_env stamped_version
    stamped_env=$(sed -n 's/^env=//p' "${STAMP}")
    stamped_version=$(sed -n 's/^version=//p' "${STAMP}")
    if [[ "${stamped_env}" != "${ENV_NAME}" ]]; then
        echo "rebuild: stamp env=${stamped_env}, requested=${ENV_NAME}" >&2
        return 0
    fi
    if [[ "${stamped_version}" != "${GEOFFERY_BUILD_VERSION}" ]]; then
        echo "rebuild: stamp version=${stamped_version}, current=${GEOFFERY_BUILD_VERSION}" >&2
        return 0
    fi
    # Any source file newer than the stamp? Watch web/src, web/public,
    # web/astro.config.mjs, web/package.json, web/tsconfig.json, plus the
    # generated content snapshots the build reads from the pipeline.
    local newer
    newer=$(find \
        "${REPO_ROOT}/web/src" \
        "${REPO_ROOT}/web/public" \
        "${REPO_ROOT}/web/astro.config.mjs" \
        "${REPO_ROOT}/web/package.json" \
        "${REPO_ROOT}/web/tsconfig.json" \
        -type f -newer "${STAMP}" 2>/dev/null | head -1)
    if [[ -n "${newer}" ]]; then
        echo "rebuild: source newer than stamp: ${newer#"${REPO_ROOT}/"}" >&2
        return 0
    fi
    return 1
}

build_now() {
    cd "${REPO_ROOT}/web"
    if [[ ! -d node_modules ]]; then
        echo "installing web/ deps (one-time)…" >&2
        npm install --silent
    fi
    echo "building (${ENV_NAME}, ${GEOFFERY_BUILD_VERSION})…" >&2
    npm run build
    stamp_write
}

case "${CMD}" in
    collect)    run_pipeline collect ;;
    aggregates) run_pipeline aggregates ;;
    news)       run_pipeline news_poller ;;
    backfill)
        cd "${REPO_ROOT}/pipeline"
        uv run python -m geoffery_pipeline.backfill "$@"
        ;;
    scorer)
        run_pipeline scorer
        ;;
    wiki-news)
        run_pipeline wiki_news
        ;;
    news-classifier)
        run_pipeline news_classifier
        ;;
    backtest)
        cd "${REPO_ROOT}/pipeline"
        uv run python -m geoffery_pipeline.backtest "$@"
        ;;
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
        build_now
        ;;
    rebuild)
        rm -f "${STAMP}"
        build_now
        ;;
    dev)
        if [[ "${ENV_NAME}" != "local" ]]; then
            echo "astro dev refused outside local." >&2; exit 2
        fi
        cd "${REPO_ROOT}/web"
        [[ -d node_modules ]] || npm install --silent
        npm run dev
        ;;
    preview)
        cd "${REPO_ROOT}/web"
        npx astro preview --port "${GEOFFERY_PREVIEW_PORT:-4321}"
        ;;
    serve)
        # localhost uses astro dev: HMR, no build artifact, dev posture.
        # qa/prod serve the static dist/, rebuilt if stale, via preview.
        if [[ "${ENV_NAME}" == "local" ]]; then
            cd "${REPO_ROOT}/web"
            [[ -d node_modules ]] || npm install --silent
            echo "serving localhost (astro dev, HMR)…" >&2
            exec npm run dev -- --port "${GEOFFERY_PREVIEW_PORT:-4321}"
        fi
        if needs_rebuild; then
            build_now
        else
            echo "dist/ is fresh for ${ENV_NAME} (version ${GEOFFERY_BUILD_VERSION}); skipping build" >&2
        fi
        cd "${REPO_ROOT}/web"
        echo "serving ${ENV_NAME} on http://127.0.0.1:${GEOFFERY_PREVIEW_PORT:-4321}" >&2
        exec npx astro preview --port "${GEOFFERY_PREVIEW_PORT:-4321}"
        ;;
    sh)
        exec "${SHELL:-/bin/sh}"
        ;;
    *)
        echo "unknown command: ${CMD}" >&2
        usage
        ;;
esac
