"""Register page object (frontend/src/pages/Register.jsx)."""
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select

from .base_page import BasePage


class RegisterPage(BasePage):
    FIRST = (By.CSS_SELECTOR, "input[placeholder='Sneka']")
    LAST = (By.CSS_SELECTOR, "input[placeholder='S']")
    SID = (By.CSS_SELECTOR, "input[placeholder='e.g. 22IT101']")
    EMAIL = (By.CSS_SELECTOR, "input[type='email']")
    DEPT = (By.CSS_SELECTOR, "select")
    PASS = (By.CSS_SELECTOR, "input[placeholder='Min 8 characters']")
    CPASS = (By.CSS_SELECTOR, "input[placeholder='Repeat password']")
    TERMS = (By.CSS_SELECTOR, "input[type='checkbox']")
    SUBMIT = (By.CSS_SELECTOR, "button[class*='btnSubmit']")
    SUCCESS = (By.CSS_SELECTOR, "[class*='successState']")
    FIELD_ERRORS_SHOWN = (By.CSS_SELECTOR, "[class*='formError'][class*='show']")

    def load(self):
        # Clear any prior session so RedirectIfAuthed doesn't bounce us away.
        self.open("/register")
        self.clear_session()
        self.open("/register")
        self.wait_for(*self.FIRST)
        return self

    def fill(self, first="", last="", sid="", email="", dept="", pw="", cpw="", terms=False):
        # React-native value setting (controlled inputs) for reliability.
        self.react_type(*self.FIRST, first)
        self.react_type(*self.LAST, last)
        self.react_type(*self.SID, sid)
        self.react_type(*self.EMAIL, email)
        if dept:
            self.react_type(*self.DEPT, dept)  # <option> value == visible text
        self.react_type(*self.PASS, pw)
        self.react_type(*self.CPASS, cpw)
        cb = self.find(*self.TERMS)
        if terms and not cb.is_selected():
            self.driver.execute_script("arguments[0].click();", cb)
        return self

    def submit(self):
        self.find(*self.SUBMIT).click()
        return self

    def is_success(self):
        return self.exists(*self.SUCCESS)

    def visible_error_count(self):
        return len(self.find_all(*self.FIELD_ERRORS_SHOWN))
