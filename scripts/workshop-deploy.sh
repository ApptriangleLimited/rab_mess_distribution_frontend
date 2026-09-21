#!/usr/bin/env bash
# First install + deploy of rab-mess on the shared workshop VM.
# Docker only. Isolated folder and ports. Does not restart or reconfigure
# nginx, wms.service, or mealtracker.service.
set -euo pipefail

REMOTE_TMP="${REMOTE_TMP:-/tmp/rab-mess-frontend}"
REMOTE_APP="${REMOTE_APP:-/usr/share/nginx/html/projects/rab-mess}"
WEB_PORT="3010"
API_PORT="8000"
# Host ports owned by other apps — never publish these.
FORBIDDEN_PORTS="80 443 8888 3000 4000 5000 7000"

if [ ! -f "$REMOTE_TMP/package.json" ] && [ -f /tmp/rab-mess-frontend.tgz ]; then
  echo "Extracting /tmp/rab-mess-frontend.tgz -> $REMOTE_TMP"
  rm -rf "$REMOTE_TMP"
  mkdir -p "$REMOTE_TMP"
  tar -xzf /tmp/rab-mess-frontend.tgz -C "$REMOTE_TMP"
fi

if [ ! -f "$REMOTE_TMP/package.json" ] || [ ! -f "$REMOTE_TMP/docker-compose.yml" ]; then
  echo "FATAL: extract missing at $REMOTE_TMP (need /tmp/rab-mess-frontend.tgz)" >&2
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "FATAL: run as root" >&2
  exit 1
fi

echo "========================================"
echo "Workshop Docker deploy — isolated mess"
echo "  app dir : $REMOTE_APP"
echo "  web     : ${WEB_PORT}"
echo "  api     : ${API_PORT}"
echo "  will NOT bind: $FORBIDDEN_PORTS"
echo "========================================"

echo
echo "Other apps (must stay running):"
systemctl is-active nginx.service wms.service mealtracker.service || true
if command -v ss >/dev/null 2>&1; then
  ss -lntp | grep -E ':80 |:8888 |:3000 |:5000 |:7000 ' || true
fi

# --- Docker runtime (new package only; does not stop nginx) ---
if ! command -v docker >/dev/null 2>&1; then
  echo "Installing docker.io (will not replace host nginx)..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y docker.io docker-compose-v2
fi
if ! docker compose version >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y docker-compose-v2
fi
systemctl enable --now docker
docker --version
docker compose version

# --- Never publish forbidden ports ---
port_taken() {
  local p="$1"
  ss -lntp 2>/dev/null | grep -E ":${p} " >/dev/null 2>&1
}

our_docker_owns_port() {
  local p="$1"
  docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E '^srb_' | grep -E ":${p}->" >/dev/null 2>&1
}

for p in $FORBIDDEN_PORTS; do
  if [ "$p" = "$WEB_PORT" ] || [ "$p" = "$API_PORT" ]; then
    echo "FATAL: mess ports collided with forbidden list" >&2
    exit 1
  fi
done

for p in "$WEB_PORT" "$API_PORT"; do
  if port_taken "$p" && ! our_docker_owns_port "$p"; then
    echo "FATAL: host port $p is already in use by another process." >&2
    ss -lntp | grep -E ":${p} " || true
    exit 1
  fi
done

# --- Isolated project tree ---
mkdir -p "$REMOTE_APP"
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
fi

# Overlay must exist even if an older tarball omitted it.
cat > "$REMOTE_APP/docker-compose.workshop.yml" <<'YAML'
services:
  web:
    ports:
      - "3010:3000"
  api:
    ports:
      - "8000:8000"
YAML

# First boot only — never overwrite secrets on later deploys.
if [ ! -f "$REMOTE_APP/.env" ]; then
  SECRET="$(openssl rand -hex 32)"
  cat > "$REMOTE_APP/.env" <<EOF
WEB_PORT=${WEB_PORT}
API_PORT=${API_PORT}
APP_ENV=production
APP_SECRET=${SECRET}
JWT_SECRET=${SECRET}
POSTGRES_PASSWORD=$(openssl rand -hex 24)
REDIS_PASSWORD=$(openssl rand -hex 24)
SEED_STAFF=true
SEED_STAFF_PASSWORD=ChangeMe!
CORS_ORIGINS=http://103.22.96.22:3010,http://192.168.10.246:3010
PUBLIC_APP_URL=http://103.22.96.22:3010
NEXT_PUBLIC_USE_API=true
NEXT_PUBLIC_ZK_DEMO=false
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_API_BASE_URL=
API_PROXY_URL=http://api:8000
EOF
  chmod 600 "$REMOTE_APP/.env"
  echo "Created $REMOTE_APP/.env (WEB_PORT=${WEB_PORT} API_PORT=${API_PORT})"
else
  echo "Keeping existing $REMOTE_APP/.env"
fi

cd "$REMOTE_APP"
test -f package.json
test -f Dockerfile
test -f docker-compose.yml
test -f docker-compose.workshop.yml

# Hard rule: never start srb_proxy / host 80/443.
if [ -f docker-compose.prod.yml ]; then
  if grep -q 'srb_proxy' docker-compose.prod.yml; then
    echo "Skipping docker-compose.prod.yml (would bind 80/443)."
  fi
fi

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.workshop.yml"

published="$($COMPOSE config | awk '/published:/ {print $2}' | tr -d '"' || true)"
echo "Compose will publish host ports: ${published:-none}"
for p in $FORBIDDEN_PORTS; do
  if echo "$published" | grep -qx "$p"; then
    echo "FATAL: compose would publish forbidden port $p" >&2
    $COMPOSE config >&2
    exit 1
  fi
done

unset POSTGRES_PASSWORD REDIS_PASSWORD DATABASE_URL REDIS_URL JWT_SECRET APP_SECRET
export NEXT_PUBLIC_API_URL=
export NEXT_PUBLIC_API_BASE_URL=
export API_PROXY_URL=http://api:8000
export GIT_SHA="${GIT_SHA:-workshop-$(date +%Y%m%d%H%M%S)}"

echo "Building mess images (WMS / Meal Tracker keep running)..."
$COMPOSE build web api
$COMPOSE up -d postgres redis
$COMPOSE up -d --no-deps --force-recreate api worker web

live_ok=0
for i in $(seq 1 36); do
  if $COMPOSE exec -T api python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health/live')" \
    >/dev/null 2>&1; then
    live_ok=1
    break
  fi
  echo "API not live yet (${i}/36)..."
  sleep 5
done
if [ "$live_ok" != 1 ]; then
  echo "FATAL: mess API did not become live. Other apps were not restarted." >&2
  $COMPOSE logs --tail=80 api >&2
  exit 1
fi

$COMPOSE run --rm api alembic upgrade head
$COMPOSE exec -T api python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health/ready')"

echo
echo "========================================"
echo "Mess containers (srb_* only)"
echo "========================================"
docker ps --filter name=srb_ --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'

echo
echo "========================================"
echo "Other apps still listening (must remain)"
echo "========================================"
systemctl is-active nginx.service wms.service mealtracker.service || true
ss -lntp | grep -E ':80 |:8888 |:3000 |:5000 |:7000 |:3010 |:8000 ' || true

echo
curl -sS -o /dev/null -w 'mess web  :3010  %{http_code}\n' http://127.0.0.1:3010/ || true
curl -sS -o /dev/null -w 'mess api  :8000  %{http_code}\n' http://127.0.0.1:8000/health/ready || true
curl -sS -o /dev/null -w 'wms nginx :8888 %{http_code}\n' http://127.0.0.1:8888/ || true
curl -sS -o /dev/null -w 'host nginx:80   %{http_code}\n' http://127.0.0.1:80/ || true

echo
echo "Open http://103.22.96.22:3010"
echo "Login SRB-ADMIN / ChangeMe!"
echo "WMS unchanged at http://103.22.96.22:8888"
echo "Did not edit /etc/nginx and did not restart wms or mealtracker."
