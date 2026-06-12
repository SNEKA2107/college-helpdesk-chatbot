from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from .base_page import BasePage

class LoginPage(BasePage):
    # Locators
    STUDENT_ID_INPUT = (By.ID, "studentId")
    PASSWORD_INPUT = (By.ID, "password")
    LOGIN_BUTTON = (By.ID, "loginBtn")
    ALERT_BOX = (By.ID, "alertBox")
    PASSWORD_TOGGLE = (By.ID, "passToggle")
    THEME_TOGGLE = (By.ID, "themeToggleBtn")
    STUDENT_ID_ERROR = (By.ID, "idErr")
    PASSWORD_ERROR = (By.ID, "passErr")
    REGISTER_LINK = (By.LINK_TEXT, "Register here")

    def __init__(self, driver):
        super().__init__(driver)

    def navigate(self):
        self.navigate_to("login.html")

    def login(self, student_id, password, press_enter=False):
        # Ensure we're on the login page before filling the form
        if "login.html" not in self.driver.current_url:
            self.navigate()
        if student_id is not None:
            self.send_keys_to_element(self.STUDENT_ID_INPUT, student_id)
        if password is not None:
            self.send_keys_to_element(self.PASSWORD_INPUT, password)
            
        if press_enter:
            self.wait_for_element_visible(self.PASSWORD_INPUT).send_keys(Keys.ENTER)
        else:
            self.click_element(self.LOGIN_BUTTON)

    def wait_for_login_success(self, timeout=10):
        """Waits until the URL switches to either the student dashboard or the admin portal."""
        WebDriverWait(self.driver, timeout).until(
            lambda d: "dashboard.html" in d.current_url or "admin.html" in d.current_url
        )

    def toggle_password_visibility(self):
        self.click_element(self.PASSWORD_TOGGLE)

    def get_password_field_type(self):
        return self.wait_for_element_presence(self.PASSWORD_INPUT).get_attribute("type")

    def get_alert_text(self):
        return self.get_element_text(self.ALERT_BOX)

    def is_alert_visible(self, timeout=5):
        try:
            # Wait for alert box to contain 'show' in its class
            WebDriverWait(self.driver, timeout).until(
                lambda d: "show" in d.find_element(*self.ALERT_BOX).get_attribute("class")
            )
            return True
        except Exception:
            return False

    def get_student_id_error_text(self):
        return self.get_element_text(self.STUDENT_ID_ERROR)

    def get_password_error_text(self):
        return self.get_element_text(self.PASSWORD_ERROR)

    def switch_theme(self):
        self.click_element(self.THEME_TOGGLE)
        return self.get_element_text(self.THEME_TOGGLE)
