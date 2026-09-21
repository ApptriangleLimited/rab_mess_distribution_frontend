#!/usr/bin/env bash
# Run on the server AFTER the tarball is extracted to /tmp/rab-mess-frontend.
# Keeps /var/www/mess/frontend/.env (WEB_PORT=3010, API_PORT=8000 on staging).
# Does NOT start srb_proxy on 80/443 — those belong to host nginx / other apps.
set -euo pipefail

REMOTE_TMP="${REMOTE_TMP:-/tmp/rab-mess-frontend}"
REMOTE_APP="${REMOTE_APP:-/var/www/mess/frontend}"

# Shared workshop VM already runs WMS + Meal Tracker + host nginx.
# Isolate mess in its own Docker stack; never bind 80/8888/3000.
if [ "${WORKSHOP:-}" = "1" ] || [ -d /usr/share/nginx/html/projects/wms ]; then
  echo "Detected workshop host. Using isolated Docker deploy (ports 3010/8000)."
  exec bash "$(cd "$(dirname "$0")" && pwd)/workshop-deploy.sh"
fi

if [ ! -f "$REMOTE_TMP/package.json" ] || [ ! -f "$REMOTE_TMP/docker-compose.yml" ]; then
  echo "FATAL: upload missing at $REMOTE_TMP. SCP the tarball and extract first." >&2
  exit 1
fi

echo "========================================"
echo "Older mess stack — keep these host ports"
echo "========================================"
docker ps --filter name=srb_ --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}' || true

ENV_FILE="$REMOTE_APP/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "FATAL: $ENV_FILE is missing." >&2
  exit 1
fi

echo
echo "Existing .env ports:"
grep -E '^(WEB_PORT|API_PORT|HTTP_PORT|HTTPS_PORT)=' "$ENV_FILE" || true

WEB_PORT_VAL="$(grep -E '^WEB_PORT=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"
API_PORT_VAL="$(grep -E '^API_PORT=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"
WEB_PORT_VAL="${WEB_PORT_VAL:-3010}"
API_PORT_VAL="${API_PORT_VAL:-8000}"

# Staging publishes web:3010 and api:8000. Prod overlay would bind nginx to 80/443
# which are already used by host nginx and other projects.
if docker ps --format '{{.Names}}' | grep -qx srb_proxy; then
  COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
  RECREATE_SERVICES="api worker web nginx"
  echo "Using prod overlay (srb_proxy already running)."
else
  COMPOSE="docker compose -f docker-compose.yml"
  RECREATE_SERVICES="api worker web"
  echo "Using docker-compose.yml only. Host map stays ${WEB_PORT_VAL}->3000 and ${API_PORT_VAL}->8000."
  echo "Will not bind 80/443/3000 (those are other apps on this server)."
fi

echo
echo "Other listeners (leave them alone):"
if command -v ss >/dev/null 2>&1; then
  ss -lntp | grep -E ':80 |:443 |:3000 |:3010 |:8000 ' || true
fi

ENV_BACKUP="/tmp/rab-mess-frontend.env.bak"
cp -a "$ENV_FILE" "$ENV_BACKUP"
echo "Preserved server .env -> $ENV_BACKUP"

echo "Moving $REMOTE_TMP -> $REMOTE_APP (keeping .env)"
if command -v rsync >/dev/null 2>&1; then
  rsync -a \
    --exclude '.env' \
    --exclude '.git/' \
    --exclude 'node_modules/' \
    --exclude '.next/' \
    --exclude 'backups/' \
    "$REMOTE_TMP"/ "$REMOTE_APP"/
else
  cp -a "$REMOTE_TMP"/. "$REMOTE_APP"/
  cp -a "$ENV_BACKUP" "$ENV_FILE"
fi
cp -a "$ENV_BACKUP" "$ENV_FILE"
echo "Restored server .env (WEB_PORT=${WEB_PORT_VAL} API_PORT=${API_PORT_VAL})"

cd "$REMOTE_APP"
test -f package.json
test -f Dockerfile
test -f docker-compose.yml

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
    --compose-file docker-compose.yml || true
fi

echo "Recreating API..."
$COMPOSE up -d --no-deps --force-recreate api
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

echo "Recreating: $RECREATE_SERVICES"
# shellcheck disable=SC2086
$COMPOSE up -d --no-deps --force-recreate $RECREATE_SERVICES

if [ "$live_ok" != 1 ]; then
  echo "FATAL: API did not become live. Last logs:" >&2
  $COMPOSE logs --tail=80 api >&2
  exit 1
fi

$COMPOSE run --rm api alembic upgrade head
$COMPOSE exec -T api python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health/ready')"

echo "========================================"
echo "Deploy finished. Expect srb_frontend :${WEB_PORT_VAL} and srb_backend :${API_PORT_VAL}"
echo "========================================"
docker ps --filter name=srb_ --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
$COMPOSE ps
