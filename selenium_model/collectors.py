"""Shared, in-memory result collectors.

Selenium tests append structured records here; conftest's session-finish hook
serialises every collector to JSON under selenium_model/data/ so the report
generator can build each Excel sheet without re-running the browser.
"""
import json
from config import DATA_DIR

functional = []      # auto-populated by the makereport hook
api = []             # API validation results
broken_links = []    # broken-link scan
accessibility = []   # a11y findings
performance = []      # page load observations
journeys = []        # end-to-end user journeys
ui = []              # UI validation findings
security = []        # security observations

_ALL = {
    "functional": functional,
    "api": api,
    "broken_links": broken_links,
    "accessibility": accessibility,
    "performance": performance,
    "journeys": journeys,
    "ui": ui,
    "security": security,
}


def dump():
    for name, rows in _ALL.items():
        with open(DATA_DIR / f"{name}.json", "w", encoding="utf-8") as f:
            json.dump(rows, f, indent=2, default=str)
