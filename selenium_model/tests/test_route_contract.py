"""Browser route-contract breadth: every route renders a real page in-app.

Uses the shared session browser. Each route is checked across several
independent contract assertions (no-redirect / body / title / content /
no-crash) so the suite exercises the full navigable surface of the SPA.
"""
import sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from selenium.webdriver.common.by import By
import config
from session import authed_driver, ensure_anonymous

CRASH_MARKERS = ("unexpected application error", "cannot read properties of",
                 "objects are not valid as a react child")


def _meta(rp, scenario, expected):
    rp("module", "ROUTE CONTRACT"); rp("scenario", scenario); rp("expected", expected)


def _open_authed(driver, route, admin=False):
    authed_driver(driver, student=not admin)
    driver.get(config.BASE_URL + route)
    time.sleep(1.2)


def _path(driver):
    return (driver.current_url or "").replace(config.BASE_URL, "") or "/"


def _body(driver):
    try:
        return driver.find_element(By.TAG_NAME, "body").text
    except Exception:
        return ""


# ── Student routes ────────────────────────────────────────────────────────────
@pytest.mark.parametrize("route", config.STUDENT_ROUTES)
def test_student_route_not_redirected(driver, record_property, route):
    _meta(record_property, f"{route} stays in-app for an authed student",
          f"Authenticated visit to {route} does not bounce to /login")
    _open_authed(driver, route)
    p = _path(driver)
    record_property("actual", f"landed on {p}")
    assert not p.startswith("/login")


@pytest.mark.parametrize("route", config.STUDENT_ROUTES)
def test_student_route_renders_body(driver, record_property, route):
    _meta(record_property, f"{route} renders non-empty content",
          f"{route} body has meaningful text content")
    _open_authed(driver, route)
    n = len(_body(driver))
    record_property("actual", f"body chars={n}")
    assert n > 30


@pytest.mark.parametrize("route", config.STUDENT_ROUTES)
def test_student_route_has_title(driver, record_property, route):
    _meta(record_property, f"{route} sets a document title",
          f"{route} has a non-empty <title>")
    _open_authed(driver, route)
    t = driver.title
    record_property("actual", f"title='{t}'")
    assert t and len(t) > 0


@pytest.mark.parametrize("route", config.STUDENT_ROUTES)
def test_student_route_has_heading_or_card(driver, record_property, route):
    _meta(record_property, f"{route} renders a heading or content card",
          f"{route} shows an h1/h2/.card/.page-header element")
    _open_authed(driver, route)
    els = driver.find_elements(By.CSS_SELECTOR, "h1, h2, .card, .page-header, .stat-card, table")
    record_property("actual", f"content elements found={len(els)}")
    assert len(els) >= 1


@pytest.mark.parametrize("route", config.STUDENT_ROUTES)
def test_student_route_no_crash(driver, record_property, route):
    _meta(record_property, f"{route} renders without a React crash overlay",
          f"{route} body contains no crash/error-boundary markers")
    _open_authed(driver, route)
    low = _body(driver).lower()
    hit = next((m for m in CRASH_MARKERS if m in low), None)
    record_property("actual", "no crash markers" if not hit else f"crash marker: {hit}")
    assert hit is None


# ── Public routes ─────────────────────────────────────────────────────────────
@pytest.mark.parametrize("route", config.PUBLIC_ROUTES)
def test_public_route_renders_body(driver, record_property, route):
    _meta(record_property, f"Public {route} renders content",
          f"{route} renders non-empty body for anonymous visitors")
    ensure_anonymous(driver)
    driver.get(config.BASE_URL + route)
    time.sleep(1.2)
    n = len(_body(driver))
    record_property("actual", f"body chars={n}")
    assert n > 30


@pytest.mark.parametrize("route", config.PUBLIC_ROUTES)
def test_public_route_has_title(driver, record_property, route):
    _meta(record_property, f"Public {route} sets a document title",
          f"{route} has a non-empty <title>")
    ensure_anonymous(driver)
    driver.get(config.BASE_URL + route)
    time.sleep(1.0)
    t = driver.title
    record_property("actual", f"title='{t}'")
    assert t and len(t) > 0


@pytest.mark.parametrize("route", config.PUBLIC_ROUTES)
def test_public_route_no_crash(driver, record_property, route):
    _meta(record_property, f"Public {route} renders without a crash overlay",
          f"{route} body contains no crash markers")
    ensure_anonymous(driver)
    driver.get(config.BASE_URL + route)
    time.sleep(1.0)
    low = _body(driver).lower()
    hit = next((m for m in CRASH_MARKERS if m in low), None)
    record_property("actual", "no crash markers" if not hit else f"crash marker: {hit}")
    assert hit is None


# ── Admin route ───────────────────────────────────────────────────────────────
def test_admin_route_not_redirected(driver, record_property):
    _meta(record_property, "/admin stays in-app for an admin",
          "Admin visit to /admin does not bounce away")
    _open_authed(driver, "/admin", admin=True)
    p = _path(driver)
    record_property("actual", f"landed on {p}")
    assert p.startswith("/admin")


def test_admin_route_renders_body(driver, record_property):
    _meta(record_property, "/admin renders the console content",
          "/admin body has substantial content")
    _open_authed(driver, "/admin", admin=True)
    n = len(_body(driver))
    record_property("actual", f"body chars={n}")
    assert n > 100


def test_admin_route_has_title(driver, record_property):
    _meta(record_property, "/admin sets a document title",
          "/admin has a non-empty <title>")
    _open_authed(driver, "/admin", admin=True)
    t = driver.title
    record_property("actual", f"title='{t}'")
    assert t and len(t) > 0


def test_admin_route_no_crash(driver, record_property):
    _meta(record_property, "/admin renders without a crash overlay",
          "/admin body contains no crash markers")
    _open_authed(driver, "/admin", admin=True)
    low = _body(driver).lower()
    hit = next((m for m in CRASH_MARKERS if m in low), None)
    record_property("actual", "no crash markers" if not hit else f"crash marker: {hit}")
    assert hit is None
