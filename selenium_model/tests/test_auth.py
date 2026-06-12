import pytest
import time
from selenium_model.pages.login_page import LoginPage
from selenium_model.pages.dashboard_page import DashboardPage
from selenium_model.pages.admin_page import AdminPage

STUDENT_ID  = "22IT101"
STUDENT_PW  = "student123"
ADMIN_ID    = "ADMIN01"
ADMIN_PW    = "admin@123"


def test_valid_student_login(driver):
    lp = LoginPage(driver)
    lp.navigate()
    lp.login(STUDENT_ID, STUDENT_PW)
    lp.wait_for_login_success()
    assert "dashboard.html" in driver.current_url
    # logout via sidebar
    DashboardPage(driver).logout_via_sidebar()
    assert "login.html" in driver.current_url


def test_valid_admin_login(driver):
    lp = LoginPage(driver)
    lp.navigate()
    lp.login(ADMIN_ID, ADMIN_PW)
    lp.wait_for_login_success()
    assert "admin.html" in driver.current_url
    # verify page title
    title = AdminPage(driver).get_element_text(AdminPage.PAGE_TITLE)
    assert "Overview" in title
    AdminPage(driver).click_element(AdminPage.USER_CARD_LOGOUT)
    assert "login.html" in driver.current_url


def test_invalid_login_wrong_password(driver):
    lp = LoginPage(driver)
    lp.navigate()
    lp.login(STUDENT_ID, "wrongpassword123")
    assert lp.is_alert_visible()
    assert "Invalid" in lp.get_alert_text()


def test_invalid_login_wrong_id(driver):
    lp = LoginPage(driver)
    lp.navigate()
    lp.login("WRONG999", STUDENT_PW)
    assert lp.is_alert_visible()


def test_invalid_login_empty_fields(driver):
    lp = LoginPage(driver)
    lp.navigate()
    lp.login("", "")
    assert lp.get_student_id_error_text() == "Please enter your Student ID"
    assert lp.get_password_error_text() == "Please enter your password"


def test_password_visibility_toggle(driver):
    lp = LoginPage(driver)
    lp.navigate()
    lp.send_keys_to_element(LoginPage.PASSWORD_INPUT, "mysecretpw")
    assert lp.get_password_field_type() == "password"
    lp.toggle_password_visibility()
    assert lp.get_password_field_type() == "text"
    lp.toggle_password_visibility()
    assert lp.get_password_field_type() == "password"


def test_login_theme_toggles(driver):
    lp = LoginPage(driver)
    lp.navigate()
    t1 = lp.switch_theme()
    assert "Light" in t1 or "Night" in t1
    t2 = lp.switch_theme()
    assert "Night" in t2 or "Dark" in t2


def test_register_link_visible(driver):
    lp = LoginPage(driver)
    lp.navigate()
    link = driver.find_element(*LoginPage.REGISTER_LINK)
    assert link.is_displayed()
    link.click()
    assert "register.html" in driver.current_url


def test_already_logged_in_redirects(driver):
    """If JWT is in localStorage, visiting login.html should redirect to dashboard."""
    lp = LoginPage(driver)
    lp.navigate()
    lp.login(STUDENT_ID, STUDENT_PW)
    lp.wait_for_login_success()
    # Now navigate back to login — should immediately redirect away
    driver.get("http://localhost:5000/login.html")
    time.sleep(1.5)
    assert "login.html" not in driver.current_url
    # Cleanup
    DashboardPage(driver).logout_via_sidebar()
