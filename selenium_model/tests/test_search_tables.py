import pytest
import time
from selenium.webdriver.common.by import By
from selenium_model.pages.login_page import LoginPage
from selenium_model.pages.admin_page import AdminPage
from selenium_model.pages.dashboard_page import DashboardPage

STUDENT_ID = "22IT101"
STUDENT_PW = "student123"
ADMIN_ID   = "ADMIN01"
ADMIN_PW   = "admin@123"


def test_library_book_search_exact_and_partial(driver):
    login_page = LoginPage(driver)
    login_page.navigate()
    login_page.login(STUDENT_ID, STUDENT_PW)
    login_page.wait_for_login_success()

    driver.get("http://localhost:5000/library.html")
    time.sleep(1.0)

    search_input = driver.find_element(By.ID, "bookSearch")
    search_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Search')]")

    # 1. Exact match
    search_input.clear()
    search_input.send_keys("Introduction to Java")
    search_btn.click()
    time.sleep(1.0)
    rows = driver.find_elements(By.CSS_SELECTOR, "#booksBody tr")
    assert len(rows) >= 1
    assert "Introduction to Java" in rows[0].text

    # 2. Partial match
    search_input.clear()
    search_input.send_keys("Net")
    search_btn.click()
    time.sleep(1.0)
    rows = driver.find_elements(By.CSS_SELECTOR, "#booksBody tr")
    assert any("Computer Networks" in row.text or "Net" in row.text for row in rows)

    # 3. Empty search returns full list
    search_input.clear()
    search_btn.click()
    time.sleep(1.0)
    rows = driver.find_elements(By.CSS_SELECTOR, "#booksBody tr")
    assert len(rows) > 1

    DashboardPage(driver).logout_via_sidebar()


def test_admin_student_directory_search(driver):
    login_page = LoginPage(driver)
    login_page.navigate()
    login_page.login(ADMIN_ID, ADMIN_PW)
    login_page.wait_for_login_success()

    admin_page = AdminPage(driver)
    admin_page.click_tab(AdminPage.NAV_STUDENTS)

    # 1. Exact match
    admin_page.search_student("22IT101")
    assert admin_page.get_students_count() >= 1

    # 2. Partial match (first name)
    admin_page.search_student("Sneka")
    assert admin_page.get_students_count() >= 1

    # 3. Non-existent returns zero
    admin_page.search_student("NONEXISTENTSTUDENTID999")
    assert admin_page.get_students_count() == 0

    admin_page.click_element(AdminPage.USER_CARD_LOGOUT)
    assert "login.html" in driver.current_url
