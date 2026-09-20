#!/usr/bin/env bash
# Run on the server AFTER the tarball is extracted to /tmp/rab-mess-frontend.
# Moves files into the live project dir, keeps the host .env (and its ports),
# then rebuilds the same docker compose stack as GitHub Actions.
set -euo pipefail

REMOTE_TMP="${REMOTE_TMP:-/tmp/rab-mess-frontend}"
REMOTE_APP="${REMOTE_APP:-/var/www/mess/frontend}"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

if [ ! -f "$REMOTE_TMP/package.json" ] || [ ! -f "$REMOTE_TMP/docker-compose.yml" ]; then
  echo "FATAL: upload missing at $REMOTE_TMP. SCP the tarball and extract first." >&2
  exit 1
fi

echo "========================================"
echo "Ports already used by the older mess stack (will keep)"
echo "========================================"
docker ps --filter name=srb_ --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}' || true
if [ -f "$REMOTE_APP/.env" ]; then
  echo
  echo "Existing $REMOTE_APP/.env port lines:"
  grep -E '^(WEB_PORT|API_PORT|HTTP_PORT|HTTPS_PORT)=' "$REMOTE_APP/.env" || echo "(none — prod uses nginx 80/443)"
fi
echo
echo "Other listeners (do not steal these):"
if command -v ss >/dev/null 2>&1; then
  ss -lntp | grep -E ':80 |:443 |:3000 |:8000 ' || true
fi

mkdir -p "$REMOTE_APP"
ENV_FILE="$REMOTE_APP/.env"
ENV_BACKUP="/tmp/rab-mess-frontend.env.bak"
if [ -f "$ENV_FILE" ]; then
  cp -a "$ENV_FILE" "$ENV_BACKUP"
  echo "Preserved server .env -> $ENV_BACKUP"
else
  echo "FATAL: $ENV_FILE is missing. Copy env.docker.example to that path and set secrets first." >&2
  exit 1
fi

echo "Moving $REMOTE_TMP -> $REMOTE_APP (keeping .env)"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete \
    --exclude '.env' \
    --exclude '.git/' \
    --exclude 'node_modules/' \
    --exclude '.next/' \
    --exclude 'backups/' \
    "$REMOTE_TMP"/ "$REMOTE_APP"/
else
  find "$REMOTE_APP" -mindepth 1 \
    ! -name '.env' \
    ! -name '.git' \
    ! -path "$REMOTE_APP/.git/*" \
    ! -name 'backups' \
    ! -path "$REMOTE_APP/backups/*" \
    -exec rm -rf {} + 2>/dev/null || true
  cp -a "$REMOTE_TMP"/. "$REMOTE_APP"/
fi

if [ -f "$ENV_BACKUP" ]; then
  cp -a "$ENV_BACKUP" "$ENV_FILE"
  echo "Restored server .env (ports and secrets unchanged)"
fi

cd "$REMOTE_APP"
test -f package.json
test -f Dockerfile
test -f docker-compose.yml
test -f docker-compose.prod.yml

# Do not source .env — passwords with $ would expand.
unset POSTGRES_PASSWORD REDIS_PASSWORD DATABASE_URL REDIS_URL JWT_SECRET APP_SECRET
export NEXT_PUBLIC_API_URL=
export NEXT_PUBLIC_API_BASE_URL=
export API_PROXY_URL=http://api:8000
export GIT_SHA="${GIT_SHA:-scp-$(date +%Y%m%d%H%M%S)}"

echo "Validating compose..."
$COMPOSE config >/dev/null

echo "Building web + api (Postgres/Redis stay up)..."
$COMPOSE build web api
$COMPOSE up -d postgres redis

if [ -f deploy/sync-postgres-password.py ]; then
  python3 deploy/sync-postgres-password.py --env-file "$ENV_FILE" \
    --compose-file docker-compose.yml --compose-file docker-compose.prod.yml || true
fi

echo "Recreating API..."
$COMPOSE up -d --no-deps --force-recreate --remove-orphans api
live_ok=0
for i in $(seq 1 24); do
  if $COMPOSE exec -T api python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health/live')" \
    >/dev/null 2>&1; then
    live_ok=1
    break
  fi
  echo "API not live yet (${i}/24)..."
  sleep 5
done

echo "Recreating worker, web, nginx..."
$COMPOSE up -d --no-deps --force-recreate --remove-orphans worker web nginx

if [ "$live_ok" != 1 ]; then
  echo "FATAL: API did not become live. Last logs:" >&2
  $COMPOSE logs --tail=80 api >&2
  exit 1
fi

$COMPOSE run --rm api alembic upgrade head
$COMPOSE exec -T api python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health/ready')"

echo "========================================"
echo "Deploy finished. Live ports:"
echo "========================================"
docker ps --filter name=srb_ --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
$COMPOSE ps
