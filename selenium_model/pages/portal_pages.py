"""Page objects for the three authenticated portals.

All three portals share the same chrome markup (`.sidebar`, `.nav-link`,
`.topbar`, `.page-title`, `.main-content`), so the shared behaviour lives in
`PortalPage` and each subclass only adds what is genuinely portal-specific.
"""
from __future__ import annotations

import time

import config
from .base_page import BasePage


class PortalPage(BasePage):
    """Common authenticated-portal chrome and form primitives."""

    SIDEBAR = "aside.sidebar, #sidebar"
    NAV_LINKS = ".sidebar-nav .nav-link"
    TOPBAR = "header.topbar"
    PAGE_TITLE = ".page-title"
    MAIN = ".main-content"
    MODAL = ".modal-overlay.show .modal"

    # ── chrome ──────────────────────────────────────────────────────────────
    @property
    def has_sidebar(self) -> bool:
        return self.find(self.SIDEBAR) is not None

    @property
    def has_topbar(self) -> bool:
        return self.find(self.TOPBAR) is not None

    @property
    def title_text(self) -> str:
        el = self.find(self.PAGE_TITLE)
        try:
            return el.text.strip() if el is not None else ""
        except Exception:                                    # noqa: BLE001
            return ""

    def settle_nav(self, timeout: int = 10) -> int:
        """Wait for the sidebar to finish rendering, then report its link count.

        The sidebar items animate in on a stagger, and Selenium reports empty text
        for an element that has not become visible yet — so reading the nav too
        early silently drops the last few entries and looks like missing links.
        Settle when every link carries text and the count has stopped changing.
        """
        deadline = time.time() + timeout
        previous = -1
        while time.time() < deadline:
            links = self.all(self.NAV_LINKS)
            try:
                labelled = sum(1 for el in links if el.text.strip())
            except Exception:                                # noqa: BLE001
                labelled = -1                                # re-rendering — sample again
            count = len(links)
            if count and labelled == count and count == previous:
                return count
            previous = count
            time.sleep(0.3)
        return max(previous, 0)

    def nav_labels(self) -> list[str]:
        self.settle_nav()
        out = []
        for el in self.all(self.NAV_LINKS):
            try:
                t = el.text.strip()
            except Exception:                                # noqa: BLE001
                continue
            if t:
                out.append(t)
        return out

    def nav_hrefs(self) -> list[str]:
        self.settle_nav()
        out = []
        for el in self.all(self.NAV_LINKS):
            try:
                href = el.get_attribute("href") or ""
            except Exception:                                # noqa: BLE001
                continue
            if href and not href.endswith("#"):
                out.append(href)
        return out

    def click_nav(self, label: str, retries: int = 3) -> bool:
        """Click a sidebar link by its visible label.

        The sidebar re-renders when the page's own data fetch resolves, so a link
        element collected a moment earlier can go stale before it is clicked —
        Selenium then reports a failed click for a link that is perfectly fine.
        Re-query the nav and try again rather than recording a navigation defect
        that does not exist. A link that is genuinely absent, hidden or obscured
        still exhausts the retries and returns False.
        """
        self.settle_nav()
        for attempt in range(retries):
            target = None
            for el in self.all(self.NAV_LINKS):
                try:
                    if label.lower() in el.text.strip().lower():
                        target = el
                        break
                except Exception:                            # noqa: BLE001
                    continue                                 # stale mid-scan — keep looking
            if target is not None and self.click(target):
                time.sleep(0.8)
                return True
            time.sleep(0.4)                                  # let the re-render settle
        return False

    def toggle_menu(self) -> bool:
        return self.click_css("button.menu-btn")

    def toggle_theme(self) -> bool:
        return self.click_css("button.theme-btn")

    @property
    def theme(self) -> str:
        try:
            return self.driver.execute_script(
                "return document.documentElement.getAttribute('data-theme') "
                "|| document.body.getAttribute('data-theme') || '';") or ""
        except Exception:                                    # noqa: BLE001
            return ""

    def logout(self) -> bool:
        for finder in (lambda: self.find("button.topbar-logout-btn"),
                       lambda: self.find("a.nav-link.logout"),
                       lambda: self.by_text("button", "Logout")):
            el = finder()
            if el is not None and self.click(el):
                time.sleep(1.2)
                return True
        return False

    # ── error signals ───────────────────────────────────────────────────────
    @property
    def rendered_ok(self) -> bool:
        """The page produced real content rather than a blank shell or crash."""
        text = self.body_text.strip()
        if len(text) < 20:
            return False
        low = text.lower()
        for marker in ("application error", "unexpected error",
                       "cannot read propert", "is not a function",
                       "objects are not valid as a react child"):
            if marker in low:
                return False
        return True

    @property
    def error_banner(self) -> str:
        for css in (".error", ".alert-error", "[role='alert']"):
            el = self.find(css)
            if el is not None:
                try:
                    if el.is_displayed() and el.text.strip():
                        return el.text.strip()
                except Exception:                            # noqa: BLE001
                    pass
        return ""

    # ── forms ───────────────────────────────────────────────────────────────
    def text_inputs(self) -> list:
        return [e for e in self.all(".form-input, input.form-input, input[type='text']")
                if (e.get_attribute("type") or "text") in ("text", "search", "tel", "email")]

    def selects(self) -> list:
        return self.all("select.form-select, select")

    def textareas(self) -> list:
        return self.all("textarea")

    def date_inputs(self) -> list:
        return self.all("input[type='date']")

    def file_inputs(self) -> list:
        return self.all("input[type='file']")

    def buttons(self) -> list:
        return self.all("button")

    def tables(self) -> list:
        return self.all("table")

    # ── modal ───────────────────────────────────────────────────────────────
    @property
    def modal_open(self) -> bool:
        el = self.find(self.MODAL)
        try:
            return el is not None and el.is_displayed()
        except Exception:                                    # noqa: BLE001
            return False

    def close_modal(self) -> bool:
        ok = self.click_css(".modal-overlay.show .modal-close")
        time.sleep(0.5)
        return ok

    def modal_text(self) -> str:
        el = self.find(self.MODAL)
        try:
            return el.text if el is not None else ""
        except Exception:                                    # noqa: BLE001
            return ""


class StudentPortal(PortalPage):
    """/student/* — the student self-service portal."""

    def open(self, page: str = "dashboard"):
        self.go(f"/student/{page}")
        return self

    # -- Requests -----------------------------------------------------------
    def open_new_request_modal(self) -> bool:
        ok = self.click_text("button", "+ New Request")
        time.sleep(0.8)
        return ok

    def request_cards(self) -> list:
        return self.all(".req-card")

    def filter_requests(self, label: str) -> bool:
        ok = self.click_text("button", label, exact=True)
        time.sleep(0.6)
        return ok

    def submit_request(self, rtype: str, purpose: str) -> str:
        """Fill and submit the New Request modal; returns the toast text."""
        sel = self.find(".modal-overlay.show select.form-select")
        if sel is not None:
            self.select_by_text(sel, rtype)
        ta = self.find(".modal-overlay.show textarea")
        self.type(ta, purpose)
        self.click_text("button", "Submit Request")
        return self.toast_text(8)

    # -- Library ------------------------------------------------------------
    def library_search(self, term: str) -> bool:
        box = self.find("input.form-input")
        if box is None:
            return False
        self.type(box, term)
        ok = self.click_text("button", "Search", exact=True)
        time.sleep(1.0)
        return ok

    def library_category(self, name: str) -> bool:
        ok = self.click_text("button", name, exact=True)
        time.sleep(1.0)
        return ok

    def result_count(self) -> int:
        return len(self.all(".book-card, .card .book, tbody tr, .req-card"))

    # -- Leave --------------------------------------------------------------
    def submit_leave_empty(self) -> str:
        self.click_text("button", "Submit Application")
        return self.toast_text(6)

    def fill_leave(self, name, regno, reason, from_date, to_date):
        inputs = self.text_inputs()
        if len(inputs) >= 2:
            self.type(inputs[0], name)
            self.type(inputs[1], regno)
        dates = self.date_inputs()
        if len(dates) >= 2:
            self.type(dates[0], from_date)
            self.type(dates[1], to_date)
        tas = self.textareas()
        if tas:
            self.type(tas[0], reason)
        return self

    # -- CGPA ---------------------------------------------------------------
    def cgpa_value(self) -> str:
        for css in (".cgpa-value", ".stat-value", ".card-title"):
            el = self.find(css)
            if el is not None and el.text.strip():
                return el.text.strip()
        return ""


class AdminPanel(PortalPage):
    """/admin/dashboard — the admin control panel (sections are tabs, not routes)."""

    def open(self):
        self.go("/admin/dashboard")
        return self

    def open_tab(self, label: str) -> bool:
        ok = self.click_nav(label)
        time.sleep(1.0)
        return ok

    def tab_labels(self) -> list[str]:
        return self.nav_labels()

    def search_students(self, term: str) -> bool:
        box = self.find("input.form-input")
        if box is None:
            return False
        self.type(box, term)
        ok = self.click_text("button", "Search", exact=True)
        time.sleep(1.2)
        return ok

    def row_count(self) -> int:
        return len(self.all("tbody tr")) or len(self.all(".req-card, .student-card, .card-row"))

    def create_notice(self, title: str, content: str) -> str:
        inputs = self.all("input.form-input")
        if inputs:
            self.type(inputs[0], title)
        tas = self.textareas()
        if tas:
            self.type(tas[0], content)
        self.click_text("button", "Publish")
        return self.toast_text(8)

    def delete_first_notice(self) -> str:
        el = self.by_text("button", "Delete")
        if el is None:
            return ""
        self.click(el)
        time.sleep(0.6)
        # A confirm() dialog may guard the delete.
        try:
            self.driver.switch_to.alert.accept()
            time.sleep(0.4)
        except Exception:                                    # noqa: BLE001
            pass
        return self.toast_text(8)


class FacultyPortal(PortalPage):
    """/faculty/* — the faculty teaching portal."""

    def open(self, page: str = "dashboard"):
        self.go(f"/faculty/{page}")
        return self

    def subject_options(self) -> list[str]:
        out = []
        for sel in self.selects():
            for opt in sel.find_elements("css selector", "option"):
                try:
                    t = opt.text.strip()
                except Exception:                            # noqa: BLE001
                    continue
                if t:
                    out.append(t)
        return out

    def stat_cards(self) -> list:
        return self.all(".stat-card, .card, .stat")
