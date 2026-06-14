# TIMETABLE ARCHITECTURE REPORT — CampusAssist (Phase 1 foundation)

**Date:** 2026-06-14
**Status:** Foundation IMPLEMENTED. Publish/Archive admin **workflow** intentionally deferred to Phase 2 (High), per instruction.

---

## What Phase 1 changed (foundation only)

### Model — `backend/models/Timetable.js`
Added cohort + lifecycle fields (all back-compatible defaults):
```js
year:    { type: String, default: '' },   // study year, e.g. "II"  (optional)
section: { type: String, default: '' },   // section, e.g. "A"; '' = applies to all sections
status:  { type: String, enum: ['draft','published','archived'], default: 'published' },
// + non-unique index { department, year, semester, section, status }
```
- Existing rows keep working: missing `year`/`section` default to `''`, `status` defaults to `published`.
- The index is **non-unique** for now so deploy can't fail on any pre-existing duplicate cohorts. (Uniqueness enforcement = Phase 2.)

### Student profile — `backend/models/User.js`
Added `year` and `section` (default `''`) so a student can be matched to the right segmented timetable. Accepted at:
- **Registration** (`routes/auth.js` register + `Register.jsx` optional Year/Section fields),
- **Profile / admin edit** (`auth.js` PUT /profile — only when sent, never wiped; `students.js` PUT allowlist).

### Lookup — `backend/routes/timetable.js` (`resolveTimetableForUser`)
Replaced the old `findOne({dept,sem}) || findOne()` (which leaked another cohort's timetable) with a **scoped, specificity-ranked resolver**:

```
candidates = Timetable.find({ department, semester, status != 'archived' })
  // HARD rule: never look outside the student's department+semester
score(t): +2 if year matches, +1 if section matches  (blank field = neutral, never negative)
return highest-scoring candidate  (tie → most recently updated)
return null  → 404 "No timetable has been published for your class yet."
```

Specificity order: **exact year+section → section-only → year-only → dept+sem ("all sections")**.

### Admin UI — `frontend/src/pages/admin/TimetableTab.jsx`
- Added **Year** and **Section** inputs (section blank = "all sections").
- Save body now sends `year` + `section`.
- "Edit existing" dropdown labels show year/section when set.

---

## Architecture (current state)

```
Cohort key:  department × year × semester × section   (year/section optional)
Lifecycle:   draft → published → archived             (field exists; only 'published'/'!archived' affects student view today)

Admin create/edit (TimetableTab) ──► Timetable doc (status defaults published)
                                          │
Student GET /api/timetable ──► resolveTimetableForUser(req.user)
   matches WITHIN dept+semester only, narrowed by year/section
   never falls back to another dept/semester
        │
        ├─ match  → published grid
        └─ none   → 404 empty state ("not published for your class yet")
```

---

## Verification (live API)
- ✅ New student in `CIVIL / 3rd / II / B` (no timetable) → **404**, *not* another cohort's grid (the old leak is gone).
- ✅ `year`/`section` persist on the user at registration.
- ✅ Existing-student lookup runs scoped (returned 404 when no IT/5th timetable exists — correctly, no leak).
- ✅ Admin can create/edit with year+section; build passes.

---

## Deferred to Phase 2 (High) — NOT done here
- Publish / Archive **admin actions** + buttons (the `status` field is in place as the foundation; UI controls are Phase 2).
- DELETE endpoint.
- **Unique** cohort index + duplicate-cohort rejection + faculty/room conflict detection.
- Making `year`/`section` required / structured dropdowns.

These are intentionally out of Phase 1 scope per the approval. The foundation laid here is sufficient for Phase 2 to build on without further schema migration.

*Phase 1 deliverable — DO NOT COMMIT.*
