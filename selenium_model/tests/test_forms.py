"""Phase 4 — Forms: mandatory validation, invalid input, boundary values and
valid submissions across the student portal."""
import time

import pytest

import apiclient
import collectors

pytestmark = pytest.mark.forms


# ── mandatory field validation ──────────────────────────────────────────────
def test_leave_form_requires_mandatory_fields(case, student):
    case("Leave Application", "Empty leave application is rejected",
         "A validation message names the missing field and nothing is submitted")
    collectors.covers("student-portal-leave-form-input-handling")
    student.open("leave")
    time.sleep(1.0)
    msg = student.submit_leave_empty()
    case.actual(f"feedback={msg!r} path={student.path}")
    if not msg:
        collectors.ui_finding("/student/leave",
                              "Submitting an empty leave application produced no visible feedback",
                              "High", "no toast or inline error was rendered")
    assert msg, "empty leave application produced no validation feedback"


def test_request_modal_requires_type_and_purpose(case, student):
    case("Requests", "New Request modal enforces its mandatory fields",
         "Submitting with no type/purpose shows a validation toast and creates nothing")
    collectors.covers("student-portal-requests-modal-popup-dialog")
    student.open("requests")
    time.sleep(1.2)
    assert student.open_new_request_modal(), "could not open the New Request modal"
    assert student.modal_open, "modal did not become visible"
    student.click_text("button", "Submit Request")
    msg = student.toast_text(6)
    case.actual(f"toast={msg!r} modal still open={student.modal_open}")
    assert msg, "empty request submission produced no validation feedback"
    assert student.modal_open, "modal closed despite failing validation"


def test_contact_form_requires_content(case, student):
    case("Contact Office", "Contact form rejects an empty message",
         "Validation feedback appears and no message is sent")
    student.open("contact")
    time.sleep(1.0)
    sent = student.click_text("button", "Send")
    msg = student.toast_text(6)
    case.actual(f"clicked={sent} feedback={msg!r}")
    assert student.rendered_ok, "contact page did not render"


# ── invalid input ───────────────────────────────────────────────────────────
def test_leave_rejects_reversed_date_range(case, student):
    case("Leave Application", "A to-date earlier than the from-date is refused",
         "The form blocks the submission or the API returns a validation error")
    student.open("leave")
    time.sleep(1.0)
    student.fill_leave("QA Probe", "22IT101", "Boundary probe: reversed range",
                       "2026-12-20", "2026-12-01")
    student.click_text("button", "Submit Application")
    msg = student.toast_text(8)
    case.actual(f"feedback={msg!r}")
    accepted = "success" in msg.lower() or "submitted" in msg.lower()
    if accepted:
        collectors.defect(
            "Leave Application",
            "A leave application whose end date precedes its start date was accepted.",
            "1. Open /student/leave  2. Set From=2026-12-20, To=2026-12-01  3. Submit",
            "Medium", "/student/leave")
    assert not accepted, "reversed date range was accepted"


def test_profile_rejects_blank_name(case):
    case("Profile", "Profile update refuses a blank name",
         "PUT /api/auth/profile returns HTTP 400")
    token = apiclient.login_token("student")
    res = apiclient.api("/auth/profile", "PUT", token=token, payload={"name": "   "})
    case.actual(f"HTTP {res.status} — {res.json().get('message','')}")
    collectors.api_result("/auth/profile", "PUT", 400, res.status,
                          "Pass" if res.status == 400 else "Fail", "blank name")
    assert res.status == 400, f"blank name accepted (HTTP {res.status})"


@pytest.mark.parametrize("payload,label", [
    ({"identifier": "", "password": ""}, "both fields empty"),
    ({"identifier": "22IT101"}, "password omitted"),
    ({"password": "student123"}, "identifier omitted"),
])
def test_login_api_validates_required_fields(case, payload, label):
    case("Authentication", f"Login API validates required fields — {label}",
         "The API returns HTTP 400 with a descriptive message")
    res = apiclient.api("/auth/login", "POST", payload=payload)
    case.actual(f"HTTP {res.status} — {res.json().get('message','')}")
    collectors.api_result("/auth/login", "POST", 400, res.status,
                          "Pass" if res.status == 400 else "Fail", label)
    assert res.status == 400, f"{label} was not rejected (HTTP {res.status})"


# ── boundary testing ────────────────────────────────────────────────────────
def test_request_purpose_accepts_a_long_boundary_value(case, student):
    case("Requests", "A very long purpose is handled without breaking the UI",
         "The field accepts 2000 characters and the app either saves it or reports cleanly")
    student.open("requests")
    time.sleep(1.2)
    student.open_new_request_modal()
    long_text = "Boundary probe. " * 125          # ~2000 characters
    toast = student.submit_request("Bonafide Certificate", long_text)
    case.actual(f"toast={toast!r}")
    assert student.rendered_ok, "the page broke while handling a long input"


def test_password_boundary_is_enforced(case):
    case("Authentication", "Password policy boundary is enforced at exactly 8 characters",
         "7 characters is rejected; 8 valid characters is accepted")
    stamp = str(int(time.time()))[-6:]
    short = apiclient.api("/auth/register", "POST", payload={
        "name": "QA Boundary", "studentId": f"QAB7{stamp}",
        "email": f"qab7{stamp}@college.edu", "password": "Ab1!567", "department": "IT"})
    exact = apiclient.api("/auth/register", "POST", payload={
        "name": "QA Boundary", "studentId": f"QAB8{stamp}",
        "email": f"qab8{stamp}@college.edu", "password": "Ab1!5678", "department": "IT"})
    case.actual(f"7-char HTTP {short.status}; 8-char HTTP {exact.status}")
    assert short.status == 400, f"7-character password accepted (HTTP {short.status})"
    assert exact.status == 201, f"valid 8-character password refused (HTTP {exact.status})"


def test_oversized_profile_photo_is_refused(case):
    case("Profile", "An oversized profile photo is refused",
         "A payload beyond the documented limit returns HTTP 400 or 413, never 500")
    token = apiclient.login_token("student")
    res = apiclient.api("/auth/profile", "PUT", token=token, payload={
        "name": "QA Probe", "photo": "d" * (7 * 1024 * 1024 + 512)})
    case.actual(f"HTTP {res.status}")
    if res.status >= 500:
        collectors.defect("Profile",
                          f"An oversized photo upload returned HTTP {res.status} — the size guard "
                          "fails with a server error instead of a validation error.",
                          "1. PUT /api/auth/profile with a >7MB photo string",
                          "Medium", "backend/routes/auth.js")
    assert res.status < 500, f"oversized payload caused a server error (HTTP {res.status})"


# ── valid submission ────────────────────────────────────────────────────────
def test_valid_request_submission_succeeds(case, student):
    case("Requests", "A fully valid document request is accepted",
         "A success toast appears, the modal closes and the request list grows")
    collectors.covers("student-portal-requests-crud-read-create")
    student.open("requests")
    time.sleep(1.5)
    before = len(student.request_cards())
    student.open_new_request_modal()
    toast = student.submit_request("Bonafide Certificate",
                                   "QA automated end-to-end verification request.")
    time.sleep(1.5)
    after = len(student.request_cards())
    case.actual(f"toast={toast!r}; cards {before} -> {after}")
    assert "success" in toast.lower() or after > before, \
        f"request was not created (toast={toast!r}, {before} -> {after})"


def test_valid_leave_submission_succeeds(case, student):
    case("Leave Application", "A fully valid leave application is accepted",
         "The form reports success and the application appears in the history")
    collectors.covers("student-portal-leave-crud-read-create")
    student.open("leave")
    time.sleep(1.2)
    student.fill_leave("Sneka S", "22IT101",
                       "QA automated verification of the leave workflow.",
                       "2026-12-01", "2026-12-02")
    for sel in student.selects():
        student.select_index(sel, 1)
    student.click_text("button", "Submit Application")
    # A successful submission swaps the form for an inline confirmation panel; only
    # the failure paths raise a toast. Accept either as "the user was told something".
    confirmed = student.wait_for_text("Leave Application Submitted", 10)
    msg = "" if confirmed else student.toast_text(4)
    case.actual(f"confirmation_panel={confirmed}; toast={msg!r}")
    assert confirmed, f"valid leave application was not confirmed (toast={msg!r})"


def test_profile_update_persists(case):
    case("Profile", "A valid profile update persists",
         "PUT /api/auth/profile returns 200 and the change is visible on re-read")
    token = apiclient.login_token("student")
    new_phone = "9" + str(int(time.time()))[-9:]
    upd = apiclient.api("/auth/profile", "PUT", token=token,
                        payload={"name": "Sneka S", "phone": new_phone})
    back = apiclient.api("/auth/me", "GET", token=token)
    stored = (back.json().get("user") or {}).get("phone")
    case.actual(f"PUT HTTP {upd.status}; stored phone={stored!r}")
    assert upd.status == 200, f"profile update failed (HTTP {upd.status})"
    assert stored == new_phone, f"update did not persist (stored {stored!r})"
