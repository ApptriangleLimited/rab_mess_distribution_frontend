#!/bin/sh
# Restore a custom-format dump. Usage: pg_restore.sh /backups/mess-YYYYMMDD.dump
set -eu
FILE="${1:-}"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "usage: $0 /backups/mess-YYYYMMDD.dump" >&2
  exit 1
fi
PGHOST="${PGHOST:-db}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-mess}"
PGDATABASE="${PGDATABASE:-mess}"
pg_restore --clean --if-exists --no-owner -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" "$FILE"
echo "restored $FILE"
