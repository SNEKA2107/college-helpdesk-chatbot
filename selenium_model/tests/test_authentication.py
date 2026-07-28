"""Phase 4 — Authentication: login, logout, invalid login, forgot password,
validation, session handling and the unified role-routing contract."""
import time

import pytest

import apiclient
import collectors
import config
from pages.base_page import BasePage

pytestmark = pytest.mark.auth


# ── valid login, all three roles ────────────────────────────────────────────
@pytest.mark.parametrize("role", ["student", "admin", "faculty"])
def test_valid_login_lands_on_role_home(case, login_page, role):
    identifier, password, home = config.ROLES[role]
    case("Authentication", f"Valid {role} login via the unified form",
         f"Session is created and the browser lands on {home}")
    collectors.covers("authentication-unified-login-student-faculty-admin")

    login_page.login(identifier, password)
    ok = login_page.wait_for_path(home, 12)
    case.actual(f"path={login_page.path} token={'yes' if login_page.logged_in else 'no'} "
                f"role={login_page.session_role}")
    assert login_page.logged_in, "no session token was stored"
    assert ok, f"expected {home}, landed on {login_page.path}"
    assert login_page.session_role == role, \
        f"session role {login_page.session_role!r} != {role!r}"


def test_login_accepts_email_as_identifier(case, login_page):
    case("Authentication", "Login accepts an email address as the identifier",
         "The same account authenticates by email as by register number")
    login_page.login(config.STUDENT_EMAIL, config.STUDENT_PASSWORD)
    ok = login_page.wait_for_path("/student/dashboard", 12)
    case.actual(f"path={login_page.path}")
    assert ok, f"email login did not reach the student dashboard (got {login_page.path})"


def test_login_identifier_is_case_insensitive(case, login_page):
    case("Authentication", "Register number is matched case-insensitively",
         "A lowercase register number authenticates the same account")
    login_page.login(config.STUDENT_ID.lower(), config.STUDENT_PASSWORD)
    ok = login_page.wait_for_path("/student/dashboard", 12)
    case.actual(f"path={login_page.path}")
    assert ok, f"lowercase identifier failed to authenticate (got {login_page.path})"


# ── invalid login ───────────────────────────────────────────────────────────
@pytest.mark.parametrize("identifier,password,label", [
    (config.STUDENT_ID, "totally-wrong-password", "wrong password"),
    ("NOSUCHUSER99", "student123", "unknown account"),
    ("' OR '1'='1", "' OR '1'='1", "SQL-injection style payload"),
])
def test_invalid_login_is_rejected(case, login_page, identifier, password, label):
    case("Authentication", f"Invalid login rejected — {label}",
         "An error alert is shown, no session is created and the user stays on /login")
    login_page.login(identifier, password)
    alert = login_page.wait_for_alert(8)
    case.actual(f"path={login_page.path} alert={alert!r} token={login_page.logged_in}")
    assert not login_page.logged_in, "a session was created for invalid credentials!"
    assert login_page.path.startswith("/login"), f"navigated away from /login to {login_page.path}"
    assert alert, "no error message was surfaced to the user"


def test_invalid_login_message_does_not_enumerate_accounts(case, login_page):
    case("Authentication", "Failure message does not distinguish unknown user from bad password",
         "Both failures return the identical generic message (no account enumeration)")
    login_page.login(config.STUDENT_ID, "wrong-password-here")
    msg_bad_pw = login_page.wait_for_alert(8)
    login_page.login("NOSUCHUSER99", "wrong-password-here")
    msg_no_user = login_page.wait_for_alert(8)
    case.actual(f"bad-password={msg_bad_pw!r} unknown-user={msg_no_user!r}")
    same = msg_bad_pw == msg_no_user
    collectors.security(
        "Authentication / Account enumeration",
        "Login failure messages are identical for an unknown account and a wrong password, "
        "so the endpoint cannot be used to enumerate valid register numbers." if same else
        "Login failure messages DIFFER between an unknown account and a wrong password, "
        "allowing an attacker to enumerate valid register numbers.",
        "Low" if same else "High",
        "Keep one generic credential-rejection message for every failure mode.")
    assert same, f"messages differ: {msg_bad_pw!r} vs {msg_no_user!r}"


# ── mandatory field validation ──────────────────────────────────────────────
def test_empty_submit_shows_field_validation(case, login_page):
    case("Authentication", "Submitting an empty login form triggers client validation",
         "Inline 'Please enter…' errors appear and no request is sent")
    login_page.open().submit()
    errs = login_page.field_errors
    case.actual(f"errors={errs} path={login_page.path}")
    assert not login_page.logged_in
    assert errs, "empty submit produced no visible field errors"


def test_missing_password_is_validated(case, login_page):
    case("Authentication", "Identifier supplied without a password is blocked",
         "The password field reports a validation error and no session is created")
    login_page.open().fill(config.STUDENT_ID, "").submit()
    errs = login_page.field_errors
    case.actual(f"errors={errs}")
    assert not login_page.logged_in
    assert errs, "missing password was not validated"


def test_whitespace_identifier_is_rejected(case, login_page):
    case("Authentication", "Whitespace-only identifier is treated as empty",
         "Validation blocks the submission")
    login_page.open().fill("   ", config.STUDENT_PASSWORD).submit()
    case.actual(f"token={login_page.logged_in} errors={login_page.field_errors}")
    assert not login_page.logged_in


# ── forgot password ─────────────────────────────────────────────────────────
def test_forgot_password_shows_guidance(case, login_page):
    case("Authentication", "Forgot password control gives the user a recovery path",
         "An informational message directs the user to the admin office")
    collectors.covers("authentication-forgot-password-guidance")
    login_page.open()
    login_page.click_forgot_password()
    msg = login_page.wait_for_alert(6)
    case.actual(f"message={msg!r}")
    collectors.defect(
        "Authentication",
        "'Forgot password?' provides guidance only — there is no self-service reset flow, "
        "so a locked-out user depends entirely on manual admin intervention.",
        "1. Open /login  2. Click 'Forgot password?'  3. Only an informational message appears",
        "High", "frontend/src/pages/Login.jsx")
    assert msg, "'Forgot password?' produced no feedback at all"


# ── password visibility toggle ──────────────────────────────────────────────
def test_password_visibility_toggle(case, login_page):
    case("Authentication", "Show/hide password toggle switches the input type",
         "The field alternates between type=password and type=text")
    login_page.open().fill(config.STUDENT_ID, "secret123")
    before = login_page.password_field_type
    login_page.toggle_password_visibility()
    time.sleep(0.3)
    after = login_page.password_field_type
    case.actual(f"{before} -> {after}")
    assert before == "password" and after == "text", f"toggle did not work ({before} -> {after})"


# ── remember me ─────────────────────────────────────────────────────────────
def test_remember_me_persists_identifier(case, login_page):
    case("Authentication", "'Remember me' stores the identifier for the next visit",
         "ca_remember_id is written to localStorage after a successful login")
    login_page.open()
    login_page.set_remember(True)
    login_page.fill(config.STUDENT_ID, config.STUDENT_PASSWORD).submit()
    login_page.wait_for_path("/student/dashboard", 12)
    remembered = login_page.storage("ca_remember_id")
    case.actual(f"ca_remember_id={remembered!r}")
    assert remembered == config.STUDENT_ID, f"identifier not remembered (got {remembered!r})"


# ── logout ──────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("role", ["student", "admin", "faculty"])
def test_logout_clears_session_and_returns_to_login(case, login_page, role):
    _, _, home = config.ROLES[role]
    case("Authentication", f"Logout from the {role} portal tears the session down",
         "Token and user are cleared from localStorage and the app returns to /login")
    collectors.covers("authentication-logout-session-teardown")
    login_page.login_as(role)
    assert login_page.logged_in, f"{role} could not log in to begin with"

    ok = login_page.logout_via_ui()
    time.sleep(1.0)
    case.actual(f"clicked={ok} path={login_page.path} token={login_page.logged_in}")
    assert ok, "no logout control could be clicked"
    assert not login_page.logged_in, "session token survived logout"
    assert login_page.path.startswith("/login"), f"expected /login, got {login_page.path}"


def test_protected_route_after_logout_bounces_to_login(case, login_page, driver):
    case("Authentication", "A protected route is unreachable after logout",
         "Navigating to /student/dashboard with no session redirects to /login")
    login_page.login_as("student")
    login_page.logout_via_ui()
    page = BasePage(driver)
    page.go("/student/dashboard")
    ok = page.wait_for_path("/login", 10)
    case.actual(f"path={page.path}")
    assert ok, f"protected route reachable after logout (landed on {page.path})"


def test_authenticated_user_is_bounced_off_login(case, login_page, driver):
    case("Authentication", "An already-authenticated user cannot sit on /login",
         "RedirectIfAuthed sends them to their own portal home")
    login_page.login_as("student")
    page = BasePage(driver)
    page.go("/login")
    ok = page.wait_for_path("/student/dashboard", 10)
    case.actual(f"path={page.path}")
    assert ok, f"authenticated user stayed on {page.path}"


# ── registration ────────────────────────────────────────────────────────────
def test_registration_page_renders(case, register_page):
    case("Authentication", "Student self-registration form renders",
         "The form exposes name, ID, email, department and password controls")
    collectors.covers("authentication-student-self-registration-pending-approval")
    register_page.open()
    n_inputs = len(register_page.inputs)
    n_selects = len(register_page.selects)
    case.actual(f"{n_inputs} input(s), {n_selects} select(s)")
    assert n_inputs >= 5, f"registration form looks incomplete ({n_inputs} inputs)"


def test_registration_rejects_empty_submission(case, register_page):
    case("Authentication", "Registration blocks an empty submission",
         "Validation errors are shown and no account is created")
    register_page.open().submit()
    errs = register_page.visible_errors
    case.actual(f"path={register_page.path} errors={errs[:4]}")
    assert register_page.path.startswith("/register"), "empty registration navigated away"


def test_registration_enforces_password_policy(case):
    case("Authentication", "Registration enforces the 8-char password policy server-side",
         "POST /api/auth/register with a weak password returns HTTP 400")
    res = apiclient.api("/auth/register", "POST", payload={
        "name": "QA Probe", "studentId": "QA" + str(int(time.time()))[-6:],
        "email": f"qa{int(time.time())}@college.edu", "password": "abc",
        "department": "IT",
    })
    case.actual(f"HTTP {res.status} — {res.json().get('message','')}")
    assert res.status == 400, f"weak password accepted (HTTP {res.status})"


def test_registration_cannot_self_assign_a_role(case):
    case("Authorization", "Self-registration cannot escalate to an admin role",
         "A role field in the request body is ignored — the account is created as a student")
    stamp = str(int(time.time()))[-7:]
    res = apiclient.api("/auth/register", "POST", payload={
        "name": "QA Escalation Probe", "studentId": f"QAE{stamp}",
        "email": f"qae{stamp}@college.edu", "password": "Str0ngPass!23",
        "department": "IT", "role": "admin",
    })
    body = res.json()
    created_role = (body.get("user") or {}).get("role", "student")
    case.actual(f"HTTP {res.status} role={created_role!r} pending={body.get('pending')}")
    collectors.security(
        "Authorization / Privilege escalation",
        "POST /api/auth/register ignores a client-supplied `role`; self-registration can only "
        "ever create a student account awaiting approval."
        if created_role != "admin" else
        "POST /api/auth/register honoured a client-supplied `role` — anyone can self-register "
        "as an administrator.",
        "Low" if created_role != "admin" else "High",
        "Keep role assignment strictly server-side, never read from the request body.")
    assert created_role != "admin", "PRIVILEGE ESCALATION: registration accepted role=admin"


def test_new_registration_is_pending_approval(case):
    case("Authentication", "A new registration cannot log in until an admin approves it",
         "Registration returns pending=true with no token; login then returns HTTP 403")
    stamp = str(int(time.time()))[-7:]
    sid, pwd = f"QAP{stamp}", "Str0ngPass!23"
    reg = apiclient.api("/auth/register", "POST", payload={
        "name": "QA Pending Probe", "studentId": sid,
        "email": f"qap{stamp}@college.edu", "password": pwd, "department": "IT",
    })
    login = apiclient.api("/auth/login", "POST", payload={"identifier": sid, "password": pwd})
    case.actual(f"register HTTP {reg.status} pending={reg.json().get('pending')}; "
                f"login HTTP {login.status}")
    assert reg.status == 201, f"registration failed: {reg.status} {reg.body[:150]}"
    assert not reg.json().get("token"), "a token was issued before admin approval"
    assert login.status == 403, f"pending account logged in (HTTP {login.status})"


# ── first-run setup ─────────────────────────────────────────────────────────
def test_setup_is_disabled_once_an_admin_exists(case):
    case("Authentication", "First-run setup self-disables after the first admin exists",
         "GET /auth/setup-status reports needsSetup=false and POST /auth/setup returns 410 Gone")
    collectors.covers("authentication-first-run-administrator-setup")
    status = apiclient.api("/auth/setup-status")
    attempt = apiclient.api("/auth/setup", "POST", payload={
        "name": "QA Rogue Admin", "studentId": "QAROGUE",
        "email": "qarogue@college.edu", "password": "Str0ngPass!23",
    })
    case.actual(f"needsSetup={status.json().get('needsSetup')}, setup POST HTTP {attempt.status}")
    collectors.security(
        "Authentication / Bootstrap",
        "POST /api/auth/setup is hard-gated on there being zero admin accounts and returns "
        f"HTTP {attempt.status} once one exists, so it cannot be used to create a second admin."
        if attempt.status == 410 else
        f"POST /api/auth/setup returned HTTP {attempt.status} while an admin already exists — "
        "verify it cannot mint additional administrators.",
        "Low" if attempt.status == 410 else "High",
        "Keep the setup route gated on an admin count of zero.")
    assert status.json().get("needsSetup") is False, "setup still advertised as required"
    assert attempt.status == 410, f"setup route not sealed (HTTP {attempt.status})"


def test_change_password_requires_current_password(case):
    case("Authentication", "Change-password rejects a wrong current password",
         "PUT /api/auth/change-password returns HTTP 400 without changing anything")
    collectors.covers("authentication-change-password")
    token = apiclient.login_token("student")
    res = apiclient.api("/auth/change-password", "PUT", token=token, payload={
        "currentPassword": "definitely-not-it", "newPassword": "N3wPassword!23",
    })
    case.actual(f"HTTP {res.status} — {res.json().get('message','')}")
    assert res.status == 400, f"password changed without the current password (HTTP {res.status})"
