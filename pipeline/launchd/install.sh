#!/usr/bin/env bash
# Install the three launchd jobs (collect every 5m, aggregates+export hourly,
# news hourly) into ~/Library/LaunchAgents for one deployment.
#
# Usage:
#   pipeline/launchd/install.sh <local|qa|prod>
#
# qa and prod jobs are namespaced (com.geoffery.qa.* / com.geoffery.prod.*)
# so they coexist on a single host (matching dexter-dev's "qa and prod run
# side-by-side: different ports, different DB paths" posture).

set -euo pipefail

ENV_NAME="${1:-}"
case "${ENV_NAME}" in
  local|qa|prod) ;;
  *) echo "usage: $0 <local|qa|prod>" >&2; exit 2 ;;
esac

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TARGET_DIR="$HOME/Library/LaunchAgents"
mkdir -p "$TARGET_DIR" "$REPO_ROOT/data/log"

for base in com.geoffery.collect com.geoffery.aggregates com.geoffery.news; do
  label="${base/com.geoffery./com.geoffery.${ENV_NAME}.}"
  src="$REPO_ROOT/pipeline/launchd/${base}.plist"
  dest="$TARGET_DIR/${label}.plist"
  sed -e "s|REPLACE_WITH_REPO_ROOT|$REPO_ROOT|g" \
      -e "s|REPLACE_WITH_ENV|${ENV_NAME}|g" \
      "$src" > "$dest"
  launchctl unload "$dest" 2>/dev/null || true
  launchctl load "$dest"
  echo "loaded $dest"
done

echo
echo "Verify with: launchctl list | grep com.geoffery.${ENV_NAME}"
echo "Tail logs:   tail -F $REPO_ROOT/data/log/${ENV_NAME}.*.log"
