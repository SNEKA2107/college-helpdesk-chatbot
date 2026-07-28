"""Base page object — every other page object inherits these primitives."""
from __future__ import annotations

import time

from selenium.common.exceptions import (
    NoSuchElementException, StaleElementReferenceException, TimeoutException,
    WebDriverException,
)
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait

import config


class BasePage:
    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, config.EXPLICIT_WAIT)
        self.last_click_block = ""   # why the most recent click() was refused

    # ── navigation ──────────────────────────────────────────────────────────
    def go(self, path: str):
        """Navigate to an app path and wait for React to mount."""
        self.driver.get(config.BASE_URL + path)
        self.wait_for_app()
        return self

    def wait_for_app(self, timeout: int = None):
        """Wait until the SPA has rendered something other than its loading shell."""
        deadline = time.time() + (timeout or config.EXPLICIT_WAIT)
        while time.time() < deadline:
            try:
                root = self.driver.find_element(By.ID, "root")
                text = (root.text or "").strip()
                if text and text != "Loading…" and len(text) > 2:
                    return True
            except (NoSuchElementException, StaleElementReferenceException, WebDriverException):
                pass
            time.sleep(0.2)
        return False

    @property
    def path(self) -> str:
        url = self.driver.current_url
        return url.replace(config.BASE_URL, "") or "/"

    def wait_for_path(self, expected: str, timeout: int = None) -> bool:
        deadline = time.time() + (timeout or config.EXPLICIT_WAIT)
        while time.time() < deadline:
            if self.path.startswith(expected):
                return True
            time.sleep(0.15)
        return False

    # ── element access (never raises) ───────────────────────────────────────
    def find(self, css: str):
        try:
            return self.driver.find_element(By.CSS_SELECTOR, css)
        except (NoSuchElementException, WebDriverException):
            return None

    def all(self, css: str) -> list:
        try:
            return self.driver.find_elements(By.CSS_SELECTOR, css)
        except WebDriverException:
            return []

    def visible(self, css: str, timeout: int = None):
        try:
            return WebDriverWait(self.driver, timeout or config.EXPLICIT_WAIT).until(
                EC.visibility_of_element_located((By.CSS_SELECTOR, css)))
        except (TimeoutException, WebDriverException):
            return None

    def by_text(self, tag: str, text: str, exact: bool = False):
        """Find the first `tag` whose visible text contains (or equals) `text`."""
        xp = (f"//{tag}[normalize-space()='{text}']" if exact
              else f"//{tag}[contains(normalize-space(.), \"{text}\")]")
        try:
            els = self.driver.find_elements(By.XPATH, xp)
            return els[0] if els else None
        except WebDriverException:
            return None

    def text_present(self, needle: str) -> bool:
        try:
            return needle.lower() in self.driver.find_element(By.TAG_NAME, "body").text.lower()
        except WebDriverException:
            return False

    @property
    def body_text(self) -> str:
        try:
            return self.driver.find_element(By.TAG_NAME, "body").text
        except WebDriverException:
            return ""

    # ── interaction ─────────────────────────────────────────────────────────
    # Confirms a real user could click this element: on screen, enabled, and the
    # topmost thing at its own centre point. Returns None when it is genuinely
    # unclickable so tests still fail on overlay/disabled bugs.
    _HIT_TEST = """
    const el = arguments[0];
    if (el.disabled) return 'disabled';
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return 'zero-size';
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none')
        return 'not-visible';
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!top) return 'off-screen';
    if (top !== el && !el.contains(top) && !top.contains(el))
        return 'obscured-by:' + top.tagName + '.' + (top.className || '');
    return null;
    """

    def click(self, el) -> bool:
        """Click an element after confirming a real user could click it.

        Headless Chrome intermittently accepts `element.click()` and then does
        nothing at all — no exception, no event — which turns every downstream
        assertion into a false failure. So the element is hit-tested first (an
        obscured, hidden or disabled control still returns False and fails the
        test honestly), then the click is dispatched as a DOM event, which React
        handles exactly as it does a physical one.
        """
        if el is None:
            return False
        try:
            self.driver.execute_script("arguments[0].scrollIntoView({block:'center'});", el)
            time.sleep(0.15)
            blocked = self.driver.execute_script(self._HIT_TEST, el)
            if blocked:
                self.last_click_block = blocked
                return False
            self.driver.execute_script("arguments[0].click();", el)
            return True
        except StaleElementReferenceException:
            return False
        except WebDriverException:
            try:
                el.click()
                return True
            except WebDriverException:
                return False

    def click_css(self, css: str) -> bool:
        return self.click(self.find(css))

    def click_text(self, tag: str, text: str, exact: bool = False) -> bool:
        return self.click(self.by_text(tag, text, exact))

    # React tracks its own copy of an input's value. Assigning `el.value` directly
    # bypasses that tracker, so React sees no change and reverts the field on its
    # next render. Going through the *native* value setter and then dispatching a
    # bubbling 'input' event is what makes React's onChange fire and its state
    # actually update — this is the reliable way to drive controlled inputs.
    _REACT_SET_VALUE = """
    const el = arguments[0], value = arguments[1];
    const proto = el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    """

    def type(self, el, value: str, clear: bool = True, retries: int = 3) -> bool:
        """Type into a React-controlled input and verify the value actually stuck.

        send_keys is tried first because it exercises the real keyboard path.
        When the SPA discards those keystrokes (a re-render landing between
        focus and input), fall back to the native-setter route so the test is
        measuring the application's behaviour rather than a typing race.
        """
        if el is None:
            return False
        for attempt in range(retries):
            try:
                if clear:
                    el.clear()
                el.send_keys(value)
                if not value or (el.get_attribute("value") or "") == value:
                    return True
            except StaleElementReferenceException:
                return False
            except WebDriverException:
                pass
            time.sleep(0.3 * (attempt + 1))

        try:
            self.driver.execute_script(self._REACT_SET_VALUE, el, value)
            time.sleep(0.15)
            return (el.get_attribute("value") or "") == value
        except WebDriverException:
            return False

    def type_css(self, css: str, value: str) -> bool:
        return self.type(self.find(css), value)

    def select_by_text(self, el, text: str) -> bool:
        try:
            Select(el).select_by_visible_text(text)
            return True
        except WebDriverException:
            return False

    def select_index(self, el, index: int) -> bool:
        try:
            Select(el).select_by_index(index)
            return True
        except WebDriverException:
            return False

    # ── session helpers ─────────────────────────────────────────────────────
    def storage(self, key: str):
        try:
            return self.driver.execute_script(
                "return window.localStorage.getItem(arguments[0]);", key)
        except WebDriverException:
            return None

    def set_storage(self, key: str, value: str):
        try:
            self.driver.execute_script(
                "window.localStorage.setItem(arguments[0], arguments[1]);", key, value)
        except WebDriverException:
            pass

    def clear_session(self):
        try:
            self.driver.execute_script("window.localStorage.clear();")
        except WebDriverException:
            pass

    # ── measurement ─────────────────────────────────────────────────────────
    def load_ms(self) -> int:
        """Navigation timing for the current document, in milliseconds."""
        try:
            v = self.driver.execute_script(
                "const t = performance.getEntriesByType('navigation')[0];"
                "return t ? Math.round(t.duration) : "
                "  (performance.timing.loadEventEnd - performance.timing.navigationStart);")
            return int(v) if v and v > 0 else 0
        except WebDriverException:
            return 0

    def wait_for_text(self, needle: str, timeout: int = 10) -> bool:
        """Poll until `needle` appears in the rendered page text (case-insensitive)."""
        needle = needle.lower()
        deadline = time.time() + timeout
        while time.time() < deadline:
            if needle in self.body_text.lower():
                return True
            time.sleep(0.25)
        return False

    def toast_text(self, timeout: int = 5) -> str:
        """Text of the transient toast notification, if one appeared."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            for css in (".toast", "[class*='toast']", "[role='status']", "[role='alert']"):
                el = self.find(css)
                if el is not None:
                    try:
                        if el.is_displayed() and el.text.strip():
                            return el.text.strip()
                    except WebDriverException:
                        pass
            time.sleep(0.2)
        return ""
