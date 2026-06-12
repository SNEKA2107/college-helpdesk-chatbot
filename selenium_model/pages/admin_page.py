from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
from .base_page import BasePage
import time

class AdminPage(BasePage):
    # Locators
    PAGE_TITLE = (By.ID, "pageTitle")
    NAV_OVERVIEW = (By.ID, "navOverview")
    NAV_REQUESTS = (By.ID, "navRequests")
    NAV_LEAVES = (By.ID, "navLeaves")
    NAV_NOTICES = (By.ID, "navNotices")
    NAV_MESSAGES = (By.ID, "navMessages")
    NAV_STUDENTS = (By.ID, "navStudents")
    
    # Stats
    STAT_STUDENTS = (By.ID, "aStatStudents")
    STAT_REQUESTS = (By.ID, "aStatRequests")
    STAT_LEAVES = (By.ID, "aStatLeaves")
    STAT_NOTICES = (By.ID, "aStatNotices")
    
    # Notice Creation
    NOTICE_TITLE = (By.ID, "nTitle")
    NOTICE_CONTENT = (By.ID, "nContent")
    NOTICE_CATEGORY = (By.ID, "nCategory")
    NOTICE_PINNED = (By.ID, "nPinned")
    NOTICE_POST_BTN = (By.XPATH, "//button[contains(text(), 'Post Notice')]")
    NOTICE_LIST = (By.ID, "adminNoticesList")
    
    # Students List Search
    STUDENT_SEARCH_INPUT = (By.ID, "studentSearchInput")
    STUDENT_SEARCH_BTN = (By.XPATH, "//button[@onclick='filterStudents()']")
    STUDENTS_BODY = (By.ID, "adminStudentsBody")
    
    # Requests / Leaves lists
    REQUESTS_BODY = (By.ID, "adminRequestsBody")
    LEAVES_BODY = (By.ID, "adminLeavesBody")
    USER_CARD_LOGOUT = (By.CSS_SELECTOR, ".sidebar-footer .logout")

    def __init__(self, driver):
        super().__init__(driver)

    def navigate(self):
        self.navigate_to("admin.html")

    def click_tab(self, tab_locator):
        el = self.wait_for_element_visible(tab_locator)
        self.driver.execute_script("arguments[0].click();", el)
        time.sleep(0.5)  # wait for tab switch animation

    def get_stats(self):
        time.sleep(1.0)  # Wait for data load
        return {
            "students": self.get_element_text(self.STAT_STUDENTS),
            "requests": self.get_element_text(self.STAT_REQUESTS),
            "leaves": self.get_element_text(self.STAT_LEAVES),
            "notices": self.get_element_text(self.STAT_NOTICES)
        }

    def create_notice(self, title, content, category="general", pin=False):
        self.click_tab(self.NAV_NOTICES)
        self.send_keys_to_element(self.NOTICE_TITLE, title)
        self.send_keys_to_element(self.NOTICE_CONTENT, content)
        
        select = Select(self.wait_for_element_visible(self.NOTICE_CATEGORY))
        select.select_by_value(category)
        
        pinned_checkbox = self.wait_for_element_presence(self.NOTICE_PINNED)
        if pin != pinned_checkbox.is_selected():
            pinned_checkbox.click()
            
        self.click_element(self.NOTICE_POST_BTN)
        time.sleep(1.0)  # wait for notice creation API and reload

    def get_first_notice_title(self):
        self.click_tab(self.NAV_NOTICES)
        return self.wait_for_element_visible((By.CSS_SELECTOR, "#adminNoticesList div style div")).text

    def delete_first_notice(self):
        self.click_tab(self.NAV_NOTICES)
        time.sleep(2.0)  # Wait for async loadNotices() API response
        delete_btn = self.wait_for_element_clickable(
            (By.CSS_SELECTOR, "#adminNoticesList button"), timeout=15
        )
        delete_btn.click()
        time.sleep(0.5)
        try:
            self.driver.switch_to.alert.accept()
        except Exception:
            pass
        time.sleep(1.0)

    def approve_first_leave(self):
        self.click_tab(self.NAV_LEAVES)
        approve_btn = self.wait_for_element_clickable((By.XPATH, "//button[contains(text(), 'Approve')]"))
        approve_btn.click()
        time.sleep(1.0)

    def reject_first_leave(self):
        self.click_tab(self.NAV_LEAVES)
        reject_btn = self.wait_for_element_clickable((By.XPATH, "//button[contains(text(), 'Reject')]"))
        reject_btn.click()
        time.sleep(1.0)

    def update_first_request_status(self, status):
        self.click_tab(self.NAV_REQUESTS)
        select_el = self.wait_for_element_visible((By.CSS_SELECTOR, "td select"))
        select = Select(select_el)
        select.select_by_value(status)
        update_btn = self.wait_for_element_clickable((By.XPATH, "//button[contains(text(), 'Update')]"))
        update_btn.click()
        time.sleep(1.0)

    def search_student(self, query):
        self.click_tab(self.NAV_STUDENTS)
        time.sleep(2.0)  # Wait for async loadStudents() to finish before filtering
        input_el = self.wait_for_element_visible(self.STUDENT_SEARCH_INPUT)
        input_el.clear()
        input_el.send_keys(query)
        self.click_element(self.STUDENT_SEARCH_BTN)
        time.sleep(1.0)

    def get_students_count(self):
        rows = self.wait_for_element_presence(self.STUDENTS_BODY).find_elements(By.TAG_NAME, "tr")
        if len(rows) == 1 and "No students found" in rows[0].text:
            return 0
        return len(rows)
