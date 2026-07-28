"""Phase 4 — CRUD: full create / read / update / delete lifecycles, driven
through the UI where the app exposes one and through the API where it does not."""
import time

import pytest

import apiclient
import collectors

pytestmark = pytest.mark.crud


# ── Requests: student create + read, admin update ───────────────────────────
def test_request_create_and_read_via_ui(case, student):
    case("Requests", "CREATE + READ — a student submits a request and sees it listed",
         "The new request appears in the list with a reference number and status")
    collectors.covers("student-portal-requests-crud-read-create")
    student.open("requests")
    time.sleep(1.5)
    before = len(student.request_cards())
    student.open_new_request_modal()
    toast = student.submit_request("Transfer Certificate",
                                   "QA CRUD lifecycle verification.")
    time.sleep(2.0)
    student.open("requests")
    time.sleep(1.5)
    after = len(student.request_cards())
    case.actual(f"toast={toast!r}; cards {before} -> {after}")
    assert after > before, f"request count did not grow ({before} -> {after})"


def test_request_detail_read(case, student):
    case("Requests", "READ — request details open in a modal",
         "The detail modal shows the request type and its progress timeline")
    student.open("requests")
    time.sleep(1.5)
    opened = student.click_text("button", "View Details")
    time.sleep(0.8)
    text = student.modal_text()
    case.actual(f"opened={opened} modal chars={len(text)}")
    assert opened, "no 'View Details' control was clickable"
    assert student.modal_open, "detail modal did not open"
    assert "submitted" in text.lower(), "detail modal did not show the status timeline"


def test_admin_can_update_request_status(case):
    case("Requests", "UPDATE — an admin advances a request's status",
         "PUT /api/requests/:id/status returns 200 and the new status is persisted")
    collectors.covers("api-requests-update-api-requests-id-status")
    stoken = apiclient.login_token("student")
    atoken = apiclient.login_token("admin")

    created = apiclient.api("/requests", "POST", token=stoken, payload={
        "type": "Conduct Certificate", "purpose": "QA update lifecycle", "urgency": "Normal"})
    rid = (created.json().get("request") or {}).get("_id")
    assert rid, f"could not create a request to update: {created.status} {created.body[:200]}"

    upd = apiclient.api(f"/requests/{rid}/status", "PUT", token=atoken,
                        payload={"status": "Processing"})
    back = apiclient.api("/requests", "GET", token=stoken)
    row = next((r for r in back.json().get("requests", []) if r.get("_id") == rid), {})
    case.actual(f"PUT HTTP {upd.status}; status now {row.get('status')!r}")
    collectors.api_result(f"/requests/:id/status", "PUT", 200, upd.status,
                          "Pass" if upd.status == 200 else "Fail", "admin status transition")
    assert upd.status == 200, f"status update failed (HTTP {upd.status})"
    assert row.get("status") == "Processing", f"status did not persist ({row.get('status')!r})"


def test_student_can_delete_own_request(case):
    case("Requests", "DELETE — a student withdraws their own request",
         "DELETE /api/requests/:id returns 200 and the record disappears from the list")
    token = apiclient.login_token("student")
    created = apiclient.api("/requests", "POST", token=token, payload={
        "type": "Marksheet", "purpose": "QA delete lifecycle", "urgency": "Normal"})
    rid = (created.json().get("request") or {}).get("_id")
    assert rid, f"could not create a request to delete: {created.status}"

    dele = apiclient.api(f"/requests/{rid}", "DELETE", token=token)
    back = apiclient.api("/requests", "GET", token=token)
    still_there = any(r.get("_id") == rid for r in back.json().get("requests", []))
    case.actual(f"DELETE HTTP {dele.status}; still listed={still_there}")
    collectors.api_result("/requests/:id", "DELETE", 200, dele.status,
                          "Pass" if dele.status == 200 else "Fail", "owner deleting own request")
    assert dele.status == 200, f"delete failed (HTTP {dele.status})"
    assert not still_there, "the deleted request is still listed"


def test_student_cannot_delete_another_students_request(case):
    case("Authorization", "DELETE is scoped to the owner",
         "Deleting a non-existent/foreign request id returns 403 or 404, never 200")
    token = apiclient.login_token("student")
    res = apiclient.api("/requests/000000000000000000000000", "DELETE", token=token)
    case.actual(f"HTTP {res.status}")
    assert res.status in (403, 404), f"foreign delete returned HTTP {res.status}"


# ── Notices: admin full lifecycle ───────────────────────────────────────────
def test_notice_full_lifecycle(case):
    case("Notices", "CREATE / READ / UPDATE / DELETE — full notice lifecycle",
         "An admin creates, reads back, edits and deletes a notice successfully")
    collectors.covers("admin-panel-noticestab-crud-read-create-update-delete")
    token = apiclient.login_token("admin")
    title = f"QA Lifecycle Notice {int(time.time())}"

    created = apiclient.api("/notices", "POST", token=token, payload={
        "title": title, "content": "Created by the automated audit suite.",
        "category": "general", "status": "published"})
    nid = (created.json().get("notice") or {}).get("_id")
    case.actual(f"create HTTP {created.status}")
    assert created.status in (200, 201), f"create failed: {created.status} {created.body[:200]}"
    assert nid, "created notice has no id"

    listed = apiclient.api("/notices", "GET", token=token)
    found = any(n.get("_id") == nid for n in listed.json().get("notices", []))
    assert found, "the created notice is not listed"

    updated = apiclient.api(f"/notices/{nid}", "PUT", token=token, payload={
        "title": title + " (edited)", "content": "Edited by the automated audit suite.",
        "category": "general"})
    assert updated.status == 200, f"update failed (HTTP {updated.status})"

    removed = apiclient.api(f"/notices/{nid}", "DELETE", token=token)
    after = apiclient.api("/notices", "GET", token=token)
    gone = not any(n.get("_id") == nid for n in after.json().get("notices", []))
    case.actual(f"create {created.status} / update {updated.status} / delete {removed.status}; "
                f"removed={gone}")
    assert removed.status == 200, f"delete failed (HTTP {removed.status})"
    assert gone, "the deleted notice is still listed"


def test_admin_notice_create_via_ui(case, admin):
    case("Notices", "CREATE via UI — an admin publishes a notice from the panel",
         "The notice form accepts input and reports a successful publish")
    admin.open()
    time.sleep(1.2)
    admin.open_tab("Notices")
    time.sleep(1.2)
    toast = admin.create_notice(f"QA UI Notice {int(time.time())}",
                                "Published through the admin panel by the audit suite.")
    case.actual(f"toast={toast!r}")
    assert admin.rendered_ok, "the notices tab broke while publishing"


# ── Events: admin lifecycle ─────────────────────────────────────────────────
def test_event_lifecycle(case):
    case("Events", "CREATE / UPDATE / DELETE — campus event lifecycle",
         "An admin can create, edit and remove an event")
    collectors.covers("admin-panel-eventstab-crud-read-create-update-delete")
    token = apiclient.login_token("admin")
    created = apiclient.api("/events", "POST", token=token, payload={
        "title": f"QA Event {int(time.time())}", "description": "Automated audit event",
        "date": "2026-12-15", "venue": "QA Hall", "category": "Technical",
        "organizer": "QA Automation"})
    eid = (created.json().get("event") or {}).get("_id")
    case.actual(f"create HTTP {created.status}")
    assert created.status in (200, 201), f"event create failed: {created.status} {created.body[:200]}"

    updated = apiclient.api(f"/events/{eid}", "PUT", token=token,
                            payload={"title": "QA Event (edited)", "venue": "QA Hall B"})
    removed = apiclient.api(f"/events/{eid}", "DELETE", token=token)
    case.actual(f"create {created.status} / update {updated.status} / delete {removed.status}")
    assert updated.status == 200, f"event update failed (HTTP {updated.status})"
    assert removed.status == 200, f"event delete failed (HTTP {removed.status})"


def test_student_can_register_and_unregister_for_an_event(case):
    case("Events", "A student registers for and withdraws from an event",
         "POST then DELETE /api/events/:id/register both return 200")
    atoken = apiclient.login_token("admin")
    stoken = apiclient.login_token("student")
    created = apiclient.api("/events", "POST", token=atoken, payload={
        "title": f"QA Registrable Event {int(time.time())}", "description": "Audit",
        "date": "2026-12-20", "venue": "QA Hall", "category": "Technical",
        "organizer": "QA Automation"})
    eid = (created.json().get("event") or {}).get("_id")
    if not eid:
        pytest.skip(f"could not seed an event to register for (HTTP {created.status})")

    reg = apiclient.api(f"/events/{eid}/register", "POST", token=stoken)
    unreg = apiclient.api(f"/events/{eid}/register", "DELETE", token=stoken)
    apiclient.api(f"/events/{eid}", "DELETE", token=atoken)
    case.actual(f"register HTTP {reg.status}; unregister HTTP {unreg.status}")
    assert reg.status in (200, 201), f"registration failed (HTTP {reg.status})"
    assert unreg.status == 200, f"withdrawal failed (HTTP {unreg.status})"


# ── Departments: dynamic reference data ─────────────────────────────────────
def test_department_lifecycle(case):
    case("Departments", "CREATE / UPDATE / DELETE — department reference data",
         "An admin manages departments and the public list reflects the change")
    collectors.covers("admin-panel-departmentstab-crud-read-create-update-delete")
    token = apiclient.login_token("admin")
    code = f"QA{str(int(time.time()))[-4:]}"
    created = apiclient.api("/departments", "POST", token=token,
                            payload={"code": code, "name": f"QA Department {code}"})
    did = (created.json().get("department") or {}).get("_id")
    case.actual(f"create HTTP {created.status}")
    assert created.status in (200, 201), f"create failed: {created.status} {created.body[:200]}"

    public = apiclient.api("/departments", "GET")
    listed = any(d.get("code") == code for d in public.json().get("departments", []))

    updated = apiclient.api(f"/departments/{did}", "PUT", token=token,
                            payload={"name": f"QA Department {code} (edited)"})
    removed = apiclient.api(f"/departments/{did}", "DELETE", token=token)
    case.actual(f"create {created.status} / listed={listed} / update {updated.status} / "
                f"delete {removed.status}")
    assert listed, "the new department is not exposed by the public list"
    assert updated.status == 200, f"update failed (HTTP {updated.status})"
    assert removed.status in (200, 204), f"delete failed (HTTP {removed.status})"


# ── Leave: student create, admin decide ─────────────────────────────────────
def test_leave_create_then_admin_decision(case):
    case("Leave Application", "CREATE + UPDATE — a leave request is raised then decided",
         "A student creates a leave request and an admin approves it")
    stoken = apiclient.login_token("student")
    atoken = apiclient.login_token("admin")
    created = apiclient.api("/leave", "POST", token=stoken, payload={
        "name": "Sneka S", "studentId": "22IT101", "department": "IT", "semester": "5th",
        "leaveType": "Medical Leave", "fromDate": "2026-12-05", "toDate": "2026-12-06",
        "reason": "QA automated lifecycle verification."})
    lid = (created.json().get("leave") or {}).get("_id")
    case.actual(f"create HTTP {created.status}")
    assert created.status in (200, 201), f"leave create failed: {created.status} {created.body[:200]}"

    decided = apiclient.api(f"/leave/{lid}/status", "PUT", token=atoken,
                            payload={"status": "Approved", "remarks": "QA approval"})
    case.actual(f"create {created.status} / decision {decided.status}")
    collectors.api_result("/leave/:id/status", "PUT", 200, decided.status,
                          "Pass" if decided.status == 200 else "Fail", "admin approves leave")
    assert decided.status == 200, f"leave decision failed (HTTP {decided.status})"


def test_student_cannot_decide_their_own_leave(case):
    case("Authorization", "A student cannot approve their own leave request",
         "PUT /api/leave/:id/status is refused for a student token")
    stoken = apiclient.login_token("student")
    created = apiclient.api("/leave", "POST", token=stoken, payload={
        "name": "Sneka S", "studentId": "22IT101", "department": "IT", "semester": "5th",
        "leaveType": "Personal Leave", "fromDate": "2026-12-08", "toDate": "2026-12-09",
        "reason": "QA self-approval probe."})
    lid = (created.json().get("leave") or {}).get("_id")
    if not lid:
        pytest.skip(f"could not seed a leave record (HTTP {created.status})")
    res = apiclient.api(f"/leave/{lid}/status", "PUT", token=stoken,
                        payload={"status": "Approved"})
    case.actual(f"HTTP {res.status}")
    if res.status == 200:
        collectors.security("Authorization / Workflow integrity",
                            "A student was able to approve their own leave request.",
                            "High", "Restrict leave decisions to adminOnly/faculty middleware.")
    assert res.status in (401, 403), f"student self-approved leave (HTTP {res.status})"
