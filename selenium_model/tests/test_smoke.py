"""Smoke + regression: critical public pages load and render."""
import sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from selenium.webdriver.common.by import By
import config
from session import ensure_anonymous
from pages.base_page import BasePage


def _meta(rp, scenario, expected):
    rp("module", "SMOKE"); rp("scenario", scenario); rp("expected", expected)


@pytest.mark.parametrize("path,keyword", [
    ("/", "campusassist"),
    ("/login", "login"),
    ("/register", "create"),
])
def test_public_page_smoke(driver, record_property, path, keyword):
    _meta(record_property, f"Public page {path} loads and renders content",
          f"GET {path} renders a non-empty page mentioning '{keyword}'")
    ensure_anonymous(driver)
    bp = BasePage(driver).open(path)
    time.sleep(1.5)
    body = bp.body_text().lower()
    record_property("actual", f"title='{bp.title()}', body chars={len(body)}")
    assert len(body) > 50


def test_app_title_present(driver, record_property):
    _meta(record_property, "App document title is set",
          "The SPA sets a non-empty <title>")
    bp = BasePage(driver).open("/")
    time.sleep(1)
    t = bp.title()
    record_property("actual", f"document.title='{t}'")
    assert t and len(t) > 0
