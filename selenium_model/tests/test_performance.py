"""Per-page performance observations via the Navigation Timing API.

Records a load-time sample per page (never fails on a slow page — observations
are advisory and feed the 'Performance Observations' report sheet).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
import config
import collectors
from session import goto
from pages.base_page import BasePage

BUDGET_MS = 4000
PERF_PAGES = config.PUBLIC_ROUTES + config.STUDENT_ROUTES + config.ADMIN_ROUTES


@pytest.mark.parametrize("route", PERF_PAGES)
def test_page_load_time(driver, record_property, route):
    record_property("module", "PERFORMANCE")
    record_property("scenario", f"Measure load time of {route}")
    record_property("expected", f"Load time recorded for {route} (soft budget {BUDGET_MS} ms)")
    goto(driver, route)
    # BasePage.load_time_ms was renamed to load_ms in 03dd12a and this caller was
    # missed, so all 25 parametrisations raised AttributeError. The replacement
    # reports 0 rather than None when the Navigation Timing API gives nothing, so
    # normalise it back to None to keep the "unavailable" branch below working.
    ms = BasePage(driver).load_ms() or None
    if ms is None:
        obs, rec = "Timing API unavailable", "Re-measure with Lighthouse/CDP"
    elif ms <= BUDGET_MS:
        obs, rec = f"Within budget ({BUDGET_MS} ms)", "No action needed"
    else:
        obs, rec = f"Exceeds {BUDGET_MS} ms soft budget", "Consider code-splitting / asset optimisation"
    collectors.performance(route, f"{ms} ms" if ms is not None else "n/a", obs, rec)
    record_property("actual", f"{route} load time = {ms} ms")
    assert True
