"""Authenticated student shell: sidebar, topbar, logout (Layout/Sidebar.jsx)."""
from selenium.webdriver.common.by import By

from .base_page import BasePage


class AppPage(BasePage):
    SIDEBAR = (By.CSS_SELECTOR, "aside.sidebar, #sidebar")
    NAV_LINKS = (By.CSS_SELECTOR, ".sidebar-nav a.nav-link")
    LOGOUT = (By.CSS_SELECTOR, "a.nav-link.logout")

    def nav_link_count(self):
        return len(self.find_all(*self.NAV_LINKS))

    def sidebar_present(self):
        return self.exists(*self.SIDEBAR)

    def logout(self):
        el = self.wait_for(*self.LOGOUT, secs=12)
        self.driver.execute_script("arguments[0].click();", el)
        return self
