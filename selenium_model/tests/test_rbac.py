"""Phase 4 — Role-based access control, at both the UI guard and API layer."""
import time

import pytest

import apiclient
import collectors
import config
from pages.base_page import BasePage
from pages.login_page import LoginPage

pytestmark = pytest.mark.rbac


# ── unauthenticated access ──────────────────────────────────────────────────
@pytest.mark.parametrize("route", [
    "/student/dashboard", "/student/requests", "/student/profile",
    "/admin/dashboard", "/faculty/dashboard", "/faculty/marks",
])
def test_unauthenticated_route_redirects_to_login(case, driver, route):
    case("Authorization", f"Unauthenticated access to {route} is refused",
         "The route guard redirects to /login and no protected content is rendered")
    collectors.covers("authorization-route-guard-requireauth")
    page = BasePage(driver)
    page.go("/login")
    page.clear_session()
    page.go(route)
    ok = page.wait_for_path("/login", 10)
    case.actual(f"landed on {page.path}")
    if not ok:
        collectors.security("Authorization / Route guards",
                            f"{route} was reachable without a session (landed on {page.path})",
                            "High", "Enforce the guard at the route boundary for every portal.")
    assert ok, f"{route} reachable without authentication (landed on {page.path})"


# ── cross-role UI isolation ─────────────────────────────────────────────────
@pytest.mark.parametrize("role,forbidden,expected_home", [
    ("student", "/admin/dashboard", "/student/dashboard"),
    ("student", "/faculty/dashboard", "/student/dashboard"),
    ("admin", "/student/dashboard", "/admin/dashboard"),
    ("admin", "/faculty/dashboard", "/admin/dashboard"),
    ("faculty", "/student/dashboard", "/faculty/dashboard"),
    ("faculty", "/admin/dashboard", "/faculty/dashboard"),
])
def test_role_cannot_enter_another_portal(case, driver, role, forbidden, expected_home):
    case("Authorization", f"A {role} cannot open {forbidden}",
         f"The guard bounces them back to {expected_home}")
    collectors.covers("authorization-route-guard-requirestudent",
                      "authorization-route-guard-requireadmin",
                      "authorization-route-guard-requirefaculty")
    LoginPage(driver).login_as(role)
    page = BasePage(driver)
    page.go(forbidden)
    time.sleep(1.0)
    landed = page.path
    case.actual(f"{role} -> {forbidden} landed on {landed}")
    if landed.startswith(forbidden):
        collectors.security(
            "Authorization / Portal isolation",
            f"A {role} account rendered {forbidden} — portal isolation is not enforced.",
            "High", "Guard every portal layout on the session role, server-verified.")
    assert not landed.startswith(forbidden), \
        f"{role} rendered {forbidden} — cross-role access is possible"
    assert landed.startswith(expected_home), \
        f"{role} was sent to {landed} instead of {expected_home}"


# ── API authorisation ───────────────────────────────────────────────────────
@pytest.mark.parametrize("endpoint", [
    "/students", "/audit", "/analytics", "/knowledge", "/exam/all",
    "/timetable/all", "/fees/all", "/contact",
])
def test_student_token_cannot_read_admin_endpoints(case, endpoint):
    case("Authorization", f"A student token is refused on admin endpoint {endpoint}",
         "The API returns 401/403 and no admin data")
    collectors.covers("authorization-server-side-adminonly-enforcement")
    token = apiclient.login_token("student")
    res = apiclient.api(endpoint, "GET", token=token)
    case.actual(f"HTTP {res.status}")
    collectors.api_result(endpoint, "GET", "401/403", res.status,
                          "Pass" if res.status in (401, 403) else "Fail",
                          "student token against an admin-only endpoint")
    if res.status == 200:
        collectors.security("Authorization / API",
                            f"GET {endpoint} returned 200 for a student token — admin data is "
                            "exposed to any authenticated user.",
                            "High", "Apply the adminOnly middleware to this route.")
    assert res.status in (401, 403), f"student read {endpoint} (HTTP {res.status})"


@pytest.mark.parametrize("endpoint", [
    "/faculty-portal/dashboard", "/faculty-portal/students",
    "/faculty-portal/marks", "/faculty-portal/analytics",
])
def test_student_token_cannot_read_faculty_endpoints(case, endpoint):
    case("Authorization", f"A student token is refused on faculty endpoint {endpoint}",
         "The API returns 401/403")
    collectors.covers("authorization-server-side-facultyonly-enforcement")
    token = apiclient.login_token("student")
    res = apiclient.api(endpoint, "GET", token=token)
    case.actual(f"HTTP {res.status}")
    collectors.api_result(endpoint, "GET", "401/403", res.status,
                          "Pass" if res.status in (401, 403) else "Fail",
                          "student token against a faculty-only endpoint")
    assert res.status in (401, 403), f"student read {endpoint} (HTTP {res.status})"


@pytest.mark.parametrize("endpoint,method", [
    ("/notices", "POST"), ("/events", "POST"), ("/students/000000000000000000000000", "PUT"),
])
def test_student_cannot_perform_admin_writes(case, endpoint, method):
    case("Authorization", f"A student cannot {method} {endpoint}",
         "The API refuses the write with 401/403")
    token = apiclient.login_token("student")
    res = apiclient.api(endpoint, method, token=token,
                        payload={"title": "QA probe", "content": "QA probe"})
    case.actual(f"HTTP {res.status}")
    collectors.api_result(endpoint, method, "401/403", res.status,
                          "Pass" if res.status in (401, 403) else "Fail",
                          "student attempting an admin write")
    assert res.status in (401, 403), f"student performed {method} {endpoint} (HTTP {res.status})"


@pytest.mark.parametrize("endpoint", ["/auth/me", "/requests", "/notices", "/students", "/audit"])
def test_no_token_is_refused(case, endpoint):
    case("Authorization", f"{endpoint} requires authentication",
         "A request with no bearer token returns HTTP 401")
    res = apiclient.api(endpoint, "GET")
    case.actual(f"HTTP {res.status}")
    collectors.api_result(endpoint, "GET", 401, res.status,
                          "Pass" if res.status == 401 else "Fail", "no bearer token")
    assert res.status == 401, f"{endpoint} served an unauthenticated request (HTTP {res.status})"


def test_tampered_token_is_refused(case):
    case("Authorization", "A tampered JWT is refused",
         "Mutating the signature yields HTTP 401")
    token = apiclient.login_token("student") or ""
    bad = token[:-6] + ("aaaaaa" if not token.endswith("aaaaaa") else "bbbbbb")
    res = apiclient.api("/auth/me", "GET", token=bad)
    case.actual(f"HTTP {res.status}")
    collectors.security(
        "Authentication / Token integrity",
        "A JWT with a mutated signature is rejected with 401." if res.status == 401 else
        f"A JWT with a mutated signature returned HTTP {res.status} — signature verification "
        "may not be enforced.",
        "Low" if res.status == 401 else "High",
        "Always verify the JWT signature server-side before trusting any claim.")
    assert res.status == 401, f"tampered token accepted (HTTP {res.status})"


def test_admin_token_reaches_admin_data(case):
    case("Authorization", "An admin token can read admin-only data",
         "GET /api/students returns 200 for an administrator")
    token = apiclient.login_token("admin")
    res = apiclient.api("/students", "GET", token=token)
    case.actual(f"HTTP {res.status}, {len(res.json().get('students') or [])} student(s)")
    assert res.status == 200, f"admin denied its own data (HTTP {res.status})"


def test_faculty_token_reaches_faculty_data(case):
    case("Authorization", "A faculty token can read its own portal data",
         "GET /api/faculty-portal/dashboard returns 200 for a faculty account")
    token = apiclient.login_token("faculty")
    res = apiclient.api("/faculty-portal/dashboard", "GET", token=token)
    case.actual(f"HTTP {res.status}")
    assert res.status == 200, f"faculty denied its own data (HTTP {res.status})"


def test_student_data_is_scoped_to_the_owner(case):
    case("Authorization", "A student only receives their own records",
         "GET /api/requests returns records belonging solely to the authenticated student")
    token = apiclient.login_token("student")
    res = apiclient.api("/requests", "GET", token=token)
    rows = res.json().get("requests") or []
    foreign = [r for r in rows
               if r.get("studentId") and r["studentId"] != config.STUDENT_ID]
    case.actual(f"{len(rows)} record(s), {len(foreign)} belonging to another student")
    if foreign:
        collectors.security("Authorization / Data scoping",
                            f"GET /api/requests returned {len(foreign)} record(s) owned by another "
                            "student — horizontal privilege escalation.",
                            "High", "Filter every student-facing query by req.user._id.")
    assert not foreign, f"{len(foreign)} record(s) leaked from another student"
