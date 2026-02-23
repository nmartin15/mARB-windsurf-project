"""
Apply canonical Supabase schema migrations using DATABASE_URL.

Usage:
  python scripts/apply_canonical_migrations.py
  python scripts/apply_canonical_migrations.py --database-url-env DATABASE_URL
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from dotenv import load_dotenv
import psycopg


def _read_sql(path: Path) -> str:
    with path.open("r", encoding="utf-8") as fp:
        return fp.read()


def apply_migrations(database_url: str) -> None:
    repo_root = Path(__file__).resolve().parents[1]
    migration_paths = [
        repo_root / "supabase" / "migrations" / "00001_canonical_schema.sql",
        repo_root / "supabase" / "migrations" / "00002_rpc_functions.sql",
    ]
    missing = [str(path) for path in migration_paths if not path.exists()]
    if missing:
        raise RuntimeError(f"Missing migration files: {missing}")

    with psycopg.connect(database_url) as conn:
        conn.autocommit = False
        with conn.cursor() as cur:
            for path in migration_paths:
                sql = _read_sql(path)
                cur.execute(sql)
        conn.commit()


def main():
    parser = argparse.ArgumentParser(description="Apply canonical migrations with DATABASE_URL.")
    parser.add_argument(
        "--database-url-env",
        default="DATABASE_URL",
        help="Environment variable that contains PostgreSQL connection URL.",
    )
    args = parser.parse_args()

    load_dotenv()
    database_url = os.getenv(args.database_url_env)
    if not database_url:
        raise RuntimeError(
            f"{args.database_url_env} is not set. "
            "Set it to a postgres connection string with DDL privileges."
        )

    apply_migrations(database_url)
    print("Applied canonical migrations: 00001_canonical_schema.sql, 00002_rpc_functions.sql")


if __name__ == "__main__":
    main()
