import pytest
import time
from selenium_model.pages.login_page import LoginPage
from selenium_model.pages.dashboard_page import DashboardPage
from selenium_model.pages.admin_page import AdminPage
from selenium_model.pages.extra_pages import ChatPage, LeavePage, RequestsPage

STUDENT_ID = "22IT101"
STUDENT_PW = "student123"
ADMIN_ID   = "ADMIN01"
ADMIN_PW   = "admin@123"


def test_complete_student_workflow_journey(driver):
    login_page = LoginPage(driver)
    login_page.navigate()
    login_page.login(STUDENT_ID, STUDENT_PW)
    login_page.wait_for_login_success()

    dashboard = DashboardPage(driver)
    assert "Dashboard" in dashboard.get_page_title() or "Home" in dashboard.get_page_title()

    # Exam Timetable
    dashboard.click_nav_link(DashboardPage.NAV_EXAM)
    time.sleep(1.0)
    assert "exam.html" in driver.current_url

    # Chat bot
    dashboard.click_nav_link(DashboardPage.NAV_CHAT)
    chat = ChatPage(driver)
    chat.send_message("exam schedule")
    resp = chat.get_last_response()
    assert len(resp) > 0  # bot replied with something

    # Document request
    dashboard.click_nav_link(DashboardPage.NAV_REQUESTS)
    reqs = RequestsPage(driver)
    initial_count = reqs.get_requests_count()
    reqs.submit_new_request("Conduct Certificate", "E2E Student Journey Request", "Normal (5-7 working days)")
    assert reqs.get_requests_count() == initial_count + 1

    # Profile page
    dashboard.click_nav_link(DashboardPage.NAV_PROFILE)
    time.sleep(1.0)
    assert "profile.html" in driver.current_url

    # Logout
    dashboard.logout_via_sidebar()
    assert "login.html" in driver.current_url


def test_complete_admin_workflow_journey(driver):
    login_page = LoginPage(driver)
    login_page.navigate()
    login_page.login(ADMIN_ID, ADMIN_PW)
    login_page.wait_for_login_success()

    admin = AdminPage(driver)
    assert "Overview" in admin.get_element_text(AdminPage.PAGE_TITLE)

    # Post a general notice
    title = f"Symposium reminder {int(time.time())}"
    admin.create_notice(title, "E2E notice testing detail.", "general", False)

    # Student search
    admin.click_tab(AdminPage.NAV_STUDENTS)
    admin.search_student("22IT101")
    assert admin.get_students_count() >= 1

    # Leave approval
    admin.click_tab(AdminPage.NAV_LEAVES)
    admin.approve_first_leave()

    # Logout — wait up to 5 s for redirect to login.html
    admin.click_element(AdminPage.USER_CARD_LOGOUT)
    from selenium.webdriver.support.ui import WebDriverWait
    WebDriverWait(driver, 5).until(lambda d: "login.html" in d.current_url)
    assert "login.html" in driver.current_url
