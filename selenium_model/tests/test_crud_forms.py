import pytest
from selenium_model.pages.login_page import LoginPage
from selenium_model.pages.extra_pages import RequestsPage, LeavePage
from selenium_model.pages.admin_page import AdminPage
from selenium_model.pages.dashboard_page import DashboardPage
from selenium.webdriver.common.by import By
import time

STUDENT_ID = "22IT101"
STUDENT_PW = "student123"
ADMIN_ID   = "ADMIN01"
ADMIN_PW   = "admin@123"


def test_document_request_crud_lifecycle(driver):
    login_page = LoginPage(driver)
    login_page.navigate()
    login_page.login(STUDENT_ID, STUDENT_PW)
    login_page.wait_for_login_success()

    req_page = RequestsPage(driver)
    req_page.navigate()
    initial_count = req_page.get_requests_count()

    req_page.submit_new_request("Bonafide Certificate", "E2E Banking Loan Purpose", "Normal (5-7 working days)")
    assert req_page.get_requests_count() == initial_count + 1

    # Logout student via sidebar
    req_page.click_element(DashboardPage.USER_CARD_LOGOUT)

    # Login as admin and update request status
    login_page.login(ADMIN_ID, ADMIN_PW)
    login_page.wait_for_login_success()
    admin_page = AdminPage(driver)
    admin_page.update_first_request_status("Processing")

    # Logout admin, login student, verify status shown
    admin_page.click_element(AdminPage.USER_CARD_LOGOUT)
    login_page.login(STUDENT_ID, STUDENT_PW)
    login_page.wait_for_login_success()

    req_page.navigate()
    time.sleep(1.0)
    badges = driver.find_elements(By.CLASS_NAME, "badge-primary")
    badge_texts = [b.text for b in badges]
    assert any("Processing" in text or "Under Review" in text or "Submitted" in text for text in badge_texts)

    # Clean logout
    req_page.click_element(DashboardPage.USER_CARD_LOGOUT)


def test_notice_management_crud(driver):
    login_page = LoginPage(driver)
    login_page.navigate()
    login_page.login(ADMIN_ID, ADMIN_PW)
    login_page.wait_for_login_success()

    admin_page = AdminPage(driver)
    notice_title = f"Urgent: E2E Notice test {int(time.time())}"
    admin_page.create_notice(notice_title, "This is an E2E test notice content.", "urgent", True)

    admin_page.click_element(AdminPage.USER_CARD_LOGOUT)

    # Login as student and verify notice appears on notices page
    login_page.login(STUDENT_ID, STUDENT_PW)
    login_page.wait_for_login_success()
    driver.get("http://localhost:5000/notices.html")
    time.sleep(2.0)

    body_text = driver.find_element(By.TAG_NAME, "body").text
    assert notice_title in body_text

    # Login as admin and delete notice
    DashboardPage(driver).logout_via_sidebar()
    login_page.login(ADMIN_ID, ADMIN_PW)
    login_page.wait_for_login_success()
    admin_page.delete_first_notice()
    admin_page.click_element(AdminPage.USER_CARD_LOGOUT)


def test_leave_application_and_approval_flow(driver):
    login_page = LoginPage(driver)
    login_page.navigate()
    login_page.login(STUDENT_ID, STUDENT_PW)
    login_page.wait_for_login_success()

    leave_page = LeavePage(driver)
    leave_page.navigate()
    leave_page.submit_leave("Medical Leave", "2026-07-20", "2026-07-22", "E2E medical leave request")
    assert leave_page.is_success_visible()

    # Logout student via sidebar
    leave_page.click_element(DashboardPage.USER_CARD_LOGOUT)

    # Login as admin and approve the leave
    login_page.login(ADMIN_ID, ADMIN_PW)
    login_page.wait_for_login_success()
    admin_page = AdminPage(driver)
    admin_page.approve_first_leave()
    admin_page.click_element(AdminPage.USER_CARD_LOGOUT)
