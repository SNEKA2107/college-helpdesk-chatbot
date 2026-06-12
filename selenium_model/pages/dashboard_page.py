from selenium.webdriver.common.by import By
from .base_page import BasePage

class DashboardPage(BasePage):
    # Locators
    PAGE_TITLE = (By.CLASS_NAME, "page-title")
    STAT_TOTAL = (By.ID, "statTotal")
    STAT_COMPLETED = (By.ID, "statCompleted")
    STAT_IN_PROGRESS = (By.ID, "statInProgress")
    STAT_NOTICES = (By.ID, "statNotices")
    
    # Sidebar Nav links
    NAV_DASHBOARD = (By.XPATH, "//a[contains(@href, 'dashboard.html')]")
    NAV_CHAT = (By.XPATH, "//a[contains(@href, 'chat.html')]")
    NAV_REQUESTS = (By.XPATH, "//a[contains(@href, 'requests.html')]")
    NAV_ATTENDANCE = (By.XPATH, "//a[contains(@href, 'attendance.html')]")
    NAV_MARKSHEET = (By.XPATH, "//a[contains(@href, 'status.html')]")
    NAV_EXAM = (By.XPATH, "//a[contains(@href, 'exam.html')]")
    NAV_FEES = (By.XPATH, "//a[contains(@href, 'fees.html')]")
    NAV_TIMETABLE = (By.XPATH, "//a[contains(@href, 'timetable.html')]")
    NAV_CGPA = (By.XPATH, "//a[contains(@href, 'cgpa.html')]")
    NAV_LEAVE = (By.XPATH, "//a[contains(@href, 'leave.html')]")
    NAV_OD = (By.XPATH, "//a[contains(@href, 'od.html')]")
    NAV_EVENTS = (By.XPATH, "//a[contains(@href, 'events.html')]")
    NAV_NOTICES = (By.XPATH, "//a[contains(@href, 'notices.html')]")
    NAV_LIBRARY = (By.XPATH, "//a[contains(@href, 'library.html')]")
    NAV_CONTACT = (By.XPATH, "//a[contains(@href, 'contact.html')]")
    NAV_PROFILE = (By.XPATH, "//a[contains(@href, 'profile.html')]")
    
    # Logout is sidebar-only (no topbar logout button in the HTML)
    TOPBAR_LOGOUT_BTN = (By.CSS_SELECTOR, ".sidebar-footer .logout")
    USER_CARD_LOGOUT  = (By.CSS_SELECTOR, ".sidebar-footer .logout")
    THEME_TOGGLE = (By.ID, "themeToggleBtn")

    def __init__(self, driver):
        super().__init__(driver)

    def navigate(self):
        self.navigate_to("dashboard.html")

    def get_page_title(self):
        return self.get_element_text(self.PAGE_TITLE)

    def get_stats(self):
        # Wait a moment for dynamic API loading
        time_to_wait = 2.0
        import time
        time.sleep(time_to_wait)
        return {
            "total": self.get_element_text(self.STAT_TOTAL),
            "completed": self.get_element_text(self.STAT_COMPLETED),
            "in_progress": self.get_element_text(self.STAT_IN_PROGRESS),
            "notices": self.get_element_text(self.STAT_NOTICES)
        }

    def click_nav_link(self, nav_locator):
        self.click_element(nav_locator)

    def logout_via_topbar(self):
        self.logout()

    def logout_via_sidebar(self):
        self.logout()

    def switch_theme(self):
        self.click_element(self.THEME_TOGGLE)
        return self.get_element_text(self.THEME_TOGGLE)
