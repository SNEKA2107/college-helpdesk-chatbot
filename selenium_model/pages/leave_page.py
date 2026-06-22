"""Leave application page object (frontend/src/pages/Leave.jsx).

React 18 tracks controlled-input values, so a plain `el.value = x` is ignored.
We set values through the prototype's native setter and then fire input+change,
which is what React's synthetic event system listens for.
"""
import time
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select

from .base_page import BasePage

_REACT_SET = """
const el = arguments[0], val = arguments[1];
const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
                                      : window.HTMLInputElement.prototype;
const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
setter.call(el, val);
el.dispatchEvent(new Event('input',  {bubbles: true}));
el.dispatchEvent(new Event('change', {bubbles: true}));
"""


class LeavePage(BasePage):
    SELECTS = (By.CSS_SELECTOR, "select.form-select")
    DATES = (By.CSS_SELECTOR, "input[type='date']")
    REASON = (By.CSS_SELECTOR, "textarea.form-textarea")
    SUBMIT = (By.XPATH, "//button[contains(.,'Submit Application')]")
    SUCCESS_TEXT = "leave application submitted"

    def load(self):
        self.open("/leave")
        self.wait_for(*self.SUBMIT)
        return self

    def react_set(self, el, value):
        self.driver.execute_script(_REACT_SET, el, value)

    def fill_valid(self, reason="Automated QA leave request.", days_ahead=5, span=1):
        # leaveType is the last <select> (after dept + semester)
        sel = self.find_all(*self.SELECTS)[-1]
        Select(sel).select_by_index(1)
        self.react_set(sel, sel.get_attribute("value"))  # reinforce for React state
        frm = time.strftime("%Y-%m-%d", time.localtime(time.time() + days_ahead * 86400))
        to = time.strftime("%Y-%m-%d", time.localtime(time.time() + (days_ahead + span) * 86400))
        dates = self.find_all(*self.DATES)
        self.react_set(dates[0], frm)
        self.react_set(dates[1], to)
        ta = self.find(*self.REASON)
        ta.clear()
        ta.send_keys(reason)
        return self

    def submit(self):
        btn = self.find(*self.SUBMIT)
        self.driver.execute_script("arguments[0].click();", btn)
        return self

    def is_submitted(self, secs=6):
        end = time.time() + secs
        while time.time() < end:
            if self.SUCCESS_TEXT in self.body_text().lower():
                return True
            time.sleep(0.5)
        return False


def submit_leave(driver, reason="Automated QA leave request.", days_ahead=5, span=1):
    """Convenience: open /leave, fill a valid application and submit it."""
    lp = LeavePage(driver).load()
    time.sleep(1.0)
    lp.fill_valid(reason=reason, days_ahead=days_ahead, span=span)
    lp.submit()
    return lp
