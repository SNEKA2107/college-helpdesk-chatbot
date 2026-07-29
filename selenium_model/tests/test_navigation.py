"""Phase 4 — Navigation: sidebars, topbar, bottom nav, admin tabs, routing
contract and legacy redirects."""
import time

import pytest

import collectors
import config
from pages.base_page import BasePage
from pages.portal_pages import AdminPanel, FacultyPortal, StudentPortal

pytestmark = pytest.mark.nav


# ── student portal ──────────────────────────────────────────────────────────
@pytest.mark.parametrize("route", config.STUDENT_ROUTES)
def test_student_route_renders(case, student, route):
    page = route.rsplit("/", 1)[-1]
    case("Student Portal", f"Student route {route} renders",
         "The page returns real content with the portal chrome and no crash")
    collectors.covers(f"student-portal-{page}")
    student.go(route)
    time.sleep(0.8)
    ok = student.rendered_ok
    ms = student.load_ms()
    if ms:
        collectors.performance(
            route, ms,
            "Slower than the 3s budget" if ms > config.SLOW_PAGE_MS else "Within budget",
            "Code-split the route and defer non-critical API calls."
            if ms > config.SLOW_PAGE_MS else "No action required.")
    case.actual(f"path={student.path} title={student.title_text!r} load={ms}ms "
                f"chars={len(student.body_text)}")
    if not ok:
        collectors.ui_finding(route, "Page rendered empty or with an error marker",
                              "High", f"body={student.body_text[:160]!r}")
    assert student.path.startswith(route), f"redirected away to {student.path}"
    assert ok, f"{route} did not render usable content"


def test_student_sidebar_has_every_section(case, student):
    case("Navigation", "Student sidebar exposes all four navigation sections",
         "Main, Academics, Services and Account links are all present")
    student.open("dashboard")
    labels = student.nav_labels()
    expected = ["Dashboard", "AI Assistant", "My Requests", "Attendance", "Exam Info",
                "Fee Information", "Timetable", "Leave Application", "Events",
                "Notices", "Library", "Profile", "Settings"]
    missing = [e for e in expected if not any(e.lower() in l.lower() for l in labels)]
    case.actual(f"{len(labels)} link(s); missing={missing}")
    assert student.has_sidebar, "sidebar did not render"
    assert not missing, f"sidebar is missing: {missing}"


def test_student_sidebar_links_navigate(case, student):
    case("Navigation", "Every student sidebar link navigates to its own page",
         "Clicking each link changes the route and renders that page")
    student.open("dashboard")
    failures = []
    for label in ["My Requests", "Attendance", "Exam Info", "Timetable", "Notices",
                  "Library", "Profile"]:
        student.open("dashboard")
        if not student.click_nav(label):
            failures.append(f"{label}: not clickable")
            continue
        time.sleep(0.8)
        if student.path == "/student/dashboard":
            failures.append(f"{label}: did not navigate")
        elif not student.rendered_ok:
            failures.append(f"{label}: rendered empty at {student.path}")
    case.actual(f"failures={failures}" if failures else "all 7 links navigated")
    assert not failures, "; ".join(failures)


def test_student_sidebar_has_no_admin_links(case, student):
    case("Authorization", "Student navigation never exposes admin destinations",
         "No sidebar link points at /admin/* or /faculty/*")
    student.open("dashboard")
    leaked = [h for h in student.nav_hrefs() if "/admin" in h or "/faculty" in h]
    case.actual(f"leaked={leaked}" if leaked else "no admin/faculty links present")
    if leaked:
        collectors.security("Authorization / UI exposure",
                            f"Student sidebar links to privileged routes: {leaked}",
                            "High", "Render navigation strictly from the session role.")
    assert not leaked, f"student navigation exposes: {leaked}"


def test_topbar_controls(case, student):
    case("Navigation", "Topbar exposes the menu, theme, notices, profile and logout controls",
         "All five controls are present on an authenticated student page")
    student.open("dashboard")
    found = {
        "menu": student.find("button.menu-btn") is not None,
        "theme": student.find("button.theme-btn") is not None,
        "notices": student.find("a.notif-btn") is not None,
        "profile": student.find("a.topbar-profile") is not None,
        "logout": student.find("button.topbar-logout-btn") is not None,
    }
    case.actual(str(found))
    assert student.has_topbar, "topbar did not render"
    assert all(found.values()), f"missing topbar controls: {[k for k,v in found.items() if not v]}"


def test_theme_toggle_changes_theme(case, student):
    case("UI", "Theme toggle switches the active theme",
         "The document theme attribute changes after clicking the theme control")
    student.open("dashboard")
    before = student.theme
    student.toggle_theme()
    time.sleep(0.6)
    after = student.theme
    case.actual(f"{before!r} -> {after!r}")
    assert before != after, f"theme did not change (stayed {before!r})"


def test_mobile_bottom_nav_present(case, driver, student):
    case("Navigation", "Mobile bottom navigation renders at a phone viewport",
         "The bottom nav is in the DOM when the viewport is narrow")
    student.open("dashboard")
    driver.set_window_size(390, 844)
    time.sleep(1.0)
    present = student.find(".bottom-nav, nav.bottom-nav, [class*='bottom-nav']") is not None
    driver.set_window_size(*config.WINDOW_SIZE)
    time.sleep(0.5)
    case.actual(f"bottom nav present={present}")
    assert present, "mobile bottom navigation not found at 390px"


# ── faculty portal ──────────────────────────────────────────────────────────
@pytest.mark.parametrize("route", config.FACULTY_ROUTES)
def test_faculty_route_renders(case, faculty, route):
    case("Faculty Portal", f"Faculty route {route} renders",
         "The page returns real content with the faculty chrome and no crash")
    collectors.covers(f"faculty-portal-{route.rsplit('/',1)[-1]}")
    faculty.go(route)
    time.sleep(0.8)
    ok = faculty.rendered_ok
    ms = faculty.load_ms()
    if ms:
        collectors.performance(
            route, ms,
            "Slower than the 3s budget" if ms > config.SLOW_PAGE_MS else "Within budget",
            "Trim the dashboard aggregation queries." if ms > config.SLOW_PAGE_MS
            else "No action required.")
    case.actual(f"path={faculty.path} title={faculty.title_text!r} load={ms}ms")
    if not ok:
        collectors.ui_finding(route, "Faculty page rendered empty or errored", "High",
                              f"body={faculty.body_text[:160]!r}")
    assert faculty.path.startswith(route), f"redirected away to {faculty.path}"
    assert ok, f"{route} did not render usable content"


def test_faculty_sidebar_complete(case, faculty):
    case("Navigation", "Faculty sidebar lists all thirteen portal destinations",
         "Every faculty feature is reachable from the sidebar")
    faculty.open("dashboard")
    labels = faculty.nav_labels()
    expected = ["Dashboard", "My Classes", "Students", "Attendance", "Marks",
                "Assignments", "Study Materials", "Analytics", "Leave & OD",
                "Notices", "Notifications", "Timetable", "Profile"]
    missing = [e for e in expected if not any(e.lower() in l.lower() for l in labels)]
    case.actual(f"{len(labels)} link(s); missing={missing}")
    assert not missing, f"faculty sidebar is missing: {missing}"


# ── admin panel ─────────────────────────────────────────────────────────────
def test_admin_panel_renders(case, admin):
    case("Admin Panel", "Admin control panel loads with its own chrome",
         "/admin/dashboard renders the admin sidebar and overview content")
    collectors.covers("admin-panel-admin-action-buttons")
    admin.open()
    time.sleep(1.2)
    case.actual(f"path={admin.path} title={admin.title_text!r} tabs={len(admin.tab_labels())}")
    assert admin.has_sidebar, "admin sidebar missing"
    assert admin.rendered_ok, "admin panel rendered empty"


@pytest.mark.parametrize("tab_id,label", config.ADMIN_TABS)
def test_admin_tab_opens(case, admin, tab_id, label):
    case("Admin Panel", f"Admin tab '{label}' opens and renders",
         "Selecting the tab swaps the panel content without an error")
    collectors.covers(f"navigation-admin-panel-tab-{label.lower().replace(' ','-')}")
    admin.open()
    time.sleep(1.0)
    clicked = admin.open_tab(label)
    body = admin.body_text
    case.actual(f"clicked={clicked} title={admin.title_text!r} chars={len(body)}")
    if not clicked:
        collectors.ui_finding("/admin/dashboard", f"Admin tab '{label}' could not be clicked",
                              "Medium", f"blocked={admin.last_click_block}")
    assert clicked, f"tab '{label}' was not clickable ({admin.last_click_block})"
    assert admin.rendered_ok, f"tab '{label}' rendered empty content"


# ── routing contract ────────────────────────────────────────────────────────
@pytest.mark.parametrize("legacy,target", config.LEGACY_REDIRECTS)
def test_legacy_url_redirects(case, driver, legacy, target):
    case("Navigation", f"Legacy URL {legacy} still resolves",
         f"It redirects to {target} rather than dead-ending")
    page = BasePage(driver)
    page.clear_session()
    page.go(legacy)
    time.sleep(0.8)
    landed = page.path
    # Unauthenticated portal targets legitimately bounce on to /login.
    acceptable = landed.startswith(target) or landed.startswith("/login")
    case.actual(f"{legacy} -> {landed}")
    assert acceptable, f"{legacy} landed on {landed}, expected {target} (or /login)"


def test_unknown_route_does_not_dead_end(case, driver):
    case("Navigation", "An unknown client route falls back gracefully",
         "The SPA renders a known screen instead of a blank page")
    page = BasePage(driver)
    page.clear_session()
    page.go("/this-route-does-not-exist-qa")
    time.sleep(1.0)
    case.actual(f"landed on {page.path}, {len(page.body_text)} chars")
    assert len(page.body_text.strip()) > 20, "unknown route produced a blank page"


def test_landing_page_preserved(case, driver):
    case("Navigation", "The marketing landing page is preserved at /welcome",
         "/welcome renders the landing content with its sections")
    collectors.covers("navigation-landing-page-sections-footer")
    page = BasePage(driver)
    page.clear_session()
    page.go("/welcome")
    time.sleep(1.0)
    case.actual(f"path={page.path}, {len(page.body_text)} chars")
    assert page.path.startswith("/welcome"), f"landed on {page.path}"
    assert len(page.body_text) > 200, "landing page rendered almost no content"
