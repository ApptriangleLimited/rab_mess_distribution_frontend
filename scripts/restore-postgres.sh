#!/usr/bin/env bash
set -euo pipefail
FILE="${1:-}"
if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "Usage: $0 backups/rab_mess_YYYYMMDD_HHMMSS.sql.gz" >&2
  exit 1
fi
gunzip -c "$FILE" | docker exec -i rab-mess-postgres psql -U mess -d rab_mess
echo "Restored $FILE"
