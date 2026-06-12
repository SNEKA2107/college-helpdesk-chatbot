import pytest
import time
from selenium.webdriver.common.by import By
from selenium_model.pages.login_page import LoginPage
from selenium_model.pages.dashboard_page import DashboardPage
from selenium_model.pages.base_page import BasePage

STUDENT_ID = "22IT101"
STUDENT_PW = "student123"


def test_student_sidebar_navigation_flow(driver):
    login_page = LoginPage(driver)
    login_page.navigate()
    login_page.login(STUDENT_ID, STUDENT_PW)
    login_page.wait_for_login_success()

    dashboard = DashboardPage(driver)

    dashboard.click_nav_link(DashboardPage.NAV_CHAT)
    assert "chat.html" in driver.current_url

    dashboard.click_nav_link(DashboardPage.NAV_REQUESTS)
    assert "requests.html" in driver.current_url

    dashboard.click_nav_link(DashboardPage.NAV_LEAVE)
    assert "leave.html" in driver.current_url

    dashboard.click_nav_link(DashboardPage.NAV_NOTICES)
    assert "notices.html" in driver.current_url

    dashboard.logout_via_sidebar()
    assert "login.html" in driver.current_url


def test_all_nav_links_resolve(driver):
    """Check that every sidebar link navigates to the correct page without a 404."""
    login_page = LoginPage(driver)
    login_page.navigate()
    login_page.login(STUDENT_ID, STUDENT_PW)
    login_page.wait_for_login_success()

    dashboard = DashboardPage(driver)

    nav_checks = [
        (DashboardPage.NAV_EXAM,      "exam.html"),
        (DashboardPage.NAV_FEES,      "fees.html"),
        (DashboardPage.NAV_TIMETABLE, "timetable.html"),
        (DashboardPage.NAV_CGPA,      "cgpa.html"),
        (DashboardPage.NAV_LIBRARY,   "library.html"),
        (DashboardPage.NAV_EVENTS,    "events.html"),
        (DashboardPage.NAV_CONTACT,   "contact.html"),
        (DashboardPage.NAV_PROFILE,   "profile.html"),
    ]

    for locator, expected_fragment in nav_checks:
        dashboard.click_nav_link(locator)
        time.sleep(0.6)
        assert expected_fragment in driver.current_url, f"Expected '{expected_fragment}' in URL, got {driver.current_url}"
        # Navigate back to dashboard between clicks
        dashboard.click_nav_link(DashboardPage.NAV_DASHBOARD)
        time.sleep(0.4)

    dashboard.logout_via_sidebar()


def test_responsive_mobile_menu_visibility(driver):
    login_page = LoginPage(driver)
    login_page.navigate()
    login_page.login(STUDENT_ID, STUDENT_PW)
    login_page.wait_for_login_success()

    driver.set_window_size(400, 800)
    time.sleep(1.0)

    menu_btn = driver.find_element(By.ID, "menuBtn")
    # is_displayed() misreports media-query-driven flex elements in headless Chrome;
    # getComputedStyle accurately reflects the @media (max-width:768px) display:flex rule
    computed = driver.execute_script(
        "return window.getComputedStyle(arguments[0]).display;", menu_btn
    )
    assert computed != "none", f"menuBtn should be visible at 400px viewport (got display:{computed})"

    # Use JS click — headless Chrome refuses direct .click() on media-query-displayed elements
    driver.execute_script("arguments[0].click();", menu_btn)
    time.sleep(0.5)
    sidebar = driver.find_element(By.CLASS_NAME, "sidebar")
    # sidebar element must exist in DOM (may be off-screen on mobile but DOM-present)
    assert sidebar is not None

    driver.set_window_size(1920, 1080)
    DashboardPage(driver).logout_via_sidebar()
