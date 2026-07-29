"""Phase 4 — Complete end-to-end user journeys.

Each test walks a realistic multi-step workflow and records the outcome (with
step-level detail) into the User Journey Results sheet.
"""
import time

import pytest

import collectors
import config
from pages.base_page import BasePage
from pages.login_page import LoginPage
from pages.portal_pages import AdminPanel, FacultyPortal, StudentPortal

pytestmark = pytest.mark.journey


class Steps:
    """Accumulates per-step outcomes so a journey reports where it broke."""

    def __init__(self):
        self.rows = []

    def add(self, label, ok, detail=""):
        self.rows.append(f"{'OK' if ok else 'FAIL'} — {label}" + (f" ({detail})" if detail else ""))
        return ok

    def __str__(self):
        return " | ".join(self.rows)

    @property
    def failed(self):
        return [r for r in self.rows if r.startswith("FAIL")]


def _record(name, steps, passed, evidence):
    collectors.journey(name, str(steps), "Passed" if passed else "Failed", evidence)


# ── student journeys ────────────────────────────────────────────────────────
def test_journey_document_request_lifecycle(case, driver):
    name = "Student document request lifecycle"
    case("User Journey", name,
         "Login -> My Requests -> submit a new request -> it appears -> details open")
    collectors.covers("user-journeys-student-document-request-lifecycle")
    s = Steps()
    login = LoginPage(driver)
    student = StudentPortal(driver)

    login.login_as("student")
    s.add("Login as student", login.logged_in, login.path)

    student.open("requests")
    time.sleep(1.5)
    s.add("Open My Requests", student.path.startswith("/student/requests"), student.path)

    before = len(student.request_cards())
    s.add("Read existing requests", True, f"{before} card(s)")

    opened = student.open_new_request_modal()
    s.add("Open the New Request modal", opened and student.modal_open)

    toast = student.submit_request("Bonafide Certificate",
                                   "End-to-end journey verification by the audit suite.")
    s.add("Submit the request", bool(toast), toast[:60])

    time.sleep(1.5)
    student.open("requests")
    time.sleep(1.5)
    after = len(student.request_cards())
    s.add("New request is listed", after > before, f"{before} -> {after}")

    details = student.click_text("button", "View Details")
    time.sleep(0.8)
    s.add("Open request details", details and student.modal_open)

    passed = not s.failed
    _record(name, s, passed, "screenshots/ (journey)")
    case.actual(str(s))
    assert passed, f"journey broke at: {s.failed}"


def test_journey_leave_application(case, driver):
    name = "Student leave application"
    case("User Journey", name,
         "Login -> Leave -> validation blocks an empty form -> valid submission succeeds")
    collectors.covers("user-journeys-student-leave-application")
    s = Steps()
    login = LoginPage(driver)
    student = StudentPortal(driver)

    login.login_as("student")
    s.add("Login as student", login.logged_in)

    student.open("leave")
    time.sleep(1.5)
    s.add("Open the leave page", student.path.startswith("/student/leave"))

    empty_msg = student.submit_leave_empty()
    s.add("Empty submission is blocked", bool(empty_msg), empty_msg[:50])

    student.fill_leave("Sneka S", "22IT101",
                       "Journey verification: medical leave request.",
                       "2026-12-15", "2026-12-16")
    for sel in student.selects():
        student.select_index(sel, 1)
    student.click_text("button", "Submit Application")
    # Success renders an inline confirmation panel rather than a toast.
    confirmed = student.wait_for_text("Leave Application Submitted", 10)
    s.add("Valid submission accepted", confirmed,
          "confirmation panel shown" if confirmed else student.toast_text(4)[:60])

    passed = not s.failed
    _record(name, s, passed, "screenshots/ (journey)")
    case.actual(str(s))
    assert passed, f"journey broke at: {s.failed}"


def test_journey_library_search(case, driver):
    name = "Student library search"
    case("User Journey", name,
         "Login -> Library -> search the catalogue -> filter by category -> borrowed books")
    collectors.covers("user-journeys-student-library-search")
    s = Steps()
    LoginPage(driver).login_as("student")
    student = StudentPortal(driver)

    student.open("library")
    time.sleep(1.5)
    s.add("Open the library", student.path.startswith("/student/library"))

    student.library_search("Java")
    time.sleep(1.0)
    s.add("Search the catalogue", "java" in student.body_text.lower())

    student.library_category("All Books")
    time.sleep(1.0)
    s.add("Reset the category filter", student.rendered_ok)

    s.add("Borrowed books are visible", "borrow" in student.body_text.lower())

    passed = not s.failed
    _record(name, s, passed, "screenshots/ (journey)")
    case.actual(str(s))
    assert passed, f"journey broke at: {s.failed}"


def test_journey_student_navigation_sweep(case, driver):
    name = "Student self-service navigation sweep"
    case("User Journey", name,
         "Login, then visit every student destination and confirm each renders")
    collectors.covers("user-journeys-student-self-service-navigation-sweep")
    s = Steps()
    LoginPage(driver).login_as("student")
    student = StudentPortal(driver)

    broken = []
    for route in config.STUDENT_ROUTES:
        student.go(route)
        time.sleep(0.6)
        ok = student.path.startswith(route) and student.rendered_ok
        if not ok:
            broken.append(f"{route} -> {student.path}")
    s.add(f"Visited {len(config.STUDENT_ROUTES)} student pages", not broken,
          f"{len(broken)} broken" if broken else "all rendered")

    passed = not broken
    _record(name, s, passed, "; ".join(broken) if broken else "screenshots/ (journey)")
    case.actual(str(s) + (f" broken={broken}" if broken else ""))
    assert passed, f"pages failed to render: {broken}"


# ── admin journey ───────────────────────────────────────────────────────────
def test_journey_admin_moderation(case, driver):
    name = "Admin moderation journey"
    case("User Journey", name,
         "Login as admin -> Overview -> Requests -> Students -> Notices -> Audit Log")
    collectors.covers("user-journeys-admin-moderation-journey")
    s = Steps()
    LoginPage(driver).login_as("admin")
    admin = AdminPanel(driver)

    admin.open()
    time.sleep(1.5)
    s.add("Admin panel loads", admin.rendered_ok, admin.path)

    for tab in ("Overview", "Requests", "Students", "Notices", "Audit Log"):
        ok = admin.open_tab(tab)
        time.sleep(0.8)
        s.add(f"Open the {tab} tab", ok and admin.rendered_ok, admin.title_text)

    passed = not s.failed
    _record(name, s, passed, "screenshots/ (journey)")
    case.actual(str(s))
    assert passed, f"journey broke at: {s.failed}"


# ── faculty journey ─────────────────────────────────────────────────────────
def test_journey_faculty_teaching(case, driver):
    name = "Faculty teaching journey"
    case("User Journey", name,
         "Login as faculty -> Dashboard -> Classes -> Students -> Attendance -> Marks")
    collectors.covers("user-journeys-faculty-teaching-journey")
    s = Steps()
    LoginPage(driver).login_as("faculty")
    faculty = FacultyPortal(driver)

    for page in ("dashboard", "classes", "students", "attendance", "marks"):
        faculty.open(page)
        time.sleep(1.0)
        ok = faculty.path.startswith(f"/faculty/{page}") and faculty.rendered_ok
        s.add(f"Open {page}", ok, faculty.path)

    passed = not s.failed
    _record(name, s, passed, "screenshots/ (journey)")
    case.actual(str(s))
    assert passed, f"journey broke at: {s.failed}"


# ── cross-cutting journeys ──────────────────────────────────────────────────
def test_journey_role_isolation(case, driver):
    name = "Role isolation journey"
    case("User Journey", name,
         "Each role is bounced out of every portal that is not its own")
    collectors.covers("user-journeys-role-isolation-journey")
    s = Steps()
    page = BasePage(driver)
    login = LoginPage(driver)

    matrix = [("student", "/admin/dashboard"), ("student", "/faculty/dashboard"),
              ("admin", "/student/dashboard"), ("faculty", "/admin/dashboard")]
    for role, forbidden in matrix:
        login.login_as(role)
        page.go(forbidden)
        time.sleep(1.0)
        s.add(f"{role} blocked from {forbidden}", not page.path.startswith(forbidden), page.path)

    passed = not s.failed
    _record(name, s, passed, "screenshots/ (journey)")
    case.actual(str(s))
    assert passed, f"role isolation failed at: {s.failed}"


def test_journey_unauthenticated_access(case, driver):
    name = "Unauthenticated access journey"
    case("User Journey", name,
         "Every protected route is redirected to /login when there is no session")
    collectors.covers("user-journeys-unauthenticated-access-journey")
    s = Steps()
    page = BasePage(driver)
    page.go("/login")
    page.clear_session()

    for route in ("/student/dashboard", "/student/fees", "/admin/dashboard", "/faculty/marks"):
        page.go(route)
        ok = page.wait_for_path("/login", 8)
        s.add(f"{route} requires a session", ok, page.path)

    passed = not s.failed
    _record(name, s, passed, "screenshots/ (journey)")
    case.actual(str(s))
    assert passed, f"unprotected routes: {s.failed}"


def test_journey_session_lifecycle(case, driver):
    name = "Session lifecycle journey"
    case("User Journey", name,
         "Login -> session token exists -> logout -> protected route bounces to /login")
    collectors.covers("user-journeys-session-lifecycle-journey")
    s = Steps()
    login = LoginPage(driver)
    page = BasePage(driver)

    login.login_as("student")
    s.add("Login creates a session", login.logged_in)

    page.go("/student/profile")
    time.sleep(1.0)
    s.add("Protected route is reachable while authenticated",
          page.path.startswith("/student/profile"), page.path)

    s.add("Logout clears the session", login.logout_via_ui() and not login.logged_in)

    page.go("/student/profile")
    s.add("Protected route is refused after logout", page.wait_for_path("/login", 8), page.path)

    passed = not s.failed
    _record(name, s, passed, "screenshots/ (journey)")
    case.actual(str(s))
    assert passed, f"session lifecycle broke at: {s.failed}"
