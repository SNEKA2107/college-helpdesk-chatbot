import time
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By

class BasePage:
    def __init__(self, driver):
        self.driver = driver
        self.base_url = "http://localhost:5000"

    def navigate_to(self, path=""):
        url = f"{self.base_url}/{path}".rstrip('/')
        self.driver.get(url)
        self.wait_for_loader()

    def wait_for_loader(self):
        """Waits for the GSAP page loader on index.html to finish if present."""
        try:
            # Check if loader is in DOM and visible
            loader = self.driver.find_elements(By.ID, "loader")
            if loader and loader[0].is_displayed():
                # Wait for it to disappear (max 15s)
                WebDriverWait(self.driver, 15).until(
                    EC.invisibility_of_element_located((By.ID, "loader"))
                )
        except Exception:
            pass

    def wait_for_element_visible(self, locator, timeout=10):
        return WebDriverWait(self.driver, timeout).until(
            EC.visibility_of_element_located(locator)
        )

    def wait_for_element_clickable(self, locator, timeout=10):
        return WebDriverWait(self.driver, timeout).until(
            EC.element_to_be_clickable(locator)
        )

    def wait_for_element_presence(self, locator, timeout=10):
        return WebDriverWait(self.driver, timeout).until(
            EC.presence_of_element_located(locator)
        )

    def click_element(self, locator, timeout=10):
        el = self.wait_for_element_clickable(locator, timeout)
        el.click()

    def send_keys_to_element(self, locator, text, timeout=10):
        el = self.wait_for_element_visible(locator, timeout)
        el.clear()
        el.send_keys(text)

    def get_element_text(self, locator, timeout=10):
        el = self.wait_for_element_visible(locator, timeout)
        return el.text

    def logout(self):
        """Force logout: clear localStorage auth tokens, navigate to login.html."""
        self.driver.execute_script(
            "localStorage.removeItem('ca_token');"
            "localStorage.removeItem('ca_user');"
        )
        self.driver.get(f"{self.base_url}/login.html")
        self.wait_for_element_visible((By.ID, "studentId"), timeout=10)

    def inject_auth_token(self, token, user_data):
        """Bypasses login UI by directly placing auth credentials in localStorage."""
        import json
        self.driver.execute_script(
            f"window.localStorage.setItem('ca_token', '{token}');"
            f"window.localStorage.setItem('ca_user', '{json.dumps(user_data)}');"
        )
        self.driver.refresh()
        self.wait_for_loader()
