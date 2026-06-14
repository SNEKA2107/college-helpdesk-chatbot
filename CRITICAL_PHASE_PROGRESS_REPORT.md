# CRITICAL PHASE — PROGRESS REPORT (Phase 1)

**Date:** 2026-06-14 · **Scope:** Critical issues only · **Commit/push:** none (per instruction)

Per-issue Root Cause → Solution → Impact → Regression risk. All implemented; verification in the Completion Report.

---

## C1 — Dashboard Data Isolation
- **Root cause:** Core widgets were already server-filtered by `req.user`; the real leaks were (a) `Events.jsx` substituting 8 fabricated `DEMO_EVENTS` when the collection is empty, and (b) a **shared** `localStorage` key (`ca_registered_events`) leaking one user's event-registration badges to the next user on the same browser. Institution-wide content was correct but unlabeled.
- **Solution:** Removed `DEMO_EVENTS` and its fallback (use the existing empty state); namespaced the key to `ca_registered_events_<studentId>`; added "Campus-wide" captions on the Dashboard Events/Notifications cards (text only).
- **DB:** none · **API:** none · **Frontend:** `Events.jsx`, `Dashboard.jsx` · **Security:** removes a minor cross-user UI leak · **Regression risk:** very low.

## C2 — Timetable Foundation
- **Root cause:** Model lacked year/section; student lookup did `findOne({dept,sem}) || findOne()` → served another cohort's timetable when none matched (cross-cohort leak).
- **Solution:** Added `year`/`section`/`status` to `Timetable` and `year`/`section` to `User`; rewrote the lookup as a scoped, specificity-ranked resolver that **never leaves the student's department+semester** and returns a clean 404 when there's no match; added Year/Section to the admin form and registration. (Publish/archive workflow deferred to Phase 2 — only the `status` field foundation was laid.)
- **DB:** new optional fields (back-compatible) · **API:** lookup + register/profile/student-edit bodies · **Frontend:** `TimetableTab.jsx`, `Register.jsx` · **Regression risk:** low — existing single-timetable students still match on dept+sem.

## C3 — Leave/OD Document Workflow
- **Root cause:** file inputs unwired (no `onChange`), POST ignored `document`, no storage, no serving.
- **Solution:** base64-in-Mongo. Wired inputs (validate → `FileReader` → base64), backend validates (MIME/ext/size/base64/filename) and stores, list excludes the blob, new owner-or-admin `GET /api/leave/:id/document`. Students can view their own attachment.
- **DB:** `Leave.documentName`/`documentType` added, `document` now used · **API:** POST accepts doc + new GET endpoint · **Frontend:** `utils/file.js` (new), `Leave.jsx`, `Od.jsx` · **Security:** strict validation + owner/admin gate · **Regression risk:** low (document optional).

## C4 — Admin Document Visibility & Approval
- **Root cause:** `LeavesTab` had no document column — admins approved blind.
- **Solution:** Added a "Document" column with Preview + Download (auth'd fetch → Blob), "—" when none, graceful errors. Approve/Reject unchanged. OD requests already appear in this tab (as a `leaveType`); student details & request status confirmed visible in `StudentsTab`/`RequestsTab` (no change needed).
- **DB:** none · **API:** consumes the C3 endpoint · **Frontend:** `LeavesTab.jsx` · **Regression risk:** very low (additive column).

---

**Storage architecture rationale:** see `DOCUMENT_STORAGE_ARCHITECTURE.md`.
**Out of scope (held for approval):** timetable publish/archive, registration approval, exam cohort management, audit logging, all High/Medium/Low items.

*DO NOT COMMIT.*
