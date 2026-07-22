"""Admin console page object (frontend/src/pages/Admin.jsx + admin/*Tab.jsx)."""
from selenium.webdriver.common.by import By

from .base_page import BasePage


class AdminPage(BasePage):
    TABS = (By.CSS_SELECTOR, "[class*='tab'], button[role='tab'], nav button")

    def load(self):
        self.open("/admin")
        return self

    def heading_text(self):
        for tag in ("h1", "h2"):
            els = self.find_all(By.TAG_NAME, tag)
            if els:
                return els[0].text
        return ""

    def clickable_count(self):
        return len(self.find_all(By.TAG_NAME, "button"))
