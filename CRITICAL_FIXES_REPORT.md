# CampusAssist — Critical Issues (Phase 1) Implementation Report

**Date:** June 2026
**Scope:** The 5 Critical issues from `ENTERPRISE_GAP_ANALYSIS.md`, in the approved order.
**Approved decisions:** React-only frontend · Fees = reject overpayment + admin verification ·
full Marks system (admin enters, students view, Anna University 10-point) · full Academic
Calendar (admin CRUD, students read-only).
**Rules honoured:** existing functionality preserved · existing APIs preserved where possible ·
existing UI design preserved · no hardcoded data · everything MongoDB-driven ·
student/admin workflows synchronized. **No commits or pushes** — changes left in the working tree.

---

## Verification Summary (this session)

| Check | Result |
|---|---|
| Backend modules load (`node -e require(...)`) | ✅ all 8 new/changed models+routes load |
| Frontend production build (`npm run build`) | ✅ `✓ built` clean, Admin chunk 63.8 kB |
| IDE diagnostics (changed files) | ✅ 0 errors / 0 warnings |
| Grade computation (7 boundary cases) | ✅ 7/7 |
| Integration tests (`node --test`) | ✅ 5/5 pass |

**Run the tests yourself:** `cd backend && npm test`

---

## Files Changed

**Backend — modified:** `models/Attendance.js`, `models/Fee.js`, `routes/attendance.js`,
`routes/fees.js`, `server.js`, `package.json`
**Backend — new:** `models/Marks.js`, `models/CalendarEvent.js`, `routes/marks.js`,
`routes/calendar.js`, `migrations/0001-dedupe-attendance.js`,
`migrations/0002-backfill-fee-verification.js`, `tests/critical.test.js`
**Frontend — modified:** `pages/Admin.jsx`, `pages/Cgpa.jsx`, `pages/Fees.jsx`,
`pages/Timetable.jsx`, `pages/Exam.jsx`, `pages/Dashboard.jsx`, `routes/AppRoutes.jsx`
**Frontend — new:** `pages/Calendar.jsx`, `pages/admin/AccountTab.jsx`,
`pages/admin/FeesTab.jsx`, `pages/admin/MarksTab.jsx`, `pages/admin/CalendarTab.jsx`

---

## CRIT-04 — Duplicate Attendance Prevention

**Why it existed:** `Attendance` indexes were non-unique and the POST/bulk routes called
`Attendance.create()` with no duplicate guard, so the same student+subject+day could be inserted
repeatedly, corrupting attendance percentages.

**Solution:** normalize `date` to UTC-midnight (so a time component can't disguise a same-day
duplicate), add a **unique compound index** `{ student, subject, date }`, and make marking
**idempotent** (upsert → re-marking updates the record; raw duplicates raise 409).

**Before (route):**
```js
const record = await Attendance.create({ student: student._id, studentId, subject,
  date: new Date(date), status: status || 'Present', markedBy: req.user.name });
res.status(201).json({ success: true, message: 'Attendance marked', record });
```
**After (route):**
```js
const day = Attendance.startOfDayUTC(date);
const result = await Attendance.findOneAndUpdate(
  { student: student._id, subject, date: day },
  { $set: { status: status || 'Present', markedBy: req.user.name },
    $setOnInsert: { studentId: studentId.toUpperCase() } },
  { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true, rawResult: true });
const created = !result.lastErrorObject?.updatedExisting;
res.status(created ? 201 : 200).json({ success: true,
  message: created ? 'Attendance marked' : 'Attendance updated for this day', record: result.value });
// + catch err.code === 11000 → 409
```
**Model:** added `set: startOfDayUTC` on `date`, `index({ student, subject, date }, { unique: true })`,
and a `startOfDayUTC` static. Bulk route now upserts and returns `{created, updated, skipped}` counts
(the frontend only reads `message`, so this is backward-compatible).

**Side effects:** the unique index cannot build while duplicates exist → **migration required**.
**Migration:** `backend/migrations/0001-dedupe-attendance.js` (or `npm run migrate:attendance`) —
normalizes dates, collapses existing duplicates (keeps newest), then builds the index. Run once
against the target DB after a snapshot.

**Verification steps:**
1. As admin, mark a student Present for `DBMS` on a date → 201.
2. Mark the **same** student/subject/date Absent → 200 "updated", history shows one record now Absent.
3. `GET /api/attendance/summary?studentId=…` → percentage reflects one record, not two.

**Test cases (automated, passing):**
- unique index blocks a raw duplicate on the same day at a different time (expects E11000);
- idempotent upsert leaves exactly 1 record, last write wins.

---

## CRIT-03 — Admin Profile & Password Management

**Why it existed:** the React admin panel never exposed a profile/password screen, so an admin
could only change their password via direct DB edits. (The backend endpoints already existed.)

**Solution:** new **AccountTab** in the admin panel reusing the existing, role-agnostic endpoints —
**no backend change**: `GET /api/auth/me`, `PUT /api/auth/profile`, `PUT /api/auth/change-password`.
After a profile save the cached session is refreshed so the name updates across the panel.

**Affected files:** `pages/admin/AccountTab.jsx` (new), `pages/Admin.jsx` (nav entry + render).

**Side effects:** none — additive tab, no API/contract change.

**Verification steps:** log in as admin → **My Account** → change password → log out → log in with
the new password (succeeds); edit name → it updates in the sidebar/topbar.

**Test cases (manual):** wrong current password → error toast; new ≠ confirm → blocked client-side;
empty name → blocked.

---

## CRIT-05 — Fee Payment Integrity

**Why it existed:** any authenticated student could self-record a payment (any mode, fabricated txn)
with **no balance cap and no verification**, making financial records untrustworthy.

**Solution (approved): reject overpayment + admin verification.**
- Server rejects `amount > balance` (and blocks recording once fully paid).
- Each payment carries `verified` (default `false`) and `recordedBy`; student-recorded payments are
  **Pending** until an admin confirms them via the new endpoint.
- "Paid" status now counts **only verified** payments (`verifiedPaid` virtual), so the cleared state
  is trustworthy. Balance still uses all recorded payments to cap further recording.

**Before (route):** pushed the payment with no balance check, returned "Payment recorded successfully."
**After (route):**
```js
const balance = fee.total - amountPaid;
if (balance <= 0) return res.status(400).json({ success:false, message:'…fully recorded…' });
if (parsedAmount > balance) return res.status(400).json({ success:false,
  message:`Amount exceeds the balance due of ₹${balance.toLocaleString('en-IN')}.` });
// payment: { …, verified:false, recordedBy: req.user.name }
res.status(201).json({ success:true, message:'Payment recorded. It is pending verification by the admin office.', payment });
```
**New admin endpoint:** `PUT /api/fees/:feeId/payments/:index/verify` (adminOnly) → sets `verified:true`.
**Model:** `verified`/`recordedBy` added to the payment subschema; `verifiedPaid` virtual; `status`
now derives from `verifiedPaid`.

**Frontend:**
- `pages/Fees.jsx`: payment history gains a **Verified / Pending** badge; the **simulated** "Pay Fees
  Online" button is replaced with a real **Record Payment** form (`POST /api/fees/payment`); the
  **hardcoded** "25 May 2026 / ₹500" deadline is replaced with the record's real `dueDate`/`lateFine`.
- `pages/admin/FeesTab.jsx` (new): lists all fee records with **Verify** buttons for pending payments.

**Side effects:** old payments lack the new fields → **migration grandfathers them as verified**.
**Migration:** `backend/migrations/0002-backfill-fee-verification.js` (or `npm run migrate:fees`).

**Verification steps:**
1. As student, record a payment ≤ balance → "pending verification"; row shows ⏳ Pending; status stays Pending.
2. Try to record more than the balance → 400 "exceeds the balance due of ₹…".
3. As admin, **Fee Verification** tab → Verify the payment → student's row shows ✅ Verified; status flips to Paid when verified total ≥ total.

**Test case (automated, passing):** a fee with ₹60 verified + ₹40 unverified reports
`amountPaid=100, verifiedPaid=60, balance=0, status='Pending'`.

---

## CRIT-01 — Real Marks & CGPA System

**Why it existed:** there was **no academic-records model** — `Cgpa.jsx` was a client-side calculator
storing self-entered grades in `localStorage` (fake data, lost on refresh).

**Solution (approved): full Marks system.** Admin enters marks; students view only; CGPA computed
server-side on the **Anna University 10-point scale**.
- **`models/Marks.js`** — `{ student, studentId, semester, subject, subjectCode, credits,
  internalMarks(/40), externalMarks(/60), total, grade, gradePoint, enteredBy }`, unique index
  `{ student, semester, subject }`, and a `computeGrade(internal, external)` static.
  *Grade bands:* O≥91=10, A+≥81=9, A≥71=8, B+≥61=7, B≥50=6, RA<50=0. *Pass = 50.*
- **`routes/marks.js`** — admin `POST` (upsert)/`DELETE`; student `GET /api/marks` (own; admin may
  pass `?studentId=`); `GET /api/marks/cgpa` returns credit-weighted SGPA per semester + overall CGPA.
- Registered in `server.js` (`/api/marks`).
- **`pages/Cgpa.jsx`** rewritten to a **read-only** real-marks view (CGPA, per-semester SGPA, subject
  marks) fed by `/api/marks/cgpa`. Grade-reference and CGPA-scale info cards retained.
- **`pages/admin/MarksTab.jsx`** (new) — look up a student, enter/update/delete subject marks.
- Dashboard quick-access tile relabelled "CGPA Calculator" → **"Marks & CGPA"**.

**Assumption (stated):** internal is out of 40 and external out of 60 (Anna University theory split);
total out of 100. Documented in the model.

**Side effects:** new collection (no migration needed). The manual self-entry calculator is
intentionally **replaced** by real data per CRIT-01 (placeholder academic data removed).

**Verification steps:**
1. As admin → **Marks** → look up a student → add a subject (sem 5, 4 credits, 35/55) → grade shows.
2. As that student → **Marks & CGPA** → the subject and a real CGPA appear; refresh persists (DB-backed).
3. Re-enter the same subject with new marks → updates (no duplicate); delete → removed.

**Test cases (automated, passing):** marks unique per student+semester+subject (E11000 on dup);
CGPA is credit-weighted — `(4×10 + 2×6)/6 = 8.67`.

---

## CRIT-02 — Academic Calendar

**Why it existed:** no calendar/holiday model, route, or page existed at all.

**Solution (approved): full module.** Admin CRUD; students read-only.
- **`models/CalendarEvent.js`** — `{ title, type(Holiday|Exam|Deadline|Semester|Event), date,
  endDate?, description, isActive }`.
- **`routes/calendar.js`** — `GET /api/calendar` (students + admin), admin `POST`/`PUT`/`DELETE`.
  Registered in `server.js` (`/api/calendar`).
- **`pages/Calendar.jsx`** (new, student) — read-only Upcoming/Past lists with type badges; routed at
  `/calendar` (added to `AppRoutes.jsx`) and surfaced via a new dashboard quick-access tile.
- **`pages/admin/CalendarTab.jsx`** (new) — create/edit/delete entries (holidays, exam schedules,
  semester dates, deadlines, events).

**Side effects:** new collection (no migration needed); no impact on existing flows.

**Verification steps:**
1. As admin → **Calendar** → add a Holiday on a future date → appears in the list.
2. As a student → **Academic Calendar** → the holiday shows under Upcoming with a Holiday badge.
3. Edit/delete as admin → student view reflects the change on reload.

**Test cases (manual):** invalid `type` → 400; missing title/date → 400; student `POST` → 403.

---

## Bonus: hardcoded / simulated academic data removed (your additional requirement)

While implementing the above I audited for fake/demo data and replaced it with MongoDB-backed data:

| Item | File | Before | After |
|---|---|---|---|
| Weekly timetable grid | `Timetable.jsx` | **Entire grid hardcoded** (`WEEK_GRID`) | Rendered from `/api/timetable` `schedule`/`slots` |
| Timetable subtitle | `Timetable.jsx` | "Semester V · IT Department" hardcoded | From the timetable record (year/semester/department) |
| Fee deadline | `Fees.jsx` | "25 May 2026 / ₹500" hardcoded | From `fee.dueDate` / `fee.lateFine` |
| Simulated pay button | `Fees.jsx` | toast "…when backend is connected" | Real Record-Payment form |
| Exam reminder date | `Exam.jsx` | fallback "June 15, 2026" | Banner only shows with real `exam.theoryStart` |
| Hall-ticket toast | `Exam.jsx` | "available from June 10" | Neutral, no fabricated date |
| Marksheet status / Upcoming events (prior) | `Dashboard.jsx` | hardcoded | already made dynamic earlier (`6f0c354`) |

**Known remaining placeholders (LOW, out of Critical scope):** "Download Receipt" (Fees) and
"Download Hall Ticket" (Exam) are genuine *missing features* (PDF export), not fake data being shown
as real. The chatbot keyword fallback facts are intentional and provider-by-design.

---

## Migration & Run Instructions

```bash
# 1) Back up / snapshot the database first.
cd backend
npm install            # ensure devDeps for tests (mongodb-memory-server)

# 2) Run migrations once against the target DB (MONGO_URI in backend/.env):
npm run migrate:attendance   # CRIT-04: dedupe + unique index
npm run migrate:fees         # CRIT-05: grandfather existing payments as verified

# 3) Verify:
npm test                     # 5/5 integration tests
```
New collections (`marks`, `calendarevents`) need no migration — they're created on first write.

---

## Status

**All 5 Critical issues are implemented and verified** (build + diagnostics + automated tests green).
Per the agreed plan, **High-priority issues have not been started** and await your go-ahead.
Nothing has been committed or pushed.
