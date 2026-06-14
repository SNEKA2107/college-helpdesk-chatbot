# ENTERPRISE GAP ANALYSIS — CampusAssist (current-state, 2026-06-14)

> **This supersedes the earlier June-2026 gap analysis**, which was written before the Phase-1 fixes landed and is now inaccurate. The prior doc claimed "CGPA fake / no Marks model", "no Academic Calendar", "duplicate attendance possible", and "fee unverified" — all of those have since been implemented (`models/Marks.js`, `models/CalendarEvent.js`, the unique indexes on `Attendance`/`Marks`, and admin fee verification). This version reflects the code **as it actually is today**.

**Scope:** Full-stack — React frontend (`frontend/`, the deployed target), Node/Express backend, MongoDB Atlas.
**Status:** AUDIT ONLY — no code changed.

---

## System overview (verified against code)

| Layer | Reality |
|-------|---------|
| Frontend (deployed) | React 18 + Vite in `frontend/`. Render serves `frontend/dist`. |
| Frontend (legacy) | ~25 static `*.html` + `app.js` + `sw.js` at repo root — **served only as fallback when no dist build exists** (`server.js:118-122`). Effectively dead. |
| Backend | Express, 15 route files, 15 models. JWT (30d) + bcrypt, helmet, CORS allowlist, rate limiting. |
| DB | MongoDB Atlas. Collections: User, Notice, Event, Request, Leave, Fee, Marks, Attendance, Timetable, Exam, CalendarEvent, Contact, Book, BorrowedBook, Counter. |
| Notifications | Nodemailer email on request/leave status. No real-time/push. |

**What genuinely works and is DB-driven:** auth, notices, events (admin side), requests lifecycle + email, leave approval + email, marks/CGPA (real, admin-entered, server-computed), attendance (idempotent unique index), fees (record + admin verify, overpayment guarded), calendar, contact messages, library browse. Dashboard/admin stats are live counts. Good foundation.

---

## Issue Group cross-reference

| Brief Issue Group | Where analyzed | Severity here |
|-------------------|----------------|---------------|
| 1 — New user sees old data | ISO-1..4 below | Mixed (1 HIGH, rest MED/by-design) |
| 2 — Timetable not segmented | `TIMETABLE_DATA_FLOW_REPORT.md` | HIGH |
| 3 — Leave/OD documents not visible | `DOCUMENT_WORKFLOW_AUDIT.md` | CRITICAL |
| 4 — Static content | `STATIC_CONTENT_AUDIT.md` | 1 CRITICAL (fake events) + MED |

---

## ISSUE GROUP 1 — data isolation findings

| ID | Finding | Verdict |
|----|---------|---------|
| **ISO-1** | `Events.jsx` shows 8 hardcoded `DEMO_EVENTS` when the collection is empty → every user, incl. brand-new, sees fake events. | 🔴 Real leakage of fake data. Fix. (= SC-1) |
| **ISO-2** | `GET /api/timetable` falls back to *another cohort's* timetable when the student's cohort has none → new student sees a stranger's schedule. | 🔴 Cross-cohort leak. Fix. (= TT-1) |
| **ISO-3** | `GET /api/exam` returns the single latest `Exam` doc for **all** students regardless of department/semester. | 🟠 Everyone sees one global exam; not per-cohort. Fix/segment. |
| **ISO-4** | `seed.js` inserts demo notices, exam, timetable, books, a fee + 3 requests (for `22IT101`). If run against a shared DB, the global ones (notices/exam/timetable) appear as "history" to new students. | 🟡 Operational: don't seed prod; the requests/fee are correctly per-student. |
| **(good)** | Requests, Leave, Marks, Attendance, Fees all filter by `req.user` (`student`/`studentId`). New users correctly get empty states. | 🟢 Properly isolated. |
| **ISO-5** | `Events.jsx` stores registration state in `localStorage['ca_registered_events']` — **not namespaced per user** → on a shared browser, user B sees user A's "Registered" badges. | 🟡 Minor client leak. |
| **(cache)** | No server-side response cache; auth state is per-request JWT. No cross-user data caching. | 🟢 No cache leakage. |

**Institution-wide-by-design (acceptable, but should be labeled, not "historical"):** Notices, Events, Calendar entries are global to all students — that is correct for a college helpdesk. The fix is presentation (label them as campus-wide) + ensuring the underlying records are real, not demo/seed.

---

## Dead code / orphans / strays (dependency-verified)

> Removal of any of these is deferred to the **Low** phase and only after a final dependency grep. Listed here for completeness.

| Group | Items | Status |
|-------|-------|--------|
| Legacy static site | ~25 root `*.html` (`dashboard.html`, `admin-*.html`, `login.html`, …), `app.js`, `sw.js` | Served only when `frontend/dist` absent. React app fully replaces them. Candidate for removal. |
| Root dev/test scripts | `audit-*.js`, `debug-*.js`, `screenshot-*.js`, `test-*.js`, `verify-*.js`, `open-*.js`, `branding-render.js`, `generate-icons.js`, `sim_step.sh`, `test-pages.js` | Throwaway tooling, not imported by the app. |
| `selenium_model/` | Selenium HTML report | Stray artifact. |
| `.vscode/contact.html`, `.vscode/script.js` | Stray copies | Not referenced. |
| Backend ops scripts | `seed.js`, `seed-students.js`, `create-admin.js`, `reset-admin.js`, `dev-local.js`, `export-students.js`, `renumber-requests.js`, `test-seq.js` | Mostly legitimate ops/migration utilities; keep but document. `seed.js` must never run against prod. |
| Schema dead field | `Leave.document` | Declared, never used (see document audit). |

**Broken routes:** none found — the SPA catch-all + `LegacyRedirect` map old `*.html` URLs to React routes correctly. `/api` 404 handler is in place.

---

## Security / validation / permissions / audit gaps

| ID | Gap | Severity |
|----|-----|----------|
| **SEC-1** | **No audit log** of admin write actions (who approved/rejected leave, marked attendance, deleted a notice, verified a payment). Zero accountability. | HIGH |
| **SEC-2** | **Open self-registration** — `POST /api/auth/register` lets anyone create a student with any `studentId`; no admin approval, no email/OTP verification. | HIGH |
| **SEC-3** | **JWT lifetime 30 days** (`auth.js:9`), stored in localStorage, no refresh/blacklist → stolen token valid for a month. | MEDIUM |
| **SEC-4** | **Overlapping leave** allowed — no server-side date-conflict check (`leave.js` POST). | MEDIUM |
| **SEC-5** | Leave POST accepts `department`/`semester` from the body (`leave.js:22,31-32`) and the form sends editable name/regNo/dept/sem (`Leave.jsx`) that the backend ignores for identity but trusts for dept/sem — minor spoof/inconsistency surface. | LOW |
| **SEC-6** | helmet CSP allows `'unsafe-inline'` scripts + `scriptSrcAttr` (needed by the legacy inline-onclick HTML). Once the legacy site is removed, this can be tightened for the React app. | LOW |
| **(good)** | RBAC via `protect`/`adminOnly`; per-student IDOR protections on `/students/:id`, marks `?studentId` admin-gated; notice/calendar input stripped of HTML; fee overpayment rejected; attendance/marks idempotent. | 🟢 |

**Role checks:** present and consistent on all admin mutations. **Missing validations:** `students.js` PUT and `leave.js`/`timetable.js`/`exam.js` POST lack `express-validator` bodies (rely on schema only); acceptable but inconsistent with auth/notice routes.

---

## CRUD completeness (current)

| Entity | C | R | U | D | Notes |
|--------|---|---|---|---|-------|
| Notice | ✅ | ✅ | ✅ | ✅ | full |
| Event | ✅ | ✅ | ✅ | ✅ | full |
| Calendar | ✅ | ✅ | ✅ | ✅ | full |
| Marks | ✅(upsert) | ✅ | ✅ | ✅ | full, server-graded |
| Attendance | ✅ | ✅ | ✅(upsert) | ❌ | no delete/undo |
| Request | ✅ | ✅ | ✅(status) | ✅(own,Submitted) | content not editable by admin |
| Leave | ✅ | ✅ | ✅(status) | ✅(own,Pending) | no documents (see doc audit) |
| Fee | ❌(no admin create UI) | ✅ | ⚠️(verify only) | ❌ | components not editable post-create |
| Timetable | ✅ | ✅ | ✅ | ❌ | no delete/publish/archive (see TT report) |
| Exam | ✅ | ✅ | ✅ | ❌ | single global doc, no delete |
| Library/Book | ✅ | ✅ | ✅ | ❌ | no delete; no admin lend/return UI |
| Student/User | ⚠️(register only) | ✅ | ✅ | ❌ | no admin create/deactivate UI |

---

## Data flows (current)

```
Admin Notice      → Student sees            ✅
Admin Event       → Student registers       ✅ (but Events page falls back to FAKE when empty 🔴)
Student Request   → Admin sees → email      ✅
Student registers → Admin count             ✅
Admin Attendance  → Student summary         ✅ / no notification ⚠️
Admin Marks       → Student CGPA            ✅
Admin Exam        → Student sees            ✅ / not per-cohort 🟠 / instructions ignore DB 🟡
Admin Timetable   → Student sees            ✅ / cross-cohort fallback 🔴 / no year·section 🟠
Admin approve Leave → Student email          ✅ / but approved without seeing proof 🔴(doc)
Student Leave/OD doc → Admin views          ❌ (entirely broken — see doc audit)
Student Contact   → Admin resolves          ✅ / no reply back ⚠️
Student Payment   → Admin verifies          ✅
```

---

## CONSOLIDATED SEVERITY-RANKED MASTER LIST  (drives the fix phases)

### 🔴 CRITICAL — Phase 1
| # | Issue | Evidence | Group |
|---|-------|----------|-------|
| **C1** | Leave/OD documents non-functional end-to-end (upload not wired, not stored, no admin view/verify) | DOCUMENT_WORKFLOW_AUDIT | 3 |
| **C2** | Fake `DEMO_EVENTS` rendered as real to all users | `Events.jsx:9-18,30` | 1,4 |
| **C3** | Timetable cross-cohort leakage via `findOne()` fallback | `timetable.js:11-12,25-26` | 1,2 |

### 🟠 HIGH — Phase 2
| # | Issue | Evidence | Group |
|---|-------|----------|-------|
| **H1** | Timetable not segmented by year/section + no publish/archive/delete lifecycle | TIMETABLE report TT-2/3/5 | 2 |
| **H2** | Exam schedule global, ignores student dept/semester | `exam.js:8-11` | 1 |
| **H3** | OD not a real structured workflow (fields flattened into `reason`, no doc, mixed with leave) | DOC audit + `Od.jsx:60` | 3 |
| **H4** | No audit log of admin actions | SEC-1 | enterprise |
| **H5** | Open self-registration, no approval/verification | SEC-2 | enterprise |

### 🟡 MEDIUM — Phase 3
| # | Issue | Evidence |
|---|-------|----------|
| **M1** | Exam page ignores DB `instructions`; hall-ticket/receipt "download" buttons are stubs | SC-6, SC-7 |
| **M2** | Hardcoded institutional facts: chat knowledgeBase/prompt, Contact offices/FAQ, Library hours/rules, Status collection info | SC-2/3/4/5 |
| **M3** | Events registration state in localStorage not namespaced per user | ISO-5 |
| **M4** | Overlapping leave allowed; leave body trusts client dept/sem | SEC-4/5 |
| **M5** | JWT 30-day expiry, no refresh/revoke | SEC-3 |
| **M6** | Landing testimonials/stats are fabricated | SC (borderline) |
| **M7** | Admin can't create/deactivate students; can't edit fee components | CRUD table |

### 🟢 LOW — Phase 4
| # | Issue |
|---|-------|
| **L1** | Remove dead legacy static site (`*.html`, `app.js`, `sw.js`) after dependency grep |
| **L2** | Remove stray root dev/test scripts + `selenium_model/` + `.vscode` strays |
| **L3** | No pagination on `/students`, `/requests`, `/leave` lists |
| **L4** | No delete/soft-delete for library/exam; no attendance undo |
| **L5** | UX: first-login onboarding/empty-state guidance; forgot-password; contact reply; tighten CSP after legacy removal; remove dead `Leave.document` if not adopted |

---

## Scorecard (current state)

| Dimension | Score | vs prior |
|-----------|-------|----------|
| Core CRUD | 78/100 | ↑ (marks/calendar added) |
| Data integrity | 70/100 | ↑ (idempotent attendance/marks, fee verify) — held back by timetable leak & document gap |
| Security | 66/100 | ~ (RBAC good; reg/JWT/audit gaps remain) |
| Real academic data | 80/100 | ↑↑ (marks/CGPA now real) |
| Admin completeness | 70/100 | ↑ |
| Data isolation | 60/100 | new lens — events fake + timetable leak are the drags |
| Document workflow | 5/100 | broken end-to-end |
| Audit & compliance | 10/100 | no change |
| **Production readiness** | **68/100** | ↑ from 61 — solid project; the 3 criticals + timetable segmentation + audit log are the gate to "institutional". |

*AUDIT ONLY — DO NOT COMMIT.*
