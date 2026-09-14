#!/usr/bin/env bash
set -euo pipefail
DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$DIR"
STAMP="$(date -u +%Y%m%d_%H%M%S)"
FILE="$DIR/rab_mess_${STAMP}.sql.gz"
docker exec rab-mess-postgres pg_dump -U mess rab_mess | gzip > "$FILE"
echo "Wrote $FILE"
# Keep last 14 files
ls -1t "$DIR"/rab_mess_*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm --
