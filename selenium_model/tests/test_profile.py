"""
Profile page tests: verify data display, edit section, and section visibility.
Avatar element is #profileAvatar (inline-styled div).
Edit button text is '💾 Save Changes'.
"""
import pytest
import time
from selenium.webdriver.common.by import By
from selenium_model.pages.login_page import LoginPage
from selenium_model.pages.dashboard_page import DashboardPage

STUDENT_ID = "22IT101"
STUDENT_PW = "student123"


def _login_student(driver):
    lp = LoginPage(driver)
    lp.navigate()
    lp.login(STUDENT_ID, STUDENT_PW)
    lp.wait_for_login_success()


def test_profile_page_loads_student_data(driver):
    _login_student(driver)
    driver.get("http://localhost:5000/profile.html")
    time.sleep(1.5)

    body_text = driver.find_element(By.TAG_NAME, "body").text
    assert STUDENT_ID in body_text, "Student ID not rendered on profile page"

    DashboardPage(driver).logout_via_sidebar()


def test_profile_avatar_visible(driver):
    """Profile avatar is a div with id='profileAvatar' (no class)."""
    _login_student(driver)
    driver.get("http://localhost:5000/profile.html")
    time.sleep(1.5)

    avatar = driver.find_element(By.ID, "profileAvatar")
    assert avatar.is_displayed(), "profileAvatar div is not visible"

    DashboardPage(driver).logout_via_sidebar()


def test_profile_contact_section_visible(driver):
    _login_student(driver)
    driver.get("http://localhost:5000/profile.html")
    time.sleep(1.5)

    body_text = driver.find_element(By.TAG_NAME, "body").text
    assert any(kw in body_text for kw in ["Email", "Phone", "Contact"]), (
        "No contact information section found on profile page"
    )

    DashboardPage(driver).logout_via_sidebar()


def test_profile_academic_section_visible(driver):
    _login_student(driver)
    driver.get("http://localhost:5000/profile.html")
    time.sleep(1.5)

    body_text = driver.find_element(By.TAG_NAME, "body").text
    assert any(kw in body_text for kw in ["Department", "Semester", "Year", "Branch"]), (
        "No academic information section found on profile page"
    )

    DashboardPage(driver).logout_via_sidebar()


def test_profile_save_button_present(driver):
    """Profile edit form has a '💾 Save Changes' button."""
    _login_student(driver)
    driver.get("http://localhost:5000/profile.html")
    time.sleep(1.5)

    save_btns = driver.find_elements(By.XPATH, "//button[contains(text(),'Save') or contains(text(),'Update')]")
    assert len(save_btns) > 0, "No Save/Update button found on profile page"

    DashboardPage(driver).logout_via_sidebar()


def test_profile_name_field_editable(driver):
    """Edit profile section: name input field exists and is editable."""
    _login_student(driver)
    driver.get("http://localhost:5000/profile.html")
    time.sleep(1.5)

    name_input = driver.find_element(By.ID, "editName")
    assert name_input.is_displayed(), "editName input not visible"
    name_input.clear()
    name_input.send_keys("Test Name Change")
    assert name_input.get_attribute("value") == "Test Name Change"

    DashboardPage(driver).logout_via_sidebar()


def test_profile_nav_link_works(driver):
    _login_student(driver)
    dashboard = DashboardPage(driver)
    dashboard.navigate()
    dashboard.click_nav_link(DashboardPage.NAV_PROFILE)
    time.sleep(1.0)
    assert "profile.html" in driver.current_url

    DashboardPage(driver).logout_via_sidebar()
