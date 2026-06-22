"""Form validation: registration + leave application (mandatory, invalid, valid)."""
import sys, time, uuid
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
import config
from session import authed_driver
from pages.register_page import RegisterPage
from pages.leave_page import submit_leave


@pytest.fixture
def driver(fresh_driver):
    # Form-typing tests need a pristine renderer (see conftest.fresh_driver).
    return fresh_driver


def _meta(rp, scenario, expected):
    rp("module", "FORMS"); rp("scenario", scenario); rp("expected", expected)


def test_register_mandatory_field_validation(driver, record_property):
    _meta(record_property, "Registration blocks empty mandatory fields",
          "Submitting an empty registration form shows field errors and no success")
    rp = RegisterPage(driver).load()
    # tick terms only, leave everything else blank
    cb = rp.find(*RegisterPage.TERMS)
    cb.click()
    rp.submit()
    time.sleep(1)
    errs = rp.visible_error_count()
    record_property("actual", f"{errs} field errors shown; success={rp.is_success()}")
    assert errs >= 1 and not rp.is_success()


def test_register_invalid_email_rejected(driver, record_property):
    _meta(record_property, "Registration rejects an invalid email format",
          "An email without '@x.y' triggers a validation error")
    rp = RegisterPage(driver).load()
    rp.fill(first="QA", last="Bot", sid="22IT999", email="not-an-email",
            dept="IT", pw="Testpass1!", cpw="Testpass1!", terms=True)
    rp.submit()
    time.sleep(1)
    errs = rp.visible_error_count()
    record_property("actual", f"{errs} field errors shown; success={rp.is_success()}")
    assert errs >= 1 and not rp.is_success()


def test_register_password_mismatch(driver, record_property):
    _meta(record_property, "Registration flags mismatched passwords",
          "Different password / confirm-password values block submission")
    rp = RegisterPage(driver).load()
    rp.fill(first="QA", last="Bot", sid="22IT998", email="qa998@college.edu",
            dept="IT", pw="Testpass1!", cpw="Different9!", terms=True)
    rp.submit()
    time.sleep(1)
    body = rp.body_text().lower()
    errs = rp.visible_error_count()
    record_property("actual", f"errors={errs}; 'do not match' present={'do not match' in body}")
    assert errs >= 1 and not rp.is_success()


def test_leave_form_requires_fields(driver, record_property):
    _meta(record_property, "Leave application requires type/dates/reason",
          "Submitting an empty leave form shows a validation toast and does not succeed")
    authed_driver(driver, student=True)
    driver.get(config.BASE_URL + "/leave")
    time.sleep(2)
    btns = driver.find_elements(By.XPATH, "//button[contains(.,'Submit Application')]")
    assert btns, "submit button not found"
    btns[0].click()
    time.sleep(1.5)
    body = driver.find_element(By.TAG_NAME, "body").text.lower()
    success = "leave application submitted" in body
    toast = "please select" in body or "please enter" in body
    record_property("actual", f"validation toast shown={toast}; success={success}")
    assert not success


def test_leave_valid_submission(driver, record_property):
    _meta(record_property, "Valid leave application is accepted",
          "Filling type/dates/reason and submitting shows the success state")
    authed_driver(driver, student=True)
    lp = submit_leave(driver, "Automated QA test leave request — please ignore.")
    ok = lp.is_submitted()
    record_property("actual", "Success screen shown" if ok else "No success confirmation")
    assert ok
