# TIMETABLE DATA FLOW REPORT — CampusAssist

**Audit date:** 2026-06-14
**Scope:** `backend/models/Timetable.js`, `backend/routes/timetable.js`, `frontend/src/pages/Timetable.jsx`, `frontend/src/pages/admin/TimetableTab.jsx`, seed.
**Status:** AUDIT ONLY — no code changed.

---

## 1. Current data model

`backend/models/Timetable.js`
```js
{
  department:   String (required),
  semester:     String (required),
  academicYear: String (required),
  slots:        [String],
  schedule:     Mixed,        // { Monday:[...7], Tuesday:[...], ... }
  subjectDetails: Mixed,      // { Java:{name,code,faculty,room}, ... }
}  // timestamps
```

**Segmentation dimensions present:** `department`, `semester`, `academicYear`.
**Segmentation dimensions MISSING (required by the brief):** `year` (study year, e.g. II year), `section` (A/B/C), and a lifecycle `status` (draft / published / archived).

There is **no uniqueness constraint** — nothing stops two timetables for the same `{department, semester, academicYear}`.

---

## 2. Current request flow

### Student read — `GET /api/timetable` (`timetable.js:8-19`)
```js
const { department, semester } = req.user;
const timetable = await Timetable.findOne({ department, semester })
  || await Timetable.findOne().sort({ createdAt: -1 });   // ⚠️ fallback
```

```
Student logs in
   │  req.user.department, req.user.semester
   ▼
findOne({ department, semester })
   │
   ├─ match found ──────────────► return it
   │
   └─ NO match ─► findOne().sort({createdAt:-1})  ──► returns SOME OTHER
                                                       cohort's timetable
```

### `GET /api/timetable/today` (`:22-44`) — same fallback logic.

### Admin — `timetable.js`
| Method | Route | Guard | Purpose |
|--------|-------|-------|---------|
| GET | `/api/timetable/all` | adminOnly | list all timetables |
| POST | `/api/timetable` | adminOnly | create |
| PUT | `/api/timetable/:id` | adminOnly | update |
| — | (no DELETE) | — | **missing** |
| — | (no publish/archive) | — | **missing** |

### Admin UI — `TimetableTab.jsx`
- Inputs: Edit-existing dropdown, Department, Semester, Academic Year, comma-separated slots, then a per-day grid.
- **No `year` input, no `section` input.** (The `year` state variable at `:14` is bound to **Academic Year**, not study-year — mislabeled relative to the segmentation requirement.)
- Saving immediately makes it live to students — no draft/publish gate.
- Uses `DEPARTMENTS` / `SEMESTERS` from `admin/shared.js`.

---

## 3. Findings

### TT-1 — 🔴 Cross-cohort timetable leakage (HIGH/CRITICAL)
The `|| Timetable.findOne().sort({createdAt:-1})` fallback means **any student whose department+semester has no timetable is served a different cohort's timetable.** A brand-new student in, say, `ECE / 3rd` with no ECE timetable will see the seeded `IT / 5th` schedule as if it were theirs. This is the timetable half of "new user sees old data," and it is a data-isolation defect, not just a UX one.
**Fix target:** Remove the fallback. Return a clean "No timetable published for your class yet" empty state (the frontend already handles `timetable === false` at `Timetable.jsx:68`).

### TT-2 — 🟠 No year / section segmentation (HIGH)
The model cannot represent II-year-Section-B vs III-year-Section-A. All students in a department+semester collapse to one timetable. The brief explicitly requires department × year × semester × section.
**Fix target:** Add `year` and `section` to the model; include them in the student lookup (derived from the user profile — which means `User` needs `year`/`section` too, see TT-5) and in the admin form + uniqueness key.

### TT-3 — 🟠 No publish / archive lifecycle (HIGH)
Every save is immediately visible to students; there is no draft state and no way to archive a superseded timetable. Old academic-year timetables linger and can be returned by the fallback.
**Fix target:** Add `status: 'draft' | 'published' | 'archived'` (default draft). Student read filters `status:'published'`. Admin gets publish/archive actions. Add `DELETE` (or rely on archive).

### TT-4 — 🟡 No uniqueness / conflict guard (MEDIUM)
Nothing prevents duplicate timetables for the same cohort, so `findOne` is order-dependent. No detection of a faculty/room double-booked across slots.
**Fix target:** Unique compound index on the cohort key (`department, year, semester, section, academicYear`); optional slot-conflict validation.

### TT-5 — 🟡 Student profile lacks year/section (MEDIUM, dependency)
`User` has `department` and `semester` but no `year` or `section`, so even after TT-2 the server cannot pick the right section for a student. Registration/admin student edit would need these fields.
**Fix target:** Add `year`, `section` to `User`; collect at registration and/or admin student edit.

### TT-6 — 🟢 Grid rendering is genuinely DB-driven
`Timetable.jsx` reads `slots`, `schedule`, `subjectDetails` from the API and renders today's row dynamically. No hardcoded grid (the old hardcoded grid was already removed — see comment at `:21`). Good.

---

## 4. Target architecture (proposed — for the fix phase, not yet implemented)

**Model additions**
```js
year:    { type: String },            // study year, e.g. "II"
section: { type: String, default: 'A' },
status:  { type: String, enum:['draft','published','archived'], default:'draft' },
publishedAt: Date,
// unique: { department, year, semester, section, academicYear }
```

**Student read**
```js
const { department, year, semester, section } = req.user;
const tt = await Timetable.findOne({
  department, year, semester, section, status: 'published'
});
// NO fallback to another cohort — return empty state if none.
```

**Admin capability**
| Action | Endpoint |
|--------|----------|
| Create (draft) | POST `/api/timetable` |
| Edit | PUT `/api/timetable/:id` |
| Publish | PUT `/api/timetable/:id/publish` (or `status` in PUT) |
| Archive | PUT `/api/timetable/:id/archive` |
| Delete | DELETE `/api/timetable/:id` |

**Admin UI:** add Year + Section selectors; show a Draft/Published/Archived badge; Publish & Archive buttons; warn on duplicate cohort.

**Data flow (target)**
```
Admin: create draft → fill grid → Publish
   ▼ (status: published, cohort = dept×year×sem×section)
Student (matching cohort) GET /api/timetable → sees published grid
Student (no match) → "No timetable published for your class yet"
```

---

## 5. Verification checklist (for the fix phase)
- [ ] New student in a cohort with no timetable sees an empty state, **never** another cohort's grid.
- [ ] Two sections of the same dept+sem can hold different timetables simultaneously.
- [ ] Draft timetables are invisible to students until published.
- [ ] Archived timetables are never returned to students.
- [ ] Duplicate cohort creation is rejected.
- [ ] Admin can create / edit / publish / archive / delete.

*AUDIT ONLY — DO NOT COMMIT.*
