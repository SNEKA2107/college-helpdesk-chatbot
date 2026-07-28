"""Pytest fixtures and hooks for the CampusAssist audit suite.

Responsibilities:
  * build a single Chrome WebDriver for the session (webdriver-manager);
  * capture a screenshot for EVERY test — passed, failed or errored;
  * drain the browser console into logs/browser_console.log;
  * record one Functional Test Results row per test, with the module/scenario/
    expected-result metadata that the Excel report needs.

Nothing here aborts a run: a driver that cannot start degrades the Selenium
tests to skips while the HTTP/API/static phases still execute and report.
"""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

import collectors                     # noqa: E402
import config                         # noqa: E402
from pages.login_page import LoginPage, RegisterPage, SetupPage      # noqa: E402
from pages.portal_pages import AdminPanel, FacultyPortal, StudentPortal  # noqa: E402

_SAFE = re.compile(r"[^A-Za-z0-9_.-]+")


def _slug(text: str, limit: int = 70) -> str:
    return _SAFE.sub("_", text)[:limit].strip("_")


# ── WebDriver ───────────────────────────────────────────────────────────────
def _build_driver():
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service

    opts = Options()
    if config.HEADLESS:
        opts.add_argument("--headless=new")
    opts.add_argument(f"--window-size={config.WINDOW_SIZE[0]},{config.WINDOW_SIZE[1]}")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--log-level=3")
    opts.add_argument("--ignore-certificate-errors")
    opts.add_experimental_option("excludeSwitches", ["enable-logging", "enable-automation"])
    opts.set_capability("goog:loggingPrefs", {"browser": "ALL", "performance": "ALL"})

    try:
        from webdriver_manager.chrome import ChromeDriverManager
        service = Service(ChromeDriverManager().install(),
                          log_output=str(config.SELENIUM_LOG))
        driver = webdriver.Chrome(service=service, options=opts)
    except Exception:                                        # noqa: BLE001
        # webdriver-manager unavailable/offline — fall back to Selenium Manager.
        driver = webdriver.Chrome(options=opts)

    driver.set_page_load_timeout(config.PAGE_LOAD_TIMEOUT)
    driver.implicitly_wait(config.IMPLICIT_WAIT)
    return driver


@pytest.fixture(scope="session")
def driver():
    try:
        drv = _build_driver()
    except Exception as e:                                   # noqa: BLE001
        collectors.defect(
            "Test Infrastructure",
            f"Chrome WebDriver could not be started: {e}",
            "1. Run the suite  2. Observe the driver failing to launch",
            "High", "selenium_model/conftest.py")
        pytest.skip(f"WebDriver unavailable: {e}", allow_module_level=True)
        return
    yield drv
    try:
        drv.quit()
    except Exception:                                        # noqa: BLE001
        pass


# ── page-object fixtures ────────────────────────────────────────────────────
@pytest.fixture
def login_page(driver):
    return LoginPage(driver)


@pytest.fixture
def register_page(driver):
    return RegisterPage(driver)


@pytest.fixture
def setup_page(driver):
    return SetupPage(driver)


def ensure_session(driver, role):
    """Authenticate as `role`, reusing the browser's existing session if it matches.

    The application rate-limits /api/auth/login, and a 300+ test run that signed
    in afresh for every test would trip that limit and report the resulting 429s
    as functional failures. Reusing a live session keeps the suite measuring the
    application rather than its own login volume.
    """
    login = LoginPage(driver)
    try:
        if driver.current_url.startswith(config.BASE_URL) \
                and login.logged_in and login.session_role == role:
            return login
    except Exception:                                        # noqa: BLE001
        pass
    login.login_as(role)
    return login


@pytest.fixture
def student(driver):
    """A student session, already authenticated."""
    ensure_session(driver, "student")
    return StudentPortal(driver)


@pytest.fixture
def admin(driver):
    ensure_session(driver, "admin")
    return AdminPanel(driver)


@pytest.fixture
def faculty(driver):
    ensure_session(driver, "faculty")
    return FacultyPortal(driver)


# ── per-test metadata ───────────────────────────────────────────────────────
@pytest.fixture
def case(request):
    """Declare the module / scenario / expected result for the Excel report.

    Usage:
        def test_x(case):
            case("Authentication", "Valid student login", "Lands on /student/dashboard")
    """
    def _set(module, scenario, expected, actual=""):
        request.node._ca_meta = {
            "module": module, "scenario": scenario,
            "expected": expected, "actual": actual,
        }

    def _actual(text):
        meta = getattr(request.node, "_ca_meta", None)
        if meta is not None:
            meta["actual"] = str(text)

    _set.actual = _actual
    request.node._ca_set_actual = _actual
    return _set


def actual(request_node, text):
    setter = getattr(request_node, "_ca_set_actual", None)
    if setter:
        setter(text)


# ── hooks: screenshots, console logs, result rows ───────────────────────────
_counter = {"n": 0}


def _drain_console(drv) -> list[str]:
    try:
        entries = drv.get_log("browser")
    except Exception:                                        # noqa: BLE001
        return []
    out = []
    for e in entries:
        out.append(f"[{e.get('level','?')}] {e.get('message','')}")
    return out


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    if report.when != "call":
        return

    drv = item.funcargs.get("driver")
    meta = getattr(item, "_ca_meta", None) or {}

    # ---- screenshot for pass, fail and error alike ----
    shot_path = ""
    if drv is not None:
        _counter["n"] += 1
        status_tag = "PASS" if report.passed else ("SKIP" if report.skipped else "FAIL")
        fname = f"{_counter['n']:03d}_{status_tag}_{_slug(item.name)}.png"
        target = config.SCREENSHOT_DIR / fname
        try:
            drv.save_screenshot(str(target))
            shot_path = f"screenshots/{fname}"
        except Exception:                                    # noqa: BLE001
            shot_path = ""

        lines = _drain_console(drv)
        if lines:
            collectors.console([f"--- {item.name} ---"] + lines)
            for line in lines:
                low = line.lower()
                if "[severe]" in low and "favicon" not in low:
                    collectors.defect(
                        meta.get("module", "Frontend"),
                        f"Browser console SEVERE during '{item.name}': {line[:220]}",
                        f"1. Run {item.nodeid}  2. Inspect the browser console",
                        "Medium", f"logs/browser_console.log")

    status = "Passed" if report.passed else ("Skipped" if report.skipped else "Failed")
    err = ""
    if report.failed:
        err = str(report.longrepr)
        err = err.strip().splitlines()[-1][:300] if err.strip() else "assertion failed"
    elif report.skipped:
        err = "skipped"

    actual_text = meta.get("actual") or ("As expected" if report.passed else err)

    collectors._write("functional", {
        "test_id": item.nodeid,
        "name": item.name,
        "module": meta.get("module") or item.module.__name__.replace("test_", "").title(),
        "scenario": meta.get("scenario") or (item.function.__doc__ or item.name).strip().splitlines()[0],
        "expected": meta.get("expected") or "Behaves per specification",
        "actual": actual_text,
        "status": status,
        "duration_s": round(report.duration, 2),
        "screenshot": shot_path,
        "error": err,
    })

    # A failed functional test is a defect in its own right.
    if report.failed:
        collectors.defect(
            meta.get("module") or "Application",
            f"{meta.get('scenario') or item.name} — {err}",
            f"1. Run: pytest {item.nodeid}  2. Observe the failure",
            "High" if "auth" in item.nodeid or "rbac" in item.nodeid or "security" in item.nodeid
            else "Medium",
            shot_path or item.nodeid)
