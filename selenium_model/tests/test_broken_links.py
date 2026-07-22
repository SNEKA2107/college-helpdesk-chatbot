"""Broken-link validation: collect anchors across public + authed pages and HEAD them."""
import sys, time
import urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from selenium.webdriver.common.by import By
import config
import collectors
from session import authed_driver


def _status(url):
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


def test_collect_and_validate_links(driver, record_property):
    record_property("module", "BROKEN LINKS")
    record_property("scenario", "Crawl links on key pages and validate HTTP status")
    record_property("expected", "All in-app/asset links resolve (2xx/3xx); none broken (4xx/5xx)")

    authed_driver(driver, student=True)
    seen = set()
    pages = ["/", "/dashboard", "/library", "/notices", "/contact"]
    broken = 0
    checked = 0
    for page in pages:
        driver.get(config.BASE_URL + page)
        time.sleep(1.5)
        for a in driver.find_elements(By.TAG_NAME, "a"):
            href = a.get_attribute("href") or ""
            if not href or href.startswith(("mailto:", "tel:", "javascript:")) or "#" == href[-1:]:
                continue
            if not href.startswith("http"):
                continue
            # only check same-origin links to avoid flaky external timeouts
            if config.BASE_URL not in href:
                collectors.broken_links.append({
                    "url": href, "source": page, "status": "skipped (external)", "result": "Not checked"})
                continue
            if href in seen:
                continue
            seen.add(href)
            code = _status(href)
            checked += 1
            ok = code in (200, 204, 301, 302, 304)
            if not ok:
                broken += 1
            collectors.broken_links.append({
                "url": href, "source": page, "status": code,
                "result": "OK" if ok else "BROKEN"})
    record_property("actual", f"checked {checked} same-origin links across {len(pages)} pages; broken={broken}")
    assert broken == 0
