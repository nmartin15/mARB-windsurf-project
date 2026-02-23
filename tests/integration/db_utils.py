from __future__ import annotations

from pathlib import Path

import pytest

try:
    import psycopg
    from psycopg.rows import dict_row
except ModuleNotFoundError:  # pragma: no cover - handled at runtime in db tests
    psycopg = None
    dict_row = None


MIGRATION_ORDER = [
    "supabase/migrations/00001_canonical_schema.sql",
    "supabase/migrations/20260221_01_add_claim_payment_matching_fields.sql",
    "supabase/migrations/20260221_02_pipeline_safe_index_hardening.sql",
    "supabase/migrations/20260221_04_guarded_natural_key_uniqueness.sql",
    "supabase/migrations/00002_rpc_functions.sql",
]


def db_connect(database_url: str):
    if psycopg is None:
        pytest.skip("psycopg is not installed; skipping database-backed tests")
    conn = psycopg.connect(database_url, autocommit=True, row_factory=dict_row)
    return conn


def execute_sql_file(conn, path: Path) -> None:
    sql = path.read_text(encoding="utf-8")
    with conn.cursor() as cur:
        cur.execute(sql)


def apply_migrations(conn, root_dir: Path, files: list[str] | None = None) -> None:
    for relative in files or MIGRATION_ORDER:
        execute_sql_file(conn, root_dir / relative)


def reset_claim_data(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            TRUNCATE TABLE
                claim_adjustments,
                claim_payment_lines,
                claim_payments,
                claim_references,
                claim_providers,
                claim_dates,
                claim_diagnoses,
                claim_lines,
                claim_headers,
                edi_file_log,
                organizations
            RESTART IDENTITY CASCADE
            """
        )


def fetch_one(conn: psycopg.Connection, sql: str, params: tuple | None = None):
    with conn.cursor() as cur:
        cur.execute(sql, params or ())
        return cur.fetchone()


def fetch_all(conn: psycopg.Connection, sql: str, params: tuple | None = None):
    with conn.cursor() as cur:
        cur.execute(sql, params or ())
        return cur.fetchall()
