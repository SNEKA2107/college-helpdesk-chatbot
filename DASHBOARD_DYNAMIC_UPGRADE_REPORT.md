# CampusAssist — Dashboard Dynamic Upgrade Report

**Task:** Make the two hardcoded student-dashboard panels data-driven (per `DASHBOARD_DATA_SOURCE_AUDIT.md`).
**Date:** 2026-06-13
**Scope rule honoured:** frontend-only; no auth, JWT, registration, admin, schema, or API changes.

---

## Summary

The two remaining static panels on the student dashboard — **Upcoming Events** and
**Marksheet Status** — now read **live data from MongoDB** through endpoints that already
existed. The UI, layout, colours, and styling are unchanged. No backend code, model, or API
was modified.

---

## Files Changed

| File | Change | Lines |
|---|---|---|
| `frontend/src/pages/Dashboard.jsx` | Replaced hardcoded Upcoming Events + Marksheet Status with live data; added `events`/`requests` state, fetches, derived values, and helper constants/function | 1 file, 248 lines total |

**No other files were touched.** Confirmed unchanged: all backend routes, all models, the
schema, `services/api.js`, `services/auth.js`, admin components, and the auth/registration flow.

### What changed inside `Dashboard.jsx`
1. **New state + fetches** in the existing `useEffect` (alongside the existing stats/notices calls):
   - `apiCall('/events')` → `events`
   - `apiCall('/requests')` → `requests`
2. **Derived values:**
   - `upcomingEvents` — events with `date ≥ start of today`, soonest first, capped at 3.
   - `latestMarksheet` — the student's most recent request where `type === 'Marksheet'`.
3. **Module-level helpers added:** `EVENT_ACCENTS` (the original blue/green/amber row palette),
   `EV_BADGE` (category → existing badge class), `STATUS_ORDER` + `MARKSHEET_STEPS`, and a pure
   `marksheetSteps(status)` function that maps the real status to step states.
4. **Upcoming Events card** — three literal `<div>` rows replaced by `upcomingEvents.map(...)`
   reusing the identical markup (date box, accent palette, title, venue·time, badge) plus
   Loading and "No upcoming events." states.
5. **Marksheet Status card** — four literal `step-row`s replaced by
   `marksheetSteps(latestMarksheet.status).map(...)` reusing the identical
   `step-row`/`step-left`/`step-dot`/`badge` markup, plus Loading and "No marksheet request yet." states.

---

## APIs Used

| Panel | Endpoint | Method | Auth | Notes |
|---|---|---|---|---|
| Upcoming Events | `/api/events` | GET | `protect` (JWT) | Pre-existing; returns `Event.find({ isActive: true }).sort({ date: 1 })`. **Unchanged.** |
| Marksheet Status | `/api/requests` | GET | `protect` (JWT) | Pre-existing; returns the caller's own requests (`student: req.user._id`) sorted newest-first. **Unchanged.** |

Both endpoints were already consumed elsewhere (Events page, Requests page), so this change
reuses proven, authenticated routes. **No endpoint was added or modified.**

---

## MongoDB Collections Used

| Panel | Collection | Model | Fields read |
|---|---|---|---|
| Upcoming Events | `events` | `Event` | `title`, `category`, `date`, `time`, `venue`, `_id` |
| Marksheet Status | `requests` | `Request` | `type`, `status`, `_id` |

**No schema change.** The Marksheet stepper is driven by the existing `Request.status` enum
(`Submitted → Under Review → Processing → Ready for Collection → Completed / Rejected`).

### Status → stepper mapping (uses real enum values)
| Visible step | "Done" when status is past… | "In Progress" when status is… |
|---|---|---|
| Application Received | Submitted | Submitted |
| Under Verification | Under Review | Under Review |
| Processing | Processing | Processing |
| Ready for Collection | (reached) | Ready for Collection |

- `Completed` → all four steps show **Done**.
- `Rejected` → first step **Done**, final step shows a **Rejected** (`badge-danger`) badge.
- No marksheet request → graceful "No marksheet request yet." (card and styling preserved).

---

## Verification Results

| Check | Result | Evidence |
|---|---|---|
| **Production build** | ✅ PASS | `npm run build` → `✓ built in 1.72s`; `Dashboard-*.js` chunk emitted (12.11 kB) |
| **Type/lint diagnostics** | ✅ PASS | IDE diagnostics for `Dashboard.jsx`: **0 errors, 0 warnings** (248 lines) |
| **No hardcoded leftovers** | ✅ PASS | grep for `Tech Symposium`/`Cultural Fest`/`Placement Training`/`Main Auditorium` → none |
| **Dynamic wiring present** | ✅ PASS | `apiCall('/events')`, `apiCall('/requests')`, `upcomingEvents`, `latestMarksheet`, `marksheetSteps` all present |
| **Scope rules respected** | ✅ PASS | `git status` shows only `Dashboard.jsx` modified (plus the generated `dist/` build output); no backend/model/route/auth files changed |
| **Per-user security preserved** | ✅ PASS | `/api/requests` scopes to `req.user._id` server-side; client renders only the caller's data |
| **No existing functionality broken** | ✅ PASS | Stats cards, notices, recent notifications, quick-access tiles, mobile views — all untouched; same build, same component contract |

### Why no runtime screenshot is attached
A meaningful screenshot of these panels requires (a) the live backend running with seeded
`events`/`requests` data and (b) an authenticated student session. The deployed site does not
yet contain these (uncommitted) changes, so a live-site screenshot would show the *old* UI and
be misleading. Verification was therefore done via a clean production build, zero IDE
diagnostics, and static confirmation of the data wiring. The existing audit screenshots
(`react-e2e-dashboard.png`, `device-screenshots/final/01-dashboard.png`) show the unchanged
surrounding layout that this change preserves. To capture a live screenshot, deploy these
changes (or run the backend + frontend locally) and log in as a student.

---

## UI Preservation Statement

- **Upcoming Events:** same card, same header + "View All" link, same date-box layout, same
  three-colour accent palette (blue/green/amber by row), same title and venue·time typography,
  same badge component. Only the *content* is now real (and the right-hand badge shows the
  event's real category instead of decorative text).
- **Marksheet Status:** same card, same `step-row`/`step-dot`/`badge` structure and the same
  four step labels. Only the *state* of each step is now derived from the student's real
  request status.
- No CSS files were modified. No layout, spacing, or colour values were redesigned.

---

## Conclusion

Both flagged panels are now data-driven against existing MongoDB collections via existing,
authenticated endpoints, with the visual design fully preserved and no out-of-scope changes.
The frontend builds cleanly with zero diagnostics. **The student dashboard is now fully
data-driven** — every data element (stats, request counts, notices/announcements, recent
activity, upcoming events, and marksheet status) reads live from MongoDB. The only remaining
static elements are the **Quick Access / Mobile Action tiles**, which are navigation links by
design and were intentionally left static (as recommended in the audit).
