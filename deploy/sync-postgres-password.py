#!/usr/bin/env python3
"""Align the existing Postgres role password with host .env. Does not wipe data."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def read_env_value(env_file: Path, key: str) -> str:
    value = ""
    for raw in env_file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, current = line.split("=", 1)
        if name.strip() != key:
            continue
        current = current.strip()
        if len(current) >= 2 and current[0] == current[-1] and current[0] in {"'", '"'}:
            current = current[1:-1]
        value = current
    return value


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", required=True)
    parser.add_argument(
        "--compose-file",
        action="append",
        default=[],
        help="Compose file (repeat). Do not pass raw `docker compose -f` — argparse treats -f as a flag.",
    )
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()

    env_file = Path(args.env_file)
    if not env_file.is_file():
        print(f"FATAL: missing {env_file}", file=sys.stderr)
        return 1

    password = read_env_value(env_file, "POSTGRES_PASSWORD")
    if not password:
        print("FATAL: .env must set POSTGRES_PASSWORD", file=sys.stderr)
        return 1
    redis_password = read_env_value(env_file, "REDIS_PASSWORD")
    if not redis_password:
        print("FATAL: .env must set REDIS_PASSWORD", file=sys.stderr)
        return 1
    if args.check_only:
        print("Host .env has POSTGRES_PASSWORD and REDIS_PASSWORD")
        return 0
    if not args.compose_file:
        print("FATAL: --compose-file is required unless --check-only", file=sys.stderr)
        return 1

    sql = f"ALTER USER mess WITH PASSWORD {sql_literal(password)};"
    compose = ["docker", "compose"]
    for compose_file in args.compose_file:
        compose.extend(["-f", compose_file])
    cmd = [
        *compose,
        "exec",
        "-T",
        "postgres",
        "psql",
        "-U",
        "mess",
        "-d",
        "rab_mess",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        sql,
    ]
    result = subprocess.run(cmd, check=False)
    if result.returncode != 0:
        print("FATAL: could not sync Postgres role password from .env", file=sys.stderr)
        return result.returncode
    print("Synced Postgres role password to host .env (data volume unchanged)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
