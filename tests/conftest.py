import os
import sys
from pathlib import Path

import pytest


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT_DIR / "scripts"

if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))


@pytest.fixture(scope="session")
def root_dir() -> Path:
    return ROOT_DIR


@pytest.fixture(scope="session")
def fixture_dir(root_dir: Path) -> Path:
    return root_dir / "tests" / "fixtures"


@pytest.fixture
def read_fixture_text(fixture_dir: Path):
    def _read(name: str) -> str:
        return (fixture_dir / name).read_text(encoding="utf-8")

    return _read


@pytest.fixture(scope="session")
def database_url() -> str:
    return os.getenv("DATABASE_URL", "").strip()


@pytest.fixture
def require_database_url(database_url: str) -> str:
    if not database_url:
        pytest.skip("DATABASE_URL is not set; skipping database-backed test")
    return database_url
