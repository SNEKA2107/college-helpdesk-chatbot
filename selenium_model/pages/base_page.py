"""Base page object: shared navigation, waits and session helpers."""
import time
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

import config


class BasePage:
    def __init__(self, driver):
        self.driver = driver

    # ---- navigation -------------------------------------------------
    def open(self, path="/"):
        self.driver.get(config.BASE_URL + path)
        return self

    def goto_hash_route(self, path):
        """SPA route change without a full reload (preserves localStorage)."""
        self.driver.get(config.BASE_URL + path)
        return self

    def current_path(self):
        url = self.driver.current_url
        return url.replace(config.BASE_URL, "") or "/"

    def wait(self, secs=10):
        return WebDriverWait(self.driver, secs)

    def wait_for(self, by, value, secs=10):
        return self.wait(secs).until(EC.presence_of_element_located((by, value)))

    def find(self, by, value):
        return self.driver.find_element(by, value)

    def find_all(self, by, value):
        return self.driver.find_elements(by, value)

    def exists(self, by, value):
        return len(self.driver.find_elements(by, value)) > 0

    # React 18 controlled inputs ignore a plain send_keys/value write unless the
    # input event is dispatched through the prototype's native value setter.
    _REACT_SET = (
        "const el=arguments[0],val=arguments[1];"
        "const proto=el.tagName==='SELECT'?window.HTMLSelectElement.prototype"
        ":el.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype"
        ":window.HTMLInputElement.prototype;"
        "Object.getOwnPropertyDescriptor(proto,'value').set.call(el,val);"
        "el.dispatchEvent(new Event('input',{bubbles:true}));"
        "el.dispatchEvent(new Event('change',{bubbles:true}));"
    )

    _REDISPATCH = ("arguments[0].dispatchEvent(new Event('input',{bubbles:true}));"
                   "arguments[0].dispatchEvent(new Event('change',{bubbles:true}));")

    def react_type(self, by, value, text):
        text = str(text)
        el = self.wait_for(by, value)
        # Set value via the native setter, then re-dispatch input/change after a
        # short settle. The re-dispatch covers the race where React hasn't yet
        # attached its onChange handler on a freshly-mounted form (the event would
        # otherwise be lost and the controlled state stays empty).
        for attempt in range(4):
            self.driver.execute_script(self._REACT_SET, el, text)
            time.sleep(0.12)
            self.driver.execute_script(self._REDISPATCH, el)
            if (el.get_attribute("value") or "") == text:
                if attempt:  # one extra dispatch once stable to be safe
                    self.driver.execute_script(self._REDISPATCH, el)
                break
            time.sleep(0.15)
        return el

    def body_text(self):
        try:
            return self.driver.find_element(By.TAG_NAME, "body").text
        except Exception:
            return ""

    def title(self):
        return self.driver.title

    # ---- session helpers -------------------------------------------
    def set_session(self, user_json, token):
        self.driver.execute_script(
            "localStorage.setItem('ca_user', arguments[0]);"
            "localStorage.setItem('ca_token', arguments[1]);",
            user_json, token,
        )

    def clear_session(self):
        self.driver.execute_script("localStorage.clear();")

    def get_token(self):
        return self.driver.execute_script("return localStorage.getItem('ca_token');")

    # ---- timing -----------------------------------------------------
    def load_time_ms(self):
        """navigationStart→loadEventEnd in ms via the Navigation Timing API."""
        try:
            t = self.driver.execute_script(
                "var t=performance.timing;return t.loadEventEnd-t.navigationStart;")
            return int(t) if t and t > 0 else None
        except Exception:
            return None
