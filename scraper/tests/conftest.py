from pathlib import Path

import pytest

FIX = Path(__file__).parent / "fixtures"


@pytest.fixture
def fixture_html():
    return lambda name: (FIX / name).read_text(encoding="utf-8")
