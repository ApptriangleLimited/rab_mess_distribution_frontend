#!/bin/sh
# Daily custom-format dump. Keep 28 days (4 weeks).
set -eu
DIR="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-28}"
PGHOST="${PGHOST:-db}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-mess}"
PGDATABASE="${PGDATABASE:-mess}"
mkdir -p "$DIR"

dump_once() {
  stamp=$(date +%Y%m%d)
  marker="$DIR/.did-$stamp"
  if [ -f "$marker" ]; then
    return 0
  fi
  file="$DIR/mess-$stamp.dump"
  pg_dump -Fc -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -f "$file"
  touch "$marker"
  find "$DIR" -name 'mess-*.dump' -mtime +"$KEEP_DAYS" -delete
  find "$DIR" -name '.did-*' -mtime +"$KEEP_DAYS" -delete
  echo "wrote $file"
}

if [ "${1:-}" = "--loop" ]; then
  while true; do
    hour=$(date +%H)
    if [ "$hour" = "02" ]; then
      dump_once || true
    fi
    sleep 600
  done
fi

dump_once
