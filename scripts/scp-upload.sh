#!/usr/bin/env bash
# Pack this repo (no node_modules / .next / .env) and SCP it to /tmp on the server.
# Usage (from repo root):
#   DEPLOY_HOST=your.server.ip DEPLOY_USER=ubuntu ./scripts/scp-upload.sh
set -euo pipefail

: "${DEPLOY_HOST:?Set DEPLOY_HOST}"
: "${DEPLOY_USER:?Set DEPLOY_USER}"
REMOTE_TMP="${REMOTE_TMP:-/tmp/rab-mess-frontend}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAR="${TMPDIR:-/tmp}/rab-mess-frontend.tgz"

echo "Packing $REPO_ROOT -> $TAR"
rm -f "$TAR"
tar -C "$REPO_ROOT" -czf "$TAR" \
  --exclude=.git \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.env \
  --exclude=.env.local \
  --exclude=backups \
  --exclude='*.tgz' \
  .

SCP_OPTS=()
SSH_OPTS=()
if [ -n "${DEPLOY_KEY:-}" ]; then
  SCP_OPTS+=(-i "$DEPLOY_KEY")
  SSH_OPTS+=(-i "$DEPLOY_KEY")
fi

echo "Uploading to ${DEPLOY_USER}@${DEPLOY_HOST}:/tmp/rab-mess-frontend.tgz"
scp "${SCP_OPTS[@]}" "$TAR" "${DEPLOY_USER}@${DEPLOY_HOST}:/tmp/rab-mess-frontend.tgz"

ssh "${SSH_OPTS[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" "set -euo pipefail
  rm -rf '$REMOTE_TMP'
  mkdir -p '$REMOTE_TMP'
  tar -xzf /tmp/rab-mess-frontend.tgz -C '$REMOTE_TMP'
  chmod +x '$REMOTE_TMP'/scripts/*.sh
  echo Extracted to $REMOTE_TMP
  ls '$REMOTE_TMP'/package.json '$REMOTE_TMP'/docker-compose.yml
"

echo "Upload ready. On the server run:"
echo "  bash $REMOTE_TMP/scripts/inspect-server-ports.sh"
echo "  sudo bash $REMOTE_TMP/scripts/server-deploy.sh"
