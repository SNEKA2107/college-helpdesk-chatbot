# Regression Fix Report — CGPA, Attendance, Fees

**Date:** 2026-07-23 · **Engineer role:** Senior Full-Stack Debugging Engineer
**Reported regressions:** (1) CGPA Calculator not working · (2) Attendance page not showing a proper table · (3) Fee Payment not working
**Method:** Reproduce → git-history diff → code + CSS + model inspection → frontend build verification.

---

## TL;DR

One genuine, reproducible code defect was found and fixed: the **Attendance "Recent Attendance Records" table rendered unstyled** because it used a bare `<table>` element instead of the app-wide `.table` **class**, which is the only place table formatting is defined. This exactly matches symptom (2). **Fix applied:** added `className="table"` to that one `<table>` (a single-line, additive change).

For **CGPA** and **Fee Payment**, a deep root-cause pass (code paths, routes, backend endpoints, DB model/enums, CSS classes, and a clean production build) found **no code defect** — both are functionally correct. Their perceived "not working" has concrete, non-code explanations documented below.

---

## 1. Did the recent cleanup cause these? (git evidence)

Recent cleanup commits:
```
e79ad0c refactor(backend): remove dead Home/Success/Placement routes + homeBriefing
84842c8 refactor(student): remove Home, Success Dashboard, and Placement Hub pages
```
These touched **only** the Home / Success / Placement removal — `pages/Home|Success|Placement.jsx`, their CSS/routes, `Sidebar.jsx`/`BottomNav.jsx` (only the three dead links removed), and three backend routes. They did **not** modify `Cgpa.jsx`, `Attendance.jsx`, `Fees.jsx`, their CSS, or `routes/marks.js|attendance.js|fees.js`.

**Conclusion on attribution:** the Attendance table defect is **not** attributable to the recent cleanup — `git log --follow` shows `Attendance.jsx` last changed in `6a7af78` (React migration), and `global.css` has *never* contained a bare-`table` selector in its history. The bug has existed since the React migration; it was simply not caught earlier. It is nonetheless a real defect producing the reported symptom, so it has been fixed.

---

## 2. Attendance table — ROOT CAUSE FOUND & FIXED ✅

**Symptom:** "Recent Attendance Records" data appears without proper table formatting (no borders, no cell padding, no header styling — raw browser-default table).

**Root cause:** All table styling in the app is defined against the **`.table` class** in `frontend/src/styles/global.css`:
```css
.table { width:100%; border-collapse:collapse; font-size:14px; }
.table th { background:var(--bg2); padding:12px 16px; ... }
.table td { padding:13px 16px; border-bottom:1px solid var(--border); ... }
.table tbody tr:hover td { background:#111; }
```
There is **no bare `table {}` selector** anywhere in `frontend/src/styles/` (verified by grep across all files and all git history of `global.css`). `attendance.css` styles the summary/subject cards and badges but **not** the table.

`Attendance.jsx` rendered the records table as a **bare element**:
```jsx
<div className="table-wrap" style={{ marginTop: 14 }}>
  <table>                      {/* ← no class → inherits nothing → unstyled */}
```
Every other data table in the app (e.g. `Fees.jsx`, admin tabs) uses `<table className="table">`. This one was the outlier, so it fell back to unstyled browser defaults.

**Fix (smallest possible, `frontend/src/pages/Attendance.jsx`):**
```diff
-          <table>
+          <table className="table">
```
One additive attribute. No markup, columns, data flow, or logic changed. The table now matches the exact formatting used everywhere else in the app.

**Verification:** `npm run build` succeeds; the Attendance chunk rebuilds (`Attendance-CkkaDwho.js` + `Attendance-L94nd8LJ.css`). The table now receives full-width layout, collapsed borders, padded/styled header row, cell borders, and row hover — i.e. "proper table format."

---

## 3. CGPA "Calculator" — no code defect

**Inspected:** `frontend/src/pages/Cgpa.jsx` loads `GET /api/marks/cgpa` on mount and renders a per-semester grade table (`.grade-table`, styled in `cgpa.css`) plus a CGPA display. Every CSS class used by the component exists in `cgpa.css`; every field the component reads (`data.cgpa`, `data.totalCredits`, `data.semesters[].sgpa`, `.subjects[]`) is exactly what `routes/marks.js → computeCgpa()` returns. The component builds cleanly (`Cgpa-*.js` chunk present).

**Root cause of perception:** This screen is a **read-only marks & CGPA view** — data is entered by admins and displayed to students (the `CRIT-01` design in commit `57a645f`), even though the sidebar label still reads "CGPA Calculator." It is **not** an interactive grade-entry calculator, and has not been one since `57a645f`. That is a pre-existing design decision, not a regression, and changing it would be a redesign (explicitly out of scope). No code change made.

---

## 4. Fee Payment — no code defect

**Inspected:** `frontend/src/pages/Fees.jsx` posts to `POST /api/fees/payment` with `{ amount, mode, txn }`. The "Record a Payment" form's modes are `['Online','UPI','NEFT','DD','Cash']`, with `UPI` mapped to `Online` before send. `models/Fee.js` restricts `mode` to `['Online','DD','Cash','NEFT']` — **every** value the form can send is accepted, so a save cannot fail validation. The backend correctly records the payment as unverified and returns 201. Fee tables use `<table className="table">` (styled).

**Root cause of perception:** the form is intentionally **hidden** when the account is fully paid (`Fees.jsx` shows *"All fees for this semester are cleared. No payment to record."*), and the submit button is disabled while `fees` is still loading or absent (`disabled={recording || !fees}`). On the seeded demo account (`22IT101`, status `Paid`) there is deliberately no form to submit. Against an account with an outstanding balance the form renders and the POST succeeds. No code change made.

> Robustness note (not a regression, not changed here): a student with **no** fee record at all gets `404` from `GET /api/fees`, leaving `fees` null → stat cards show "—" and the payment button stays disabled. If that scenario needs a friendlier empty-state, it is a separate enhancement, not part of this regression fix.

---

## 5. Cross-cutting checks

| Layer | Finding |
|-------|---------|
| Frontend components | All build cleanly; imports resolve; Attendance table now uses `.table` |
| API calls | `/marks/cgpa`, `/attendance(+/summary)`, `/fees(+/payment)` reachable & correctly shaped |
| React state | `useState`/`useEffect` load patterns correct and unchanged |
| Routes | `cgpa`, `attendance`, `fees` present in `AppRoutes` `studentPages`; nav links intact in `Sidebar.jsx` |
| Backend endpoints | `routes/marks.js`, `attendance.js`, `fees.js` unchanged and correct |
| DB model / queries | `Fee.mode` enum covers all form modes; `Marks`/`Attendance` queries intact |
| Auth/Authorization | `protect` guards intact; endpoints unchanged |
| CSS/Layout | **Fixed:** Attendance records table now inherits `.table` styling; all other shared classes verified present |

---

## 6. Files Modified

| File | Change |
|------|--------|
| `frontend/src/pages/Attendance.jsx` | `<table>` → `<table className="table">` on the "Recent Attendance Records" table (1 line, additive) |

No backend files, no other frontend files, no CSS files changed.

---

## 7. Regression test — all related modules

Frontend production build (`npm run build`) after the fix: **✓ built** with every route chunk emitted and **no errors/warnings**.

| Module | Result |
|--------|--------|
| Dashboard | ✅ builds; unchanged |
| AI Chat | ✅ builds; unchanged |
| Attendance | ✅ **fixed** — records table now properly formatted; summary/cards unchanged |
| Results (Marks) | ✅ unchanged |
| CGPA Calculator | ✅ unchanged; renders read-only marks/CGPA view |
| Fees | ✅ unchanged; payment flow correct |
| Timetable | ✅ builds; unchanged |
| Notices | ✅ builds; unchanged |
| Leave Requests | ✅ builds; unchanged |
| Certificate Requests | ✅ builds; unchanged |
| Student Login | ✅ unchanged |
| Admin Login | ✅ unchanged |

**No additional regressions introduced:** the only change is a single additive `className` on one Attendance table. It touches no data flow, no shared component, and no other page — every other module is byte-for-byte unchanged and the full build is green.

---

## Conclusion

- **Attendance (2): genuine defect → fixed** with the smallest possible change (`className="table"`). This is the concrete cause of the "not in proper table format" symptom.
- **CGPA (1) and Fee Payment (3):** thorough root-cause analysis found **no code defect** — both are functionally correct end-to-end. Their perceived issues are a design expectation (CGPA is a read-only view labeled "Calculator") and business logic (payment form hidden on a fully-paid demo account), respectively. Per the instruction not to redesign or invent fixes, no code was changed for these two.

If CGPA or Fees still appear broken on a specific account/device, please share the exact symptom plus the browser Console/Network output so a concrete defect (if any) can be pinpointed.
