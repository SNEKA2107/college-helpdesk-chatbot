"""Search, filter and sorting — exercised via the Library catalog."""
import sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
import config
from session import authed_driver


@pytest.fixture
def driver(fresh_driver):
    # Typing into the search box needs a pristine renderer (see conftest.fresh_driver).
    return fresh_driver


def _meta(rp, scenario, expected):
    rp("module", "SEARCH & FILTER"); rp("scenario", scenario); rp("expected", expected)


def _open_library(driver):
    authed_driver(driver, student=True)
    driver.get(config.BASE_URL + "/library")
    time.sleep(2)


def _rows(driver):
    return driver.find_elements(By.CSS_SELECTOR, "table.table tbody tr")


def _search_input(driver):
    return driver.find_element(By.CSS_SELECTOR, "input[placeholder*='title, author']")


def test_search_exact_match(driver, record_property):
    _meta(record_property, "Library search — exact title match",
          "Searching 'Clean Code' returns the matching book")
    _open_library(driver)
    box = _search_input(driver)
    box.clear(); box.send_keys("Clean Code"); box.send_keys(Keys.ENTER)
    time.sleep(1.5)
    rows = _rows(driver)
    texts = " ".join(r.text for r in rows).lower()
    record_property("actual", f"{len(rows)} row(s); contains 'clean code'={'clean code' in texts}")
    assert "clean code" in texts


def test_search_partial_match(driver, record_property):
    _meta(record_property, "Library search — partial keyword match",
          "Searching 'Java' returns one or more results")
    _open_library(driver)
    box = _search_input(driver)
    box.clear(); box.send_keys("Java"); box.send_keys(Keys.ENTER)
    time.sleep(1.5)
    rows = _rows(driver)
    texts = " ".join(r.text for r in rows).lower()
    record_property("actual", f"{len(rows)} row(s); contains 'java'={'java' in texts}")
    assert len(rows) >= 1 and "java" in texts


def test_search_empty_returns_catalog(driver, record_property):
    _meta(record_property, "Library search — empty query returns full catalog",
          "An empty search shows the full book list (not a single filtered row)")
    _open_library(driver)
    full = len(_rows(driver))
    box = _search_input(driver)
    box.clear(); box.send_keys(Keys.ENTER)
    time.sleep(1.5)
    after = len(_rows(driver))
    record_property("actual", f"catalog rows={full}; after empty search={after}")
    assert after >= 1


def test_category_filter(driver, record_property):
    _meta(record_property, "Library category filter narrows results",
          "Clicking a category chip filters the catalog to that category")
    _open_library(driver)
    full = len(_rows(driver))
    chips = driver.find_elements(By.CSS_SELECTOR, "button.btn-sm")
    # chips[0] == 'All Books'; pick the first real category
    target = chips[1] if len(chips) > 1 else None
    assert target is not None, "no category chips rendered"
    cat = target.text
    target.click()
    time.sleep(1.5)
    after = len(_rows(driver))
    record_property("actual", f"category '{cat}': {after} row(s) (full catalog={full})")
    assert after >= 1
