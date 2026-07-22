# CampusAssist — Implementation Audit & Bug Tracker

**Audit date:** 2026-07-22
**Scope:** Real implementation audit for pilot readiness (not architecture review)
**Environment:** Local backend (`node backend/server.js` @ :5000) → MongoDB Atlas (same cluster as prod) → serving `frontend/dist` (the `origin/main` React build that Render deploys)
**Method:** Full live endpoint sweep (student + admin + unauthenticated), source review of every route/middleware/model, live IDOR/privilege-escalation probes, and the Node test suite. Every page was audited through its backing API contract (the data layer each page renders from).

---

## Summary

| Severity | Found | Fixed | Remaining |
|----------|-------|-------|-----------|
| Critical | 1 | 1 | 0 |
| High     | 1 | 1 | 0 |
| Medium   | 2 | 0 | 2 (documented, non-blocking) |
| Low      | 2 | 1 | 1 (documented) |

**All Critical and High bugs are fixed and verified. No runtime exceptions, no 5xx, no auth/authz gaps.**

---

## BUG-001 — Backend was 9 commits behind the frontend build (6 endpoint groups missing)

- **Severity:** 🔴 Critical
- **Status:** ✅ Fixed & verified
- **Root cause:** The running `frontend/dist` is the full `origin/main` build (Home, Success, Placement, Chat-with-conversations, Admin Knowledge/Faculty/Analytics). The local backend source was 9 commits behind `origin/main` and was missing the routes those pages call: `/api/placement`, `/api/success`, `/api/conversations`, `/api/faculty`, `/api/knowledge`, `/api/analytics` (plus the services/models behind them). Every one of those pages would fail with 404s. (The prior session had only patched `/api/home`.)
- **Files changed:** `backend/` synchronized to `origin/main` — added `routes/{placement,success,conversations,faculty,knowledge,analytics}.js`, `services/{placementEngine,aiAgent,summarizer,successEngine,homeBriefing}.js`, `models/{SuccessMetric,QueryLog,Conversation,Faculty,KnowledgeArticle,KnowledgeDocument,Message}.js`, `utils/intentCategory.js`, and the corresponding mounts in `server.js`. No dependency changes required (`@anthropic-ai/sdk` already installed).
- **Verification:** Clean boot (all 23 route modules `require` without error), MongoDB connected. Full sweep: all 6 previously-missing endpoints now return `200` for authorized users and `401` unauthenticated. No regressions on the pre-existing 17 endpoints.

---

## BUG-002 — Timetable page returned 404 for the demo student (two compounded data drifts)

- **Severity:** 🟠 High
- **Status:** ✅ Fixed & verified
- **Root cause:** `GET /api/timetable` (→ `resolveTimetableForUser`) requires a **published** timetable matching the student's exact `department + semester`. Two data-only drifts broke the match — the application logic is correct and intentionally strict (prevents cross-cohort / draft leakage):
  1. Demo student `22IT101` had `semester: ""` (blank) — only 4 of 1021 students were affected, but the demo login was one of them. The resolver short-circuits to `null` on a blank cohort.
  2. The single published timetable document (IT / 5th) **predated the `status` field** and was stored with no `status` at all, so it failed the `status: 'published'` filter (schema defaults apply only on creation, never to already-stored docs).
- **Fix (data backfill — no logic change, per the "seed data" rule):**
  - Set `22IT101.semester = "5th"` (its true cohort, matching the exam cohort and the timetable).
  - Backfilled `status: "published"` on the 1 timetable document missing the field.
- **Files changed:** None (data-only correction on the Atlas records). A regression test was added — see BUG-005.
- **Verification:** `GET /api/timetable` → `200` with the full weekly schedule (Mon–Sat, 7 periods/day); `GET /api/timetable/today` → `200`. Re-ran full sweep: no anomalies.

> Note: Admin `GET /api/timetable` and `GET /api/fees` return `404` — this is **expected** (admins have no personal cohort/fee record; they use `/api/timetable/all` and `/api/fees/all`, both verified `200`). Not a bug.

---

## BUG-003 — N+1 queries in bulk attendance marking

- **Severity:** 🟡 Medium
- **Status:** ⏳ Open (documented; non-blocking for pilot)
- **Root cause:** `POST /api/attendance/bulk` (`routes/attendance.js`) loops over each record doing a sequential `User.findOne()` + `Attendance.findOneAndUpdate()`. A 60-student roster ≈ 120 sequential round-trips.
- **Impact:** Admin-only, low-frequency, functionally correct and idempotent (CRIT-04). Acceptable at pilot class sizes; would grow linearly for large rosters.
- **Recommended fix (post-pilot):** One `User.find({ studentId: { $in } })` lookup + a single `bulkWrite` of upserts.

## BUG-004 — Only one cohort has a published timetable

- **Severity:** 🟡 Medium
- **Status:** ⏳ Open (admin data-entry gap, not a code defect)
- **Root cause:** Only IT/5th has a published timetable. The ~1000 students in even semesters (2nd/4th/6th/8th) will correctly see "No timetable has been published for your class yet."
- **Recommended fix:** Admins publish a timetable per active cohort before broadening the pilot beyond the demo cohort. No code change.

## BUG-005 — Thin automated test coverage / Windows test-runner invocation

- **Severity:** 🟢 Low
- **Status:** ✅ Partially fixed (critical regression test added; runner note documented)
- **Root cause:** Only 5 model-level tests existed (attendance dedup, marks uniqueness, CGPA, fee status). No coverage for the timetable resolution that just failed. Separately, `node --test tests/` fails on Windows with a dir-glob quirk (`Cannot find module …\tests`) — Linux/CI is unaffected.
- **Fix:** Added `backend/tests/timetable-cohort.test.js` (4 tests) locking in the cohort-isolation + published-status contract, including a test that reproduces the exact BUG-002 statusless-document defect. Updated the `npm test` script to run both suites by explicit path (cross-platform safe).
- **Files changed:** `backend/tests/timetable-cohort.test.js` (new), `backend/package.json` (`test` script).
- **Verification:** `npm test` → **9/9 passing**.

---

## Security audit (STEP 3) — result: strong, no findings

| Check | Result |
|-------|--------|
| Authentication (JWT) | ✅ `protect` verifies against `JWT_SECRET`, loads user, strips password; invalid/expired → 401 |
| Authorization (roles) | ✅ `adminOnly` on every mutating/admin route; students → 403 (verified live on 10 admin routes) |
| BOLA / IDOR | ✅ Ownership enforced: `students PUT /:id` (own-or-admin + field whitelist), `conversations/:id` (user-scoped query), `leave`/`requests` deletes (owner check). Live probe: cross-student edit → 403 |
| Privilege escalation | ✅ Student `PUT /students/:id {role:'admin'}` → role stays `student` (non-admin field whitelist blocks it) |
| Password handling | ✅ bcrypt cost 12, `minlength: 8`, `toJSON` strips hash — login response contains **no** password field (verified live) |
| Input validation | ✅ `express-validator` on auth; body guards on POST routes; JSON body capped at 5mb |
| CORS | ✅ Explicit origin allowlist, denies unknown origins without throwing |
| Helmet / CSP | ✅ Enabled with a tuned Content-Security-Policy |
| Rate limiting | ✅ Auth limiter (20 / 15 min) + global limiter (150 / min), `trust proxy` set for correct IP |
| Secrets | ✅ `JWT_SECRET` / `MONGO_URI` from env; no hardcoded secrets in source |
| User enumeration | ✅ Login returns a generic "Invalid Student ID or password" |

## Page audit (STEP 1) — all backing endpoints healthy

Login ✓ · Student Dashboard (`/home`,`/success`) ✓ · Admin Dashboard (`/analytics`,`/students`) ✓ · Attendance ✓ · Notices ✓ · Events ✓ · Fees ✓ · Leave ✓ · Requests ✓ · **Timetable ✓ (after BUG-002 fix)** · Library ✓ · Chat (`/chat`,`/conversations`) ✓ · Placement ✓ · Profile (`/auth/me`,`/auth/profile`) ✓ · Settings (`/auth/change-password`) ✓

All endpoints respond < 300 ms. No 5xx, no unhandled exceptions observed.
