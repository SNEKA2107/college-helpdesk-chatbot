"""Phase 4 — Modals, notifications, file uploads and downloads."""
import base64
import time
from pathlib import Path

import pytest

import apiclient
import collectors
import config


# ── modals ──────────────────────────────────────────────────────────────────
@pytest.mark.ui
def test_request_modal_opens_and_closes(case, student):
    case("Requests", "The New Request modal opens and closes cleanly",
         "The modal becomes visible, then the close control dismisses it")
    collectors.covers("student-portal-requests-modal-popup-dialog")
    student.open("requests")
    time.sleep(1.5)
    opened = student.open_new_request_modal()
    was_open = student.modal_open
    closed = student.close_modal()
    time.sleep(0.6)
    still_open = student.modal_open
    case.actual(f"opened={opened} visible={was_open} closed={closed} still_open={still_open}")
    assert was_open, "the modal did not become visible"
    assert not still_open, "the modal stayed open after clicking close"


@pytest.mark.ui
def test_modal_close_button_is_labelled(case, student):
    case("Accessibility", "The modal close control has an accessible name",
         "The close button exposes aria-label='Close dialog'")
    student.open("requests")
    time.sleep(1.5)
    student.open_new_request_modal()
    btn = student.find(".modal-overlay.show .modal-close")
    label = btn.get_attribute("aria-label") if btn is not None else ""
    case.actual(f"aria-label={label!r}")
    if not label:
        collectors.accessibility("/student/requests", "Modal close button has no accessible name",
                                 "Medium", "Add aria-label to the modal close control.")
    assert label, "the modal close button has no accessible name"


@pytest.mark.ui
def test_detail_modal_shows_progress_timeline(case, student):
    case("Requests", "The request detail modal renders the status timeline",
         "Opening a request shows its stepped progress")
    student.open("requests")
    time.sleep(1.5)
    student.click_text("button", "View Details")
    time.sleep(0.8)
    text = student.modal_text().lower()
    steps = sum(1 for s in ("submitted", "review", "processing", "ready", "completed") if s in text)
    case.actual(f"{steps} timeline stage(s) present")
    assert student.modal_open, "the detail modal did not open"
    assert steps >= 2, f"the timeline rendered only {steps} recognisable stage(s)"


# ── notifications ───────────────────────────────────────────────────────────
@pytest.mark.ui
def test_toast_notification_appears_on_action(case, student):
    case("Notifications", "A toast confirms the outcome of an action",
         "Submitting a request produces a visible toast")
    collectors.covers("student-portal-requests-toast-notification")
    student.open("requests")
    time.sleep(1.5)
    student.open_new_request_modal()
    toast = student.submit_request("Migration Certificate", "QA toast verification.")
    case.actual(f"toast={toast!r}")
    if not toast:
        collectors.ui_finding("/student/requests",
                              "No toast notification appeared after submitting a request",
                              "Medium", "toast_text() timed out after 8s")
    assert toast, "no toast notification was rendered"


@pytest.mark.ui
def test_unread_notice_badge(case, student):
    case("Notifications", "The topbar notice bell is present and links to Notices",
         "The bell control links to /student/notices and may carry an unread count")
    collectors.covers("student-portal-notices-toast-notification")
    student.open("dashboard")
    time.sleep(1.2)
    bell = student.find("a.notif-btn")
    href = bell.get_attribute("href") if bell is not None else ""
    badge = student.find("span.notif-count")
    count = badge.text.strip() if badge is not None else "none"
    case.actual(f"href={href} unread badge={count}")
    assert bell is not None, "the notification bell is missing from the topbar"
    assert "/student/notices" in href, f"the bell links to {href!r}"


@pytest.mark.ui
def test_faculty_notifications_page(case, faculty):
    case("Faculty Portal", "The faculty notifications feed renders",
         "/faculty/notifications loads without error and shows its feed")
    collectors.covers("faculty-portal-facultynotifications-crud-read")
    faculty.open("notifications")
    time.sleep(1.5)
    case.actual(f"path={faculty.path}, {len(faculty.body_text)} chars")
    assert faculty.rendered_ok, "the notifications page rendered empty"


# ── uploads ─────────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def sample_pdf():
    """A tiny but structurally valid PDF used as an upload fixture."""
    path = config.EVIDENCE_DIR / "qa_upload_sample.pdf"
    if not path.exists():
        path.write_bytes(
            b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
            b"2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n"
            b"trailer<</Root 1 0 R>>\n%%EOF\n")
    return path


@pytest.mark.ui
def test_leave_supports_document_upload(case, student, sample_pdf):
    case("Leave Application", "Upload — a supporting document can be attached",
         "The file input accepts a PDF and the form retains the selection")
    collectors.covers("student-portal-leave-file-upload")
    student.open("leave")
    time.sleep(1.2)
    inputs = student.file_inputs()
    if not inputs:
        pytest.skip("no file input is rendered on the leave form")
    inputs[0].send_keys(str(sample_pdf))
    time.sleep(1.0)
    value = inputs[0].get_attribute("value") or ""
    accept = inputs[0].get_attribute("accept") or ""
    case.actual(f"selected={value.split(chr(92))[-1]!r} accept={accept!r}")
    if not accept:
        collectors.ui_finding("/student/leave", "File input does not restrict accepted types",
                              "Low", "no accept attribute on the upload control")
    assert value, "the file input did not accept the document"


@pytest.mark.ui
def test_upload_restricts_file_types(case, student):
    case("Leave Application", "Upload — the control restricts file types",
         "The file input declares an accept list of document/image types")
    student.open("leave")
    time.sleep(1.2)
    inputs = student.file_inputs()
    if not inputs:
        pytest.skip("no file input is rendered on the leave form")
    accept = inputs[0].get_attribute("accept") or ""
    case.actual(f"accept={accept!r}")
    assert accept, "the upload control accepts any file type"


@pytest.mark.ui
def test_document_upload_round_trip(case):
    case("Leave Application", "Upload — an attached document is stored and retrievable",
         "A leave request with a document can be fetched back through the document endpoint")
    token = apiclient.login_token("student")
    doc = base64.b64encode(b"%PDF-1.4 QA audit evidence").decode()
    created = apiclient.api("/leave", "POST", token=token, payload={
        "name": "Sneka S", "studentId": "22IT101", "department": "IT", "semester": "5th",
        "leaveType": "Medical Leave", "fromDate": "2026-12-11", "toDate": "2026-12-12",
        "reason": "QA upload round trip.",
        "document": f"data:application/pdf;base64,{doc}",
        "documentName": "qa-evidence.pdf",
    })
    lid = (created.json().get("leave") or {}).get("_id")
    if not lid:
        pytest.skip(f"could not create a leave record with a document (HTTP {created.status})")
    fetched = apiclient.api(f"/leave/{lid}/document", "GET", token=token)
    case.actual(f"create HTTP {created.status}; document fetch HTTP {fetched.status}")
    collectors.api_result("/leave/:id/document", "GET", 200, fetched.status,
                          "Pass" if fetched.status == 200 else "Fail", "uploaded document retrieval")
    assert fetched.status == 200, f"the uploaded document could not be retrieved " \
                                  f"(HTTP {fetched.status})"


@pytest.mark.ui
def test_upload_owner_scoping(case):
    case("Authorization", "Upload — a document is only readable by its owner",
         "Fetching an unknown/foreign document id returns 403 or 404")
    token = apiclient.login_token("student")
    res = apiclient.api("/leave/000000000000000000000000/document", "GET", token=token)
    case.actual(f"HTTP {res.status}")
    assert res.status in (403, 404), f"foreign document fetch returned HTTP {res.status}"


# ── downloads ───────────────────────────────────────────────────────────────
@pytest.mark.ui
def test_download_controls_exist(case, student):
    case("Downloads", "Download/export controls are offered where the UI promises them",
         "At least one download or export affordance is present in the student portal")
    collectors.covers("student-portal-fees-download-export")
    found = {}
    for page in ("fees", "exam", "coursework", "attendance"):
        student.open(page)
        time.sleep(1.0)
        text = student.body_text.lower()
        found[page] = any(k in text for k in ("download", "export", "hall ticket", "receipt"))
    case.actual(str(found))
    assert any(found.values()), f"no download affordance found on any page: {found}"


@pytest.mark.ui
def test_coursework_material_download_endpoint(case):
    case("Coursework", "Download — study material files are served",
         "The materials list is retrievable and file downloads resolve or 404 cleanly")
    token = apiclient.login_token("student")
    listing = apiclient.api("/coursework/materials", "GET", token=token)
    items = listing.json().get("materials") or []
    status = None
    if items and items[0].get("_id"):
        status = apiclient.api(f"/coursework/materials/{items[0]['_id']}/file",
                               "GET", token=token).status
    case.actual(f"list HTTP {listing.status}, {len(items)} material(s), file HTTP {status}")
    collectors.api_result("/coursework/materials", "GET", 200, listing.status,
                          "Pass" if listing.status == 200 else "Fail", "materials listing")
    assert listing.status == 200, f"materials listing failed (HTTP {listing.status})"
    if status is not None:
        assert status < 500, f"material download raised a server error (HTTP {status})"
