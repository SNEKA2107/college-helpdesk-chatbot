# TIMETABLE VALIDATION REPORT — Phase 1

**Date:** 2026-06-14 · **Method:** API-level integration test against the live backend (`resolveTimetableForUser`), then test data removed from the DB.

> Why API-level and not on-APK: the cohort-assignment logic lives in the backend and the React bundle; the APK WebView calls the exact same endpoint. Driving 5 logins + reading 5 timetables through blind emulator taps is unreliable (see PHASE1_RELEASE_READINESS_REPORT). The API test exercises the real resolver deterministically.

---

## Test fixtures (created, verified, then deleted)

**5 published timetables** (the `academicYear` field used as a unique marker):

| Marker | Department | Semester | Year | Section |
|--------|-----------|----------|------|---------|
| TT-CSE-I-A | CSE | 1 | I | A |
| TT-CSE-II-A | CSE | 1 | II | A |
| TT-IT-III-A | IT | 5 | III | A |
| TT-ECE-IV-A | ECE | 7 | IV | A |
| TT-CSE-I-B | CSE | 1 | I | B |

**5 students**, one per cohort (incl. the requested CSE Y1 / CSE Y2 / IT Y3 / ECE Y4, plus a CSE Y1 Section B to test section isolation).

---

## Results — 5/5 PASS

| Student cohort | Expected timetable | Got | ✓ |
|----------------|--------------------|-----|---|
| CSE · Year I · Sec A | TT-CSE-I-A | TT-CSE-I-A | ✅ |
| CSE · Year II · Sec A | TT-CSE-II-A | TT-CSE-II-A | ✅ |
| IT · Year III | TT-IT-III-A | TT-IT-III-A | ✅ |
| ECE · Year IV | TT-ECE-IV-A | TT-ECE-IV-A | ✅ |
| CSE · Year I · Sec B | TT-CSE-I-B | TT-CSE-I-B | ✅ |

### What this proves
- ✅ **Each student receives only their assigned timetable.**
- ✅ **No cross-year visibility:** CSE Year I and CSE Year II share `department+semester` (CSE, sem 1) yet each resolves to its own year's timetable — the resolver correctly disambiguates by `year`.
- ✅ **No cross-section leakage:** CSE Year I Section A vs Section B resolve to their respective section timetables.
- ✅ **No cross-department leakage:** IT and ECE students never see CSE timetables.
- ✅ (From Phase 1) A cohort with **no** timetable returns a clean 404 empty state — never another cohort's grid.

---

## Behavioural note (resolver specificity)
Matching is scoped to `department + semester` first (hard boundary), then ranked: exact `year`+`section` → section-only → year-only → blank ("all sections"). A **blank-section** timetable acts as a dept+sem+year default. For deterministic section isolation, give each section its own explicit timetable (as tested). If both a blank-section and a specific-section timetable exist for the same dept+sem+year and a third section's student logs in, the blank one is served — intended "all sections" fallback. This is acceptable for the Phase-1 foundation; stricter uniqueness is a Phase-2 item.

## Scope boundary
This validates the **foundation** (segmented assignment + isolation). Publish/archive admin workflow, unique-cohort enforcement, and faculty/room conflict detection are **Phase 2 (High)** and intentionally not built yet.

*All test fixtures deleted from the live DB after the run (0 `TT-*` timetables, 0 `TST*` users remain). Verification only — DO NOT COMMIT.*
