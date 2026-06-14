# TIMETABLE CONFLICT VALIDATION — Phase 2 (H2)

**Date:** 2026-06-14 · **Status:** Implemented & verified (4/4 conflict types blocked).
**Module:** `backend/utils/timetableConflicts.js`, enforced in `PUT /api/timetable/:id/publish`.

## When it runs
Conflict detection runs **before publish**. If any conflict is found, publish is rejected with **HTTP 409** and a `conflicts[]` array; the timetable stays in its current (draft) state. A read-only preview is available via `GET /api/timetable/:id/conflicts`.

## Detected conflict types
| Type | Rule |
|------|------|
| **duplicate-slot** | The same period-slot label appears twice in `slots[]`. |
| **section-clash** | Another **published** timetable already exists for the same cohort (`department + year + semester + section`) — only one published timetable per cohort. |
| **faculty-clash** | The same faculty (resolved via `subjectDetails[cell].faculty`) is scheduled at the same `day + period` in another published timetable. |
| **room-clash** | The same room (`subjectDetails[cell].room`) is in use at the same `day + period` in another published timetable. |

Comparison is only against **published** timetables (drafts/archived don't clash). Empty cells and `-`/`Lunch`/`Break` are ignored. Faculty/room are matched case-insensitively; blank faculty/room are skipped.

## Conflict payload (example)
```json
{ "success": false, "message": "Cannot publish — conflicts detected.",
  "conflicts": [
    { "type": "faculty-clash", "message": "Faculty \"Dr. Anand\" is already scheduled on Monday, period 1 (IT 5 sem Sec A).", "otherId": "…" }
  ] }
```
The admin UI renders these as a red inline list under the timetable controls.

## Verification (live API)
| Scenario | Result |
|----------|--------|
| Second timetable for same cohort → publish | ✅ 409 `section-clash` |
| Same faculty, same day+period, different cohort → publish | ✅ 409 `faculty-clash` |
| Same room, same day+period, different cohort → publish | ✅ 409 `room-clash` |
| Duplicate slot label → publish | ✅ 409 `duplicate-slot` |
| Clean timetable → publish | ✅ 200 published |

## Limitation (documented)
Faculty/room clash detection relies on `subjectDetails[cell]` being populated. Timetables authored only with bare subject text in cells (no `subjectDetails`) can still be checked for duplicate-slot and section-clash, but faculty/room clashes can't be computed without that metadata. Capturing structured `subjectDetails` in the admin grid is a future (Medium) enhancement.

*Verification only — DO NOT COMMIT.*
