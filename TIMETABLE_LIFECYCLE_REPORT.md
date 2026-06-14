# TIMETABLE LIFECYCLE REPORT — Phase 2 (H1)

**Date:** 2026-06-14 · **Status:** Implemented & verified (5/5 lifecycle checks).

## Lifecycle
`draft → published → archived` (`Timetable.status`, + `publishedAt`).

| State | Created by | Student visibility |
|-------|-----------|--------------------|
| **draft** | `POST /api/timetable` (always starts here) | ❌ never |
| **published** | `PUT /api/timetable/:id/publish` (after conflict check) | ✅ only to the matching cohort |
| **archived** | `PUT /api/timetable/:id/archive` | ❌ never (kept as history) |

## Admin capabilities
| Action | Endpoint |
|--------|----------|
| Draft (create) | `POST /api/timetable` → forced `status:'draft'` |
| Edit content | `PUT /api/timetable/:id` (status untouched here) |
| Publish | `PUT /api/timetable/:id/publish` (runs conflict detection, 409 if any) |
| Archive | `PUT /api/timetable/:id/archive` |
| View history | `GET /api/timetable/all` (all states, newest first) |
| Preview conflicts | `GET /api/timetable/:id/conflicts` |

Admin UI (`TimetableTab.jsx`): each saved timetable shows a status badge; **Publish** / **Archive** buttons appear contextually; the "edit existing" dropdown is prefixed with `[status]`; publish conflicts render as an inline list.

## Student visibility
`resolveTimetableForUser` now filters `status:'published'` (was `$ne:'archived'`), scoped to the student's `department+semester`, ranked by year/section. Drafts and archived are invisible; no cohort with no published timetable ever sees another's.

## Backward compatibility
`status` defaults to `'published'`, so **pre-existing timetables remain visible** with no migration. Only *newly created* timetables start as draft. Content edits via `PUT /:id` no longer change status (lifecycle is explicit).

## Verification (live API)
- ✅ New timetable = draft; student gets 404 (not visible).
- ✅ After publish, matching student sees it.
- ✅ After archive, student gets 404 again.
- ✅ `GET /all` returns full history with status.
- ✅ Non-admin blocked from publish (403).

*Verification only — DO NOT COMMIT.*
