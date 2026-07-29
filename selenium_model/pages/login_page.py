"""Page objects for the unified login, registration and first-run setup screens."""
from __future__ import annotations

import time

import config
from .base_page import BasePage


class LoginPage(BasePage):
    """/login — one form for students, faculty and admins (no role picker)."""

    IDENTIFIER = "#ca-identifier"
    PASSWORD = "#ca-password"
    SUBMIT = "button[type='submit']"

    def open(self):
        self.driver.get(config.BASE_URL + "/login")
        self.clear_session()
        self.driver.get(config.BASE_URL + "/login")
        self.wait_for_app()
        self.visible(self.IDENTIFIER)
        return self

    # ── field access ────────────────────────────────────────────────────────
    @property
    def identifier_input(self):
        return self.find(self.IDENTIFIER)

    @property
    def password_input(self):
        return self.find(self.PASSWORD)

    def fill(self, identifier: str = "", password: str = ""):
        # The login card animates in (framer-motion) and a /auth/setup-status
        # fetch re-renders it shortly after mount; settle before typing so the
        # first keystroke is not thrown away by that re-render.
        self.visible(self.IDENTIFIER)
        time.sleep(0.4)
        self.type(self.identifier_input, identifier)
        self.type(self.password_input, password)
        return self

    def submit(self):
        self.click_css(self.SUBMIT)
        time.sleep(1.2)          # allow the auth round-trip + redirect to settle
        return self

    def login(self, identifier: str, password: str):
        self.open().fill(identifier, password).submit()
        return self

    def login_as(self, role: str):
        identifier, password, home = config.ROLES[role]
        self.login(identifier, password)
        self.wait_for_path(home)
        return self

    # ── state ───────────────────────────────────────────────────────────────
    @property
    def alert_text(self) -> str:
        el = self.find("[role='alert']")
        try:
            return el.text.strip() if el is not None else ""
        except Exception:                                    # noqa: BLE001
            return ""

    def wait_for_alert(self, timeout: int = 8) -> str:
        deadline = time.time() + timeout
        while time.time() < deadline:
            txt = self.alert_text
            if txt:
                return txt
            time.sleep(0.2)
        return ""

    @property
    def field_errors(self) -> list[str]:
        return [e.text.strip() for e in self.all("span")
                if e.text.strip().lower().startswith("please enter")]

    @property
    def logged_in(self) -> bool:
        return bool(self.storage("ca_token"))

    @property
    def session_role(self) -> str:
        raw = self.storage("ca_user") or ""
        for role in ("admin", "faculty", "student"):
            if f'"role":"{role}"' in raw.replace(" ", ""):
                return role
        return ""

    def toggle_password_visibility(self) -> bool:
        return self.click_css("button[aria-label='Show password'], "
                              "button[aria-label='Hide password']")

    @property
    def password_field_type(self) -> str:
        el = self.password_input
        return el.get_attribute("type") if el is not None else ""

    def click_forgot_password(self) -> bool:
        return self.click_text("button", "Forgot password?")

    def set_remember(self, on: bool) -> bool:
        el = self.find("input[type='checkbox']")
        if el is None:
            return False
        try:
            if el.is_selected() != on:
                return self.click(el)
            return True
        except Exception:                                    # noqa: BLE001
            return False

    def logout_via_ui(self) -> bool:
        """Click whichever logout control the current portal chrome exposes."""
        for finder in (lambda: self.by_text("button", "Logout"),
                       lambda: self.find("a.logout"),
                       lambda: self.by_text("a", "Logout")):
            el = finder()
            if el is not None and self.click(el):
                time.sleep(1.0)
                return True
        return False


class RegisterPage(BasePage):
    """/register — student self-registration (creates a pending account)."""

    def open(self):
        self.clear_session()
        self.go("/register")
        return self

    @property
    def inputs(self) -> list:
        return [e for e in self.all("input") if e.get_attribute("type") != "checkbox"]

    @property
    def selects(self) -> list:
        return self.all("select")

    def submit(self):
        el = self.by_text("button", "Create Account") or self.find("button[type='submit']")
        self.click(el)
        time.sleep(1.5)
        return self

    @property
    def visible_errors(self) -> list[str]:
        out = []
        for e in self.all("span, p, div"):
            try:
                t = e.text.strip()
            except Exception:                                # noqa: BLE001
                continue
            if t and 1 < len(t) < 90 and any(
                    k in t.lower() for k in ("required", "valid", "must", "least", "already")):
                out.append(t)
        return out


class SetupPage(BasePage):
    """/setup — first-run administrator bootstrap; inert once an admin exists."""

    def open(self):
        self.clear_session()
        self.go("/setup")
        return self

    @property
    def disabled(self) -> bool:
        """True when setup has already been completed (the expected state here)."""
        t = self.body_text.lower()
        return ("already" in t and "setup" in t) or "administrator already" in t \
            or "not available" in t
