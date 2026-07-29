"""Phase 5 — Regression tests.

Each case pins behaviour that a previous change in this repository altered, so a
future edit that reintroduces the old behaviour fails here rather than in
production. Sources: the unified-login and dynamic-departments commits, plus the
route/backward-compatibility contract in AppRoutes.jsx.
"""
import time

import pytest

import apiclient
import collectors
import config
from pages.base_page import BasePage
from pages.login_page import LoginPage

pytestmark = pytest.mark.regression


# ── unified login (replaced per-role login screens) ─────────────────────────
def test_no_role_picker_remains_on_the_entry_screen(case, driver):
    case("Regression", "The entry screen no longer asks the user to pick a role",
         "/login shows one credential form with no Student/Faculty/Admin selector")
    page = BasePage(driver)
    page.go("/login")
    page.clear_session()
    page.go("/login")
    time.sleep(1.0)
    text = page.body_text.lower()
    has_picker = ("i am a student" in text or "continue as" in text
                  or ("select your role" in text) or ("choose your role" in text))
    case.actual(f"role picker present={has_picker}")
    assert not has_picker, "a role-selection step reappeared on the login screen"


@pytest.mark.parametrize("legacy", ["/roles", "/student/login", "/faculty/login", "/admin/login"])
def test_legacy_role_entry_points_redirect_to_unified_login(case, driver, legacy):
    case("Regression", f"Legacy entry point {legacy} still resolves to the unified login",
         "It redirects to /login rather than 404-ing or rendering a retired screen")
    page = BasePage(driver)
    page.go("/login")
    page.clear_session()
    page.go(legacy)
    ok = page.wait_for_path("/login", 10)
    case.actual(f"{legacy} -> {page.path}")
    assert ok, f"{legacy} landed on {page.path} instead of /login"


def test_single_login_endpoint_serves_all_roles(case):
    case("Regression", "One login endpoint authenticates all three roles",
         "POST /api/auth/login issues a token for student, faculty and admin alike")
    results = {}
    for role in ("student", "admin", "faculty"):
        identifier, password, _ = config.ROLES[role]
        res = apiclient.api("/auth/login", "POST",
                            payload={"identifier": identifier, "password": password})
        results[role] = (res.status, bool(res.json().get("token")),
                         (res.json().get("user") or {}).get("role"))
    case.actual(str(results))
    for role, (status, has_token, got_role) in results.items():
        assert status == 200 and has_token, f"{role} could not log in through /auth/login"
        assert got_role == role, f"{role} login returned role {got_role!r}"


def test_client_cannot_choose_its_own_role_at_login(case):
    case("Regression", "A role supplied in the login body is ignored",
         "The authenticated role comes from the stored account, never from the request")
    res = apiclient.api("/auth/login", "POST", payload={
        "identifier": config.STUDENT_ID, "password": config.STUDENT_PASSWORD, "role": "admin"})
    got = (res.json().get("user") or {}).get("role")
    case.actual(f"HTTP {res.status}, role={got!r}")
    collectors.security(
        "Authentication / Role assignment",
        "The login response ignores a client-supplied role and returns the stored one."
        if got == "student" else
        f"The login response honoured a client-supplied role and returned {got!r}.",
        "Low" if got == "student" else "High",
        "Always derive the role from the persisted user record.")
    assert got == "student", f"client-supplied role was honoured (got {got!r})"


def test_faculty_login_backward_compatibility_endpoint(case):
    case("Regression", "The legacy /auth/faculty-login endpoint still works",
         "It authenticates a faculty account and refuses non-faculty accounts")
    ok = apiclient.api("/auth/faculty-login", "POST", payload={
        "email": config.FACULTY_EMAIL, "password": config.FACULTY_PASSWORD})
    wrong_role = apiclient.api("/auth/faculty-login", "POST", payload={
        "email": config.STUDENT_EMAIL, "password": config.STUDENT_PASSWORD})
    case.actual(f"faculty HTTP {ok.status}; student-on-faculty-endpoint HTTP {wrong_role.status}")
    assert ok.status == 200 and ok.json().get("token"), \
        f"legacy faculty login broke (HTTP {ok.status})"
    assert wrong_role.status == 401, \
        f"a student authenticated on the faculty endpoint (HTTP {wrong_role.status})"


# ── dynamic departments (replaced a hardcoded enum) ─────────────────────────
def test_departments_are_served_as_data(case):
    case("Regression", "Departments are served from the database, not a hardcoded enum",
         "GET /api/departments returns a populated list without authentication")
    res = apiclient.api("/departments", "GET")
    rows = res.json().get("departments") or []
    case.actual(f"HTTP {res.status}, {len(rows)} department(s)")
    assert res.status == 200, f"department list failed (HTTP {res.status})"
    assert len(rows) >= 2, f"only {len(rows)} department(s) returned"


def test_unknown_department_gives_a_validation_error_not_a_500(case):
    case("Regression", "Registering with an unknown department is a clean 400",
         "The API returns HTTP 400 with guidance, never a 500 leaking Mongoose text")
    stamp = str(int(time.time()))[-6:]
    res = apiclient.api("/auth/register", "POST", payload={
        "name": "QA Dept Probe", "studentId": f"QAD{stamp}",
        "email": f"qad{stamp}@college.edu", "password": "Str0ngPass!23",
        "department": "NOT-A-REAL-DEPARTMENT"})
    body = res.body.lower()
    case.actual(f"HTTP {res.status} — {res.json().get('message','')[:90]}")
    if res.status >= 500:
        collectors.defect("Registration / Departments",
                          f"An unknown department produced HTTP {res.status} instead of a "
                          "validation error.",
                          "1. POST /api/auth/register with department='NOT-A-REAL-DEPARTMENT'",
                          "Medium", "backend/routes/auth.js")
    assert res.status == 400, f"unknown department returned HTTP {res.status}"
    assert "validation failed" not in body, "the raw Mongoose validation message leaked"


def test_registration_department_list_is_populated_from_the_api(case, driver):
    case("Regression", "The registration form populates departments from the API",
         "The department dropdown offers options loaded at runtime")
    page = BasePage(driver)
    page.go("/login")
    page.clear_session()
    page.go("/register")
    time.sleep(1.5)
    options = []
    for sel in page.all("select"):
        for opt in sel.find_elements("css selector", "option"):
            t = (opt.text or "").strip()
            if t:
                options.append(t)
    case.actual(f"{len(options)} option(s) across {len(page.all('select'))} dropdown(s)")
    assert len(options) > 2, f"the department dropdown looks unpopulated ({options[:5]})"


# ── portal separation (student/admin/faculty namespaces) ────────────────────
def test_flat_student_urls_still_redirect(case, driver):
    case("Regression", "Old flat student URLs still reach the namespaced routes",
         "/dashboard, /requests and /library redirect under /student/*")
    LoginPage(driver).login_as("student")
    page = BasePage(driver)
    failures = []
    for legacy, target in (("/dashboard", "/student/dashboard"),
                           ("/requests", "/student/requests"),
                           ("/library", "/student/library")):
        page.go(legacy)
        time.sleep(0.9)
        if not page.path.startswith(target):
            failures.append(f"{legacy} -> {page.path}")
    case.actual(f"failures={failures}" if failures else "all three redirected")
    assert not failures, f"legacy student URLs broke: {failures}"


def test_admin_deep_links_fall_through_to_the_panel(case, driver):
    case("Regression", "An unknown /admin/* deep link renders the panel instead of 404-ing",
         "/admin/anything resolves to the admin control panel")
    LoginPage(driver).login_as("admin")
    page = BasePage(driver)
    page.go("/admin/some-old-section")
    time.sleep(1.2)
    case.actual(f"path={page.path}, {len(page.body_text)} chars")
    assert page.path.startswith("/admin"), f"admin deep link left the portal ({page.path})"
    assert len(page.body_text) > 100, "the admin deep link rendered an empty page"


def test_retired_static_site_is_not_served(case):
    case("Regression", "The retired static site is no longer served",
         "The old per-page .html files return HTTP 404; only the React shell remains")
    # /index.html is deliberately excluded: it is the built React SPA's own entry
    # point (frontend/dist/index.html), not a leftover from the retired static site.
    statuses = {}
    for path in ("/login.html", "/admin.html", "/dashboard.html", "/chat.html",
                 "/profile.html", "/requests.html"):
        res = apiclient.request(config.BASE_URL + path)
        statuses[path] = res.status
    shell = apiclient.request(config.BASE_URL + "/index.html")
    case.actual(f"retired={statuses}; /index.html -> HTTP {shell.status} (React shell)")
    served = [p for p, s in statuses.items() if s == 200]
    assert not served, f"retired static pages are still served: {served}"
    assert shell.status == 200 and 'id="root"' in shell.body, \
        "/index.html no longer serves the React SPA shell"


# ── data integrity regressions ──────────────────────────────────────────────
def test_student_dashboard_shows_real_seeded_data(case, driver):
    case("Regression", "The dashboard renders live data, not hardcoded placeholders",
         "The signed-in student's own name/ID appears on their dashboard")
    LoginPage(driver).login_as("student")
    page = BasePage(driver)
    page.go("/student/dashboard")
    time.sleep(1.8)
    text = page.body_text
    has_identity = "Sneka" in text or config.STUDENT_ID in text
    case.actual(f"identity present={has_identity}, {len(text)} chars")
    assert has_identity, "the dashboard did not render the signed-in student's identity"


def test_attendance_has_no_duplicate_subject_rows(case):
    case("Regression", "Attendance records are de-duplicated per subject",
         "The attendance summary lists each subject at most once")
    token = apiclient.login_token("student")
    rows = apiclient.api("/attendance/summary", "GET", token=token).json()
    subjects = [r.get("subject") for r in (rows.get("summary") or rows.get("subjects") or [])
                if r.get("subject")]
    dupes = {s for s in subjects if subjects.count(s) > 1}
    case.actual(f"{len(subjects)} subject row(s), duplicates={sorted(dupes)}")
    if dupes:
        collectors.defect("Attendance",
                          f"The attendance summary repeats subject(s): {sorted(dupes)}",
                          "1. GET /api/attendance/summary as a student  2. Inspect subject names",
                          "Medium", "backend/routes/attendance.js")
    assert not dupes, f"duplicate subject rows: {sorted(dupes)}"


def test_temporary_password_flag_clears_after_change(case):
    case("Regression", "mustChangePassword clears once the password is changed",
         "The flag does not persist after a successful change-password call")
    token = apiclient.login_token("student")
    res = apiclient.api("/auth/change-password", "PUT", token=token, payload={
        "currentPassword": config.STUDENT_PASSWORD, "newPassword": config.STUDENT_PASSWORD})
    body = res.json()
    case.actual(f"HTTP {res.status}, mustChangePassword={body.get('mustChangePassword')}")
    if res.status == 200:
        assert body.get("mustChangePassword") is False, \
            "the temporary-password flag was not cleared after a successful change"
    else:
        assert res.status < 500, f"change-password errored (HTTP {res.status})"
