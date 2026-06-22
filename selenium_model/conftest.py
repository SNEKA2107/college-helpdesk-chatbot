import sys
import time
import json
from pathlib import Path

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options as ChromeOptions
from webdriver_manager.chrome import ChromeDriverManager

sys.path.insert(0, str(Path(__file__).resolve().parent))
import config
import collectors


@pytest.fixture(scope="session")
def browser_options():
    opts = ChromeOptions()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1920,1080")
    opts.add_argument("--ignore-certificate-errors")
    opts.add_argument("--log-level=3")
    opts.add_argument("--disable-extensions")
    opts.add_argument("--disable-background-networking")
    opts.add_argument("--disable-software-rasterizer")
    opts.add_argument("--blink-settings=imagesEnabled=true")
    opts.add_experimental_option("excludeSwitches", ["enable-logging"])
    # Browser console capture only. (Enabling 'performance' logging here bloats
    # Chrome memory across many launches and triggers 'tab crashed' — keep it off.)
    opts.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    return opts


@pytest.fixture(scope="session")
def _driver_path():
    # webdriver-manager fetches a matching chromedriver locally. On CI it may fail
    # to detect the Chrome version — return None and let Selenium Manager resolve it.
    try:
        return ChromeDriverManager().install()
    except Exception:
        return None


def _new_chrome(options, path):
    """Create a Chrome driver, preferring webdriver-manager, falling back to the
    built-in Selenium Manager (works out-of-the-box on CI runners)."""
    if path:
        try:
            return webdriver.Chrome(service=Service(path), options=options)
        except Exception:
            pass
    return webdriver.Chrome(options=options)  # Selenium Manager auto-resolves driver


@pytest.fixture(scope="session")
def driver(browser_options, _driver_path):
    # One browser for the whole session: 300+ launches would be slow and trigger
    # 'tab crashed' on Windows. Tests set their own auth state (see session.py).
    drv = _new_chrome(browser_options, _driver_path)
    drv.set_page_load_timeout(config.PAGE_LOAD_TIMEOUT)
    drv.implicitly_wait(3)
    yield drv
    # Drain browser console logs to a file
    try:
        logs = drv.get_log("browser")
        with open(config.ROOT / "browser_console.log", "a", encoding="utf-8") as f:
            for e in logs:
                f.write(f"[{e.get('level')}] {e.get('timestamp')}: {e.get('message')}\n")
    except Exception:
        pass
    try:
        drv.quit()
    except Exception:
        pass


@pytest.fixture(scope="function")
def fresh_driver(browser_options, _driver_path):
    # A brand-new browser per test. Used by tests that TYPE into forms: visiting
    # the heavy /admin page in the shared session degrades the renderer so that
    # controlled inputs silently revert to empty. A fresh browser sidesteps that.
    drv = _new_chrome(browser_options, _driver_path)
    drv.set_page_load_timeout(config.PAGE_LOAD_TIMEOUT)
    drv.implicitly_wait(3)
    yield drv
    try:
        logs = drv.get_log("browser")
        with open(config.ROOT / "browser_console.log", "a", encoding="utf-8") as f:
            for e in logs:
                f.write(f"[{e.get('level')}] {e.get('timestamp')}: {e.get('message')}\n")
    except Exception:
        pass
    try:
        drv.quit()
    except Exception:
        pass


_counter = {"n": 0}


@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    if rep.when != "call":
        return

    _counter["n"] += 1
    test_id = f"TC-{_counter['n']:03d}"
    module_name = item.module.__name__.split('.')[-1].replace('test_', '').replace('_', ' ').upper()
    scenario = (item.name.replace('test_', '').replace('_', ' ').strip().capitalize())

    if rep.passed:
        status = "PASSED"
    elif rep.skipped:
        status = "SKIPPED"
    else:
        status = "FAILED"

    # Expected/actual: prefer explicit values recorded by the test via
    # item.user_properties (("expected", ...), ("actual", ...)).
    props = dict(item.user_properties)
    expected = props.get("expected", "Operation completes as specified")
    if rep.passed:
        actual = props.get("actual", "Behaved as expected")
    elif rep.skipped:
        actual = props.get("actual", "Skipped: " + (str(call.excinfo.value) if call.excinfo else "precondition not met"))
    else:
        last = ""
        if rep.longreprtext:
            lines = [l for l in rep.longreprtext.splitlines() if l.strip()]
            last = lines[-1] if lines else ""
        actual = props.get("actual", f"Error: {last}")

    screenshot_path = ""
    drv = item.funcargs.get("driver")
    if drv is not None:
        safe = item.name.replace("[", "_").replace("]", "_").replace("/", "_").replace(" ", "_")
        f = config.SCREENSHOT_DIR / f"{status}_{safe}.png"
        try:
            drv.save_screenshot(str(f))
            screenshot_path = str(f.relative_to(config.PROJECT_ROOT))
        except Exception:
            pass

    collectors.functional.append({
        "test_id": test_id,
        "module": props.get("module", module_name),
        "scenario": props.get("scenario", scenario),
        "expected": expected,
        "actual": actual,
        "status": status,
        "time": f"{rep.duration:.2f}s",
        "screenshot": screenshot_path,
    })


def pytest_sessionfinish(session, exitstatus):
    collectors.dump()
    with open(config.DATA_DIR / "functional.json", "w", encoding="utf-8") as f:
        json.dump(collectors.functional, f, indent=2, default=str)
