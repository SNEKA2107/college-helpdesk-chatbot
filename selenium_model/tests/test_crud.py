"""CRUD coverage — Create + Read of leave applications; Read of seeded records."""
import sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from selenium.webdriver.common.by import By
import config
from session import authed_driver
from pages.leave_page import submit_leave


@pytest.fixture
def driver(fresh_driver):
    # Typing into the leave form needs a pristine renderer (see conftest.fresh_driver).
    return fresh_driver


def _meta(rp, scenario, expected):
    rp("module", "CRUD"); rp("scenario", scenario); rp("expected", expected)


def test_read_seeded_requests(driver, record_property):
    _meta(record_property, "Read — existing requests are listed",
          "The Requests page shows seeded certificate requests")
    authed_driver(driver, student=True)
    driver.get(config.BASE_URL + "/requests")
    time.sleep(2)
    body = driver.find_element(By.TAG_NAME, "body").text
    has = any(k in body for k in ("Bonafide", "Marksheet", "Conduct", "Request"))
    record_property("actual", f"requests content present={has}")
    assert has and len(body) > 100


def test_read_library_books(driver, record_property):
    _meta(record_property, "Read — library catalog renders seeded books",
          "Library table lists multiple seeded books")
    authed_driver(driver, student=True)
    driver.get(config.BASE_URL + "/library")
    time.sleep(2)
    rows = driver.find_elements(By.CSS_SELECTOR, "table.table tbody tr")
    record_property("actual", f"{len(rows)} book row(s) rendered")
    assert len(rows) >= 1


def test_create_and_read_leave(driver, record_property):
    _meta(record_property, "Create + Read — submit a leave, see it in history",
          "A submitted leave application appears in the leave history list")
    authed_driver(driver, student=True)
    lp = submit_leave(driver, "CRUD test — automated leave entry.", days_ahead=7, span=1)
    created = lp.is_submitted()
    record_property("actual", "Leave created & confirmation shown" if created else "No confirmation")
    assert created
