"""Authentication: login, logout, invalid login, forgot password, registration gate."""
import sys, time, uuid
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from selenium.webdriver.common.by import By
import config
from pages.login_page import LoginPage
from pages.app_page import AppPage
from pages.register_page import RegisterPage


@pytest.fixture
def driver(fresh_driver):
    # Form-typing tests need a pristine renderer (see conftest.fresh_driver).
    return fresh_driver


def _meta(rp, module, scenario, expected):
    rp("module", module); rp("scenario", scenario); rp("expected", expected)


def test_valid_student_login(driver, record_property):
    _meta(record_property, "AUTHENTICATION", "Valid student login redirects to dashboard",
          "Student logs in with 22IT101/student123 and lands on /dashboard")
    lp = LoginPage(driver).load()
    lp.login_as_student()
    path = lp.wait_until_redirected()
    record_property("actual", f"Redirected to {path}")
    assert path.startswith("/dashboard")


def test_valid_admin_login(driver, record_property):
    _meta(record_property, "AUTHENTICATION", "Valid admin login redirects to admin console",
          "Admin logs in with ADMIN01/admin@123 and lands on /admin")
    lp = LoginPage(driver).load()
    lp.login_as_admin()
    path = lp.wait_until_redirected()
    record_property("actual", f"Redirected to {path}")
    assert path.startswith("/admin")


def test_invalid_login_shows_error(driver, record_property):
    _meta(record_property, "AUTHENTICATION", "Invalid credentials show error message",
          "Wrong password is rejected with 'Invalid Student ID or password.'")
    lp = LoginPage(driver).load()
    lp.login("22IT101", "wrongpass123")
    time.sleep(2)
    msg = lp.alert_text()
    record_property("actual", f"Alert shown: '{msg}'; still on {lp.current_path()}")
    assert "invalid" in msg.lower() and lp.current_path().startswith("/login")


def test_empty_login_validation(driver, record_property):
    _meta(record_property, "AUTHENTICATION", "Empty login is blocked by client validation",
          "Submitting empty form keeps user on /login (no navigation)")
    lp = LoginPage(driver).load()
    lp.submit_empty()
    time.sleep(1)
    record_property("actual", f"Remained on {lp.current_path()}")
    assert lp.current_path().startswith("/login")


def test_forgot_password_link_present(driver, record_property):
    _meta(record_property, "AUTHENTICATION", "Forgot password link is present",
          "A 'Forgot password?' affordance exists on the login form")
    lp = LoginPage(driver).load()
    links = [a.text.strip().lower() for a in driver.find_elements(By.TAG_NAME, "a")]
    found = any("forgot" in t for t in links)
    record_property("actual", "Forgot-password link found" if found else "Link NOT found")
    assert found


def test_logout_clears_session(driver, record_property):
    _meta(record_property, "AUTHENTICATION", "Logout clears session and returns to login",
          "Clicking logout removes ca_token and redirects to /login")
    lp = LoginPage(driver).load()
    lp.login_as_student()
    lp.wait_until_redirected()
    app = AppPage(driver)
    app.logout()
    time.sleep(2)
    token = app.get_token()
    record_property("actual", f"token={token!r}; path={app.current_path()}")
    assert token is None and app.current_path().startswith("/login")


def test_new_registration_is_pending_and_cannot_login(driver, record_property):
    _meta(record_property, "AUTHENTICATION", "New registration is gated by admin approval",
          "A freshly registered student is 'pending' and cannot log in yet")
    uniq = uuid.uuid4().hex[:6].upper()
    sid = f"99QA{uniq}"
    rp_page = RegisterPage(driver).load()
    rp_page.fill(first="QA", last="Bot", sid=sid, email=f"qa{uniq}@college.edu",
                 dept="IT", pw="Testpass1!", cpw="Testpass1!", terms=True)
    rp_page.submit()
    time.sleep(2)
    submitted = rp_page.is_success()
    # Now attempt login — should be blocked (pending approval)
    lp = LoginPage(driver).load()
    lp.login(sid, "Testpass1!")
    time.sleep(2)
    msg = lp.alert_text().lower()
    blocked = "pending" in msg or "approval" in msg or lp.current_path().startswith("/login")
    record_property("actual", f"submitted={submitted}; login blocked={blocked} (msg='{msg}')")
    assert submitted and blocked
