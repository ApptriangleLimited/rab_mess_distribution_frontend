#!/bin/sh
set -e
# Worker shares this image but should not migrate. A stale worker image
# dies with 255 when alembic_version is ahead of its copied revisions.
if [ "$1" != "python" ] || [ "$2" != "worker.py" ]; then
  alembic upgrade head
fi
exec "$@"
