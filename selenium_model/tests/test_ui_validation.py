"""Per-page UI validation: page renders structural content without layout errors.

Records UI findings (only when something looks wrong) for the 'UI Validation
Findings' sheet; passes when the page renders a real, visible body.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from selenium.webdriver.common.by import By
import config
import collectors
from session import goto

UI_PAGES = config.PUBLIC_ROUTES + config.STUDENT_ROUTES + config.ADMIN_ROUTES


@pytest.mark.parametrize("route", UI_PAGES)
def test_ui_renders_structure(driver, record_property, route):
    record_property("module", "UI VALIDATION")
    record_property("scenario", f"{route} renders visible structural content")
    record_property("expected", f"{route} shows a visible body with structural elements and no empty render")
    goto(driver, route)
    body = driver.find_element(By.TAG_NAME, "body")
    text_len = len(body.text)
    structural = driver.find_elements(
        By.CSS_SELECTOR, "header, nav, main, aside, form, table, .card, .page-header, h1, h2, button")
    displayed = body.is_displayed()
    if text_len < 20 or not structural:
        collectors.ui_finding(
            route, "Sparse/empty render (no structural elements detected)",
            "Medium", f"body chars={text_len}, structural els={len(structural)}")
    record_property("actual", f"body displayed={displayed}, chars={text_len}, structural els={len(structural)}")
    assert displayed and text_len >= 20 and len(structural) >= 1
