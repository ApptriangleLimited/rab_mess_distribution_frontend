#!/usr/bin/env bash
# Run on the server. Shows ports this mess stack already uses
# and what else is listening so a new deploy does not steal them.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/mess/frontend}"

echo "========================================"
echo "This app (srb_* / rab-mess) — keep these ports"
echo "========================================"
docker ps --filter name=srb_ --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}' || true
echo
if [ -f "$APP_DIR/.env" ]; then
  echo "Port overrides in $APP_DIR/.env:"
  grep -E '^(WEB_PORT|API_PORT|HTTP_PORT|HTTPS_PORT)=' "$APP_DIR/.env" || true
else
  echo "No $APP_DIR/.env yet. Prod overlay defaults: nginx ${HTTP_PORT:-80}/${HTTPS_PORT:-443}; web/api stay internal."
fi

echo
echo "========================================"
echo "Everything listening on common web/API ports"
echo "(other projects on this host)"
echo "========================================"
if command -v ss >/dev/null 2>&1; then
  ss -lntp | grep -E ':80 |:443 |:3000 |:3001 |:8000 |:8001 |:8080 |:8443 ' || true
else
  netstat -lntp 2>/dev/null | grep -E ':80 |:443 |:3000 |:8000 ' || true
fi

echo
echo "All docker published ports:"
docker ps --format 'table {{.Names}}\t{{.Ports}}' || true
