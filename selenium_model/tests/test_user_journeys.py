"""End-to-end user journeys that string multiple modules together."""
import sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
import config
import collectors
from pages.login_page import LoginPage
from pages.app_page import AppPage
from session import authed_driver


@pytest.fixture
def driver(fresh_driver):
    # Journeys that log in / search via the UI need a pristine renderer.
    return fresh_driver


def _record(name, steps, result, evidence):
    collectors.journeys.append({
        "journey": name, "steps": " → ".join(steps), "result": result, "evidence": evidence})


def test_journey_student_login_to_logout(driver, record_property):
    record_property("module", "USER JOURNEY")
    record_property("scenario", "Student: login → dashboard → library → logout")
    record_property("expected", "Full happy-path completes end to end")
    steps = ["Open /login", "Login as student", "Land on dashboard",
             "Open Library", "Logout"]
    try:
        lp = LoginPage(driver).load()
        lp.login_as_student()
        path = lp.wait_until_redirected()
        assert path.startswith("/dashboard")
        driver.get(config.BASE_URL + "/library")
        time.sleep(1.5)
        assert driver.find_elements(By.CSS_SELECTOR, "table.table")
        AppPage(driver).logout()
        time.sleep(2)
        ok = AppPage(driver).get_token() is None
        result = "PASSED" if ok else "FAILED"
        evidence = f"ended on {AppPage(driver).current_path()}, token cleared={ok}"
        _record("Student end-to-end (login→browse→logout)", steps, result, evidence)
        record_property("actual", evidence)
        assert ok
    except Exception as e:
        _record("Student end-to-end (login→browse→logout)", steps, "FAILED", str(e))
        record_property("actual", f"Journey failed: {e}")
        raise


def test_journey_admin_review(driver, record_property):
    record_property("module", "USER JOURNEY")
    record_property("scenario", "Admin: login → admin console → browse tabs")
    record_property("expected", "Admin reaches console and content renders")
    steps = ["Login as admin", "Land on /admin", "Read console content"]
    try:
        authed_driver(driver, student=False)
        driver.get(config.BASE_URL + "/admin")
        time.sleep(2.5)
        chars = len(driver.find_element(By.TAG_NAME, "body").text)
        ok = chars > 100 and AppPage(driver).current_path().startswith("/admin")
        result = "PASSED" if ok else "FAILED"
        evidence = f"admin console body chars={chars}"
        _record("Admin review journey", steps, result, evidence)
        record_property("actual", evidence)
        assert ok
    except Exception as e:
        _record("Admin review journey", steps, "FAILED", str(e))
        record_property("actual", f"Journey failed: {e}")
        raise


def test_journey_search_and_browse(driver, record_property):
    record_property("module", "USER JOURNEY")
    record_property("scenario", "Student: login → search library → open notices")
    record_property("expected", "Search returns results and notices page renders")
    steps = ["Login as student", "Search 'Java' in library", "Open Notices"]
    try:
        authed_driver(driver, student=True)
        driver.get(config.BASE_URL + "/library")
        time.sleep(2)
        box = driver.find_element(By.CSS_SELECTOR, "input[placeholder*='title, author']")
        box.send_keys("Java"); box.send_keys(Keys.ENTER)
        time.sleep(1.5)
        rows = driver.find_elements(By.CSS_SELECTOR, "table.table tbody tr")
        driver.get(config.BASE_URL + "/notices")
        time.sleep(1.5)
        notices_chars = len(driver.find_element(By.TAG_NAME, "body").text)
        ok = len(rows) >= 1 and notices_chars > 80
        result = "PASSED" if ok else "FAILED"
        evidence = f"library rows={len(rows)}, notices chars={notices_chars}"
        _record("Search & browse journey", steps, result, evidence)
        record_property("actual", evidence)
        assert ok
    except Exception as e:
        _record("Search & browse journey", steps, "FAILED", str(e))
        record_property("actual", f"Journey failed: {e}")
        raise
