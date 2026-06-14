# EXAM COHORT ARCHITECTURE — Phase 2 (H3)

**Date:** 2026-06-14 · **Status:** Implemented & verified.

## Model (`backend/models/Exam.js`)
Added cohort + lifecycle fields (all back-compatible defaults):
```js
department: { type:String, default:'' },   // '' = institution-wide (all departments)
year:       { type:String, default:'' },
section:    { type:String, default:'' },
status:     { enum:['draft','published','archived'], default:'published' },
publishedAt: Date,
// existing: semester (required), academicYear (required), schedule[], practicals[], instructions[]
```

## Student resolution (`resolveExamForUser`)
Published exams only. Candidates = published exams that are institution-wide (`department:''`) **or** match the student's department; scoped to matching semester. Ranked by specificity:
`department (+4) · semester (+2) · year (+2) · section (+1)`. Highest score wins.
- A blank-department exam acts as an **institution-wide** schedule visible to everyone — this preserves the pre-existing single exam's behavior.
- A student with no matching/published exam gets a clean 404.

## Admin capabilities
| Action | Endpoint |
|--------|----------|
| Create (draft) | `POST /api/exam` → forced `status:'draft'` |
| Edit | `PUT /api/exam/:id` (status untouched) |
| Publish | `PUT /api/exam/:id/publish` |
| Archive | `PUT /api/exam/:id/archive` |
| List all (history) | `GET /api/exam/all` |

Student `GET /api/exam` returns the cohort-resolved published exam; admin `GET /api/exam` returns the latest (back-compat). `GET /exam/schedule` and `/practicals` are cohort-aware for students.

## Admin UI (`ExamsTab.jsx`, reworked)
- "Edit existing" dropdown lists every exam as `[status] Dept · sem · yr · Sec · AY`.
- Cohort fields added: **Department** (or "All departments"), **Year**, **Section** (alongside Semester / Academic Year / dates).
- Status badge + **Publish** / **Archive** buttons.
- Save creates a **draft**; the schedule/practicals/instructions editors are unchanged.
- `Admin.jsx` now loads the list via `GET /api/exam/all` into `data.exams`.

## Backward compatibility
The pre-existing single exam (department `''`, status defaults `published`) remains visible to **all** students as institution-wide. No migration needed.

## Verification (live API)
- ✅ New exam = draft; CSE student does not see it.
- ✅ After publish, CSE-cohort student sees their exam (`academicYear` matched).
- ✅ `GET /exam/all` lists it for admin.
- ✅ Create/publish actions are audit-logged (`exam.create`, `exam.publish`).

*Verification only — DO NOT COMMIT.*
