# CampusAssist v1.0 — User Acceptance Testing (UAT) Scenarios

**Build:** v1.0-rc1 · **Date:** 2026-07-22 · **Owner:** QA Lead

**Demo accounts:** Student `22IT101 / student123` · Admin `ADMIN01 / admin@123`
**Priority:** P1 = pilot-blocking · P2 = important · P3 = nice-to-have
**Status legend:** ✅ Pass · ❌ Fail · ⬜ To execute in pilot · 🔎 *Backend contract verified during RC testing (API returns correct data/status); UI execution to be confirmed in pilot.*

> **Faculty note:** there is no faculty login role. Faculty cases (UAT-F*) are executed by a **staff member using an admin account**. See `PILOT_TEST_PLAN.md` §3.

---

## A. STUDENT

### UAT-S01 — Login · P1
- **Preconditions:** Approved student account exists; user on the login page.
- **Steps:** Enter Student ID + password → Submit.
- **Expected:** JWT issued; redirected to Home; no password echoed anywhere; wrong credentials show a generic "Invalid Student ID or password."
- **Status:** 🔎 (login 200, token issued, password stripped — verified)

### UAT-S02 — View Dashboard (Home / Success) · P1
- **Preconditions:** Logged in as student.
- **Steps:** Land on Home; open Success Dashboard.
- **Expected:** AI Daily Briefing, success score + grade, attendance risk, upcoming exams, placement snapshot, notice feed, and Copilot activity all render; no "Could not load" error.
- **Status:** 🔎 (`/home`,`/success` → 200 with full payload)

### UAT-S03 — Attendance · P1
- **Preconditions:** Attendance records exist for the student.
- **Steps:** Open Attendance; review overall % and per-subject breakdown.
- **Expected:** Overall %, per-subject rows, and below-75% flags display correctly; matches source data.
- **Status:** 🔎 (`/attendance`,`/attendance/summary` → 200)

### UAT-S04 — Fees · P1
- **Preconditions:** Fee record exists for the student.
- **Steps:** Open Fees; view components, balance, and payment history; (optional) record a payment.
- **Expected:** Totals, verified-vs-unverified amounts, and status (Paid only when verified ≥ total) display correctly.
- **Status:** 🔎 (`/fees` → 200; verified-payment logic unit-tested)

### UAT-S05 — Leave · P1
- **Preconditions:** Logged in as student.
- **Steps:** Submit a leave application (type, dates, reason, optional document); view its status; cancel a pending one.
- **Expected:** Submission returns 201; appears as Pending; cancel allowed only while Pending; documents guarded by ownership.
- **Status:** 🔎 (`/leave` GET 200; POST/DELETE ownership-checked)

### UAT-S06 — Notices · P1
- **Preconditions:** Active notices exist for the student's audience.
- **Steps:** Open Notices; read a notice and its AI summary/action items.
- **Expected:** Only active, in-audience notices show; pinned first; summaries/priority render.
- **Status:** 🔎 (`/notices` → 200)

### UAT-S07 — Timetable · P1
- **Preconditions:** Student's cohort has a **published** timetable (e.g., IT/5th).
- **Steps:** Open Timetable; view weekly grid and "today."
- **Expected:** Full weekly schedule renders; today's classes highlighted. Cohorts without a published timetable see a clear "not published yet" message (not an error).
- **Status:** 🔎 (`/timetable`,`/timetable/today` → 200 after RC data fix)

### UAT-S08 — Chat (Campus Copilot) · P2
- **Preconditions:** Logged in as student.
- **Steps:** Ask a question; observe reply; open a saved conversation; ask a suggested follow-up.
- **Expected:** Reply returns (AI when key set, else keyword-bot fallback — never an error); conversation persists in the sidebar.
- **Status:** 🔎 (`/chat` POST, `/conversations` → 200; AI degrades gracefully)

### UAT-S09 — Profile · P2
- **Preconditions:** Logged in as student.
- **Steps:** Open Profile; edit an allowed field (e.g., phone); save; change password.
- **Expected:** Allowed fields update; role/department NOT editable by student; password change requires current password.
- **Status:** 🔎 (`/auth/me`,`/auth/profile`,`/auth/change-password`; field whitelist verified)

### UAT-S10 — Logout · P1
- **Preconditions:** Logged in as student.
- **Steps:** Click Logout.
- **Expected:** Session/token cleared client-side; protected routes redirect to login; back-button does not expose data.
- **Status:** ⬜

---

## B. FACULTY (executed via admin/staff account)

### UAT-F01 — Login · P1
- **Preconditions:** Staff has an admin-role account.
- **Steps:** Log in with admin credentials.
- **Expected:** Access to admin console; student-only views are not the landing context.
- **Status:** 🔎 (admin login 200)

### UAT-F02 — Attendance Management · P1
- **Preconditions:** Admin logged in; class roster available.
- **Steps:** Mark attendance for a subject/day (single and bulk).
- **Expected:** Records created/updated idempotently (re-marking the same day never duplicates); created/updated/skipped counts returned.
- **Status:** 🔎 (`POST /attendance`, `/attendance/bulk` adminOnly; idempotency unit-tested — CRIT-04)

### UAT-F03 — Student Lookup · P1
- **Preconditions:** Admin logged in.
- **Steps:** Search students by name/ID; open a student record.
- **Expected:** Search returns matching students; detail view shows academic data; access restricted to admin.
- **Status:** 🔎 (`/students`, `/students/search/:q`, `/students/:id` adminOnly → 200; student → 403)

### UAT-F04 — Notices · P2
- **Preconditions:** Admin logged in.
- **Steps:** Create/edit a notice targeting an audience; publish.
- **Expected:** Notice created with lifecycle status; appears to the correct audience; AI summary generated (or graceful fallback).
- **Status:** 🔎 (`POST/PUT /notices` adminOnly)

### UAT-F05 — Requests · P2
- **Preconditions:** Pending student requests exist.
- **Steps:** View request queue + stats; update a request's status.
- **Expected:** Queue and stats load; status transitions persist; student sees the updated status.
- **Status:** 🔎 (`/requests`,`/requests/stats` 200; `PUT /requests/:id/status` adminOnly)

---

## C. ADMIN

### UAT-A01 — User Management · P1
- **Preconditions:** Pending registrations exist.
- **Steps:** View pending users; approve one; reject one with a reason; view active users.
- **Expected:** Approve enables login; reject blocks login with the reason; actions recorded in audit log.
- **Status:** 🔎 (`/students/pending`, `/:id/approve`, `/:id/reject` adminOnly; login gate on approvalStatus verified)

### UAT-A02 — Department Management · P2
- **Preconditions:** Admin logged in.
- **Steps:** Assign/adjust a student's department/semester/section via the student record; scope notices/timetables by department.
- **Expected:** Cohort fields update; cohort-scoped content (timetable/exams/notices) resolves correctly for that department+semester.
- **Note:** "Department" is an **attribute on users/content**, not a standalone management module. See `PILOT_RISK_REGISTER.md` R-08.
- **Status:** 🔎 (`PUT /students/:id` admin can set department; cohort resolution unit-tested)

### UAT-A03 — Notices · P1
- **Steps:** Create, edit, publish, and archive notices; pin one.
- **Expected:** Full lifecycle (draft→published→archived) works; pinned notices sort first; audience targeting respected.
- **Status:** 🔎 (adminOnly CRUD verified)

### UAT-A04 — Events · P2
- **Preconditions:** Admin logged in.
- **Steps:** Create an event; students register/unregister; delete an event.
- **Expected:** Event CRUD works (admin); students can register/unregister their own attendance.
- **Status:** 🔎 (`/events` GET 200; admin CRUD + student self-register routes present)

### UAT-A05 — Analytics · P2
- **Preconditions:** Admin logged in; data present.
- **Steps:** Open Analytics dashboard.
- **Expected:** Aggregate metrics/charts render without error; admin-only.
- **Status:** 🔎 (`/analytics` adminOnly → 200; student → 403)

### UAT-A06 — Reports · P2
- **Preconditions:** Admin logged in.
- **Steps:** View/export tabular data (students, fees, audit).
- **Expected:** Admin-scoped data lists load (`/students`, `/fees/all`, `/audit`); export where offered.
- **Note:** Reporting = data lists + CSV/SQL export artifacts, not a dedicated BI module. See `PILOT_RISK_REGISTER.md` R-08.
- **Status:** 🔎 (`/students`,`/fees/all`,`/audit` adminOnly → 200)

### UAT-A07 — AI Knowledge Base · P2
- **Preconditions:** Admin logged in.
- **Steps:** Create/edit a knowledge article/document; view knowledge analytics.
- **Expected:** KB CRUD works; entries feed the Copilot; analytics load; admin-only.
- **Status:** 🔎 (`/knowledge`, `/knowledge/analytics` adminOnly → 200; student → 403)

### UAT-A08 — Audit Log · P2
- **Steps:** Open the audit log after performing privileged actions.
- **Expected:** Approvals/rejections and other privileged actions are recorded with actor + timestamp.
- **Status:** 🔎 (`/audit` adminOnly → 200)

---

## Execution summary (RC pre-verification)
- **Backend contract verified (🔎):** 26 of 28 cases — every listed endpoint returns the correct status/shape and enforces auth/roles (student vs admin 401/403/200 all correct).
- **To execute in pilot (⬜):** UI-level confirmation of logout session handling (UAT-S10) and full click-through of every screen by real users.
- **No case is currently Failing.** Pass/Fail is finalized by pilot testers against live UI.
