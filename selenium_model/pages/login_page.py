"""Login page object (frontend/src/pages/Login.jsx)."""
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

from .base_page import BasePage


class LoginPage(BasePage):
    ID_INPUT = (By.CSS_SELECTOR, "input[placeholder='e.g. 22IT101']")
    PASS_INPUT = (By.CSS_SELECTOR, "input[placeholder='Enter your password']")
    SUBMIT = (By.CSS_SELECTOR, "button[type='submit']")
    ALERT = (By.CSS_SELECTOR, "[class*='alertBox']")

    def load(self):
        # Shared browser may carry a session from a prior test → clear it first,
        # otherwise the RedirectIfAuthed guard bounces us off /login.
        self.open("/login")
        self.clear_session()
        self.open("/login")
        self.wait_for(*self.ID_INPUT)
        return self

    def login(self, student_id, password):
        # Use React-native value setting so the controlled-input state is updated
        # reliably even after SPA redirects (plain send_keys can be dropped).
        self.react_type(*self.ID_INPUT, student_id)
        self.react_type(*self.PASS_INPUT, password)
        self.find(*self.SUBMIT).click()
        return self

    def login_as_student(self):
        import config
        return self.login(config.STUDENT_ID, config.STUDENT_PASSWORD)

    def login_as_admin(self):
        import config
        return self.login(config.ADMIN_ID, config.ADMIN_PASSWORD)

    def submit_empty(self):
        self.wait_for(*self.SUBMIT)
        self.find(*self.SUBMIT).click()
        return self

    def alert_text(self):
        # The alert box is animated/hidden via CSS until populated, and Selenium's
        # .text returns "" for non-displayed elements — read textContent instead.
        try:
            el = self.find(*self.ALERT)
            return (el.get_attribute("textContent") or "").strip()
        except Exception:
            return ""

    def wait_until_redirected(self, secs=15):
        self.wait(secs).until(lambda d: "/login" not in d.current_url)
        return self.current_path()
