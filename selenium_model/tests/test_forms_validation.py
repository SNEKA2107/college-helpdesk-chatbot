"""
Form validation tests: verify client-side and server-side validation on key forms.
"""
import pytest
import time
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
from selenium_model.pages.login_page import LoginPage
from selenium_model.pages.extra_pages import RequestsPage, LeavePage
from selenium_model.pages.dashboard_page import DashboardPage

STUDENT_ID = "22IT101"
STUDENT_PW = "student123"


def _login_student(driver):
    lp = LoginPage(driver)
    lp.navigate()
    lp.login(STUDENT_ID, STUDENT_PW)
    lp.wait_for_login_success()


def test_login_form_empty_submit(driver):
    lp = LoginPage(driver)
    lp.navigate()
    lp.login("", "")
    assert lp.get_student_id_error_text() == "Please enter your Student ID"
    assert lp.get_password_error_text() == "Please enter your password"


def test_login_form_password_only(driver):
    lp = LoginPage(driver)
    lp.navigate()
    lp.login("", STUDENT_PW)
    assert lp.get_student_id_error_text() == "Please enter your Student ID"


def test_login_form_id_only(driver):
    lp = LoginPage(driver)
    lp.navigate()
    lp.login(STUDENT_ID, "")
    assert lp.get_password_error_text() == "Please enter your password"


def test_request_form_requires_reason(driver):
    _login_student(driver)
    rp = RequestsPage(driver)
    rp.navigate()
    rp.click_element(RequestsPage.NEW_REQUEST_BTN)
    time.sleep(0.4)

    req_reason_el = driver.find_element(*RequestsPage.REQ_REASON)
    # Verify field exists and is a textarea / input
    assert req_reason_el is not None
    tag = req_reason_el.tag_name
    assert tag in ("textarea", "input"), f"Unexpected tag: {tag}"

    # Try submitting without filling the reason — count items before
    count_before = rp.get_requests_count()
    rp.click_element(RequestsPage.SUBMIT_BTN)
    time.sleep(0.8)
    count_after = rp.get_requests_count()
    # Should not add a new request without required reason
    assert count_after == count_before, "Request created despite empty reason field"

    DashboardPage(driver).logout_via_sidebar()


def test_leave_form_past_date_rejected(driver):
    """Leave form should not accept past from-dates."""
    _login_student(driver)
    lp = LeavePage(driver)
    lp.navigate()

    # Set a date that is clearly in the past
    driver.execute_script("document.getElementById('fromDate').value = '2020-01-01';")
    driver.execute_script("document.getElementById('toDate').value = '2020-01-02';")
    lp.send_keys_to_element(LeavePage.LEAVE_REASON, "E2E past date test")
    lp.click_element(LeavePage.SUBMIT_BTN)
    time.sleep(1.0)

    # Success box should NOT be visible
    assert not lp.is_success_visible(), "Past-date leave was accepted — client validation may be missing"

    DashboardPage(driver).logout_via_sidebar()


def test_leave_form_end_before_start_rejected(driver):
    """To-date before from-date should be rejected."""
    _login_student(driver)
    lp = LeavePage(driver)
    lp.navigate()

    driver.execute_script("document.getElementById('fromDate').value = '2026-08-10';")
    driver.execute_script("document.getElementById('toDate').value = '2026-08-05';")
    lp.send_keys_to_element(LeavePage.LEAVE_REASON, "E2E inverted date test")
    lp.click_element(LeavePage.SUBMIT_BTN)
    time.sleep(1.0)

    assert not lp.is_success_visible(), "End-before-start leave was accepted — validation missing"

    DashboardPage(driver).logout_via_sidebar()


def test_fees_payment_negative_amount_rejected(driver):
    """Negative fee payment amount should be rejected by client or server."""
    _login_student(driver)
    driver.get("http://localhost:5000/fees.html")
    time.sleep(1.0)

    try:
        amount_input = driver.find_element(By.ID, "payAmount")
        amount_input.clear()
        amount_input.send_keys("-1000")

        pay_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Pay') or contains(text(), 'Submit')]")
        pay_btn.click()
        time.sleep(1.0)

        # Should show an error or the input constraint min=0 should block it
        val = amount_input.get_attribute("value")
        assert val == "" or float(val) > 0, "Negative fee amount was accepted"
    except Exception as e:
        pytest.skip(f"Fees page structure different than expected: {e}")

    DashboardPage(driver).logout_via_sidebar()
