# EXAM COHORT VERIFICATION — Phase 2

**Date:** 2026-06-15 · **Scope:** Department-specific exam visibility

## Problem
The only seeded exam had a blank `department` (institution-wide), and `resolveExamForUser()` treats blank-department exams as applying to everyone. Result: a Civil/ECE student saw the **CS/Java** schedule.

## Fix
The cohort engine in `backend/routes/exam.js` (`resolveExamForUser`) was already correct — it scopes by `department` + `semester` and ranks by specificity. The gap was **seed data**. `backend/seed.js` now seeds **one published exam per department** (no blank-department exam → no leakage):

| Department | Subjects (sample) | Semester |
|------------|-------------------|----------|
| IT | Java, DBMS, Computer Networks, OS, ToC, Maths-III, Elective | 5th |
| CSE | Java, DBMS, Computer Networks, OS, ToC, Maths-III, Elective | 5th |
| ECE | DSP, Analog Comm., Microprocessors, EM Fields, Control Systems, Maths-III, Elective | 5th |
| CIVIL | Structural Analysis, Surveying-II, Concrete Tech, Fluid Mechanics, Geotech, Maths-III, Elective | 5th |

All exams are `status: 'published'` with relative dates (theory +14d, hall ticket +9d).

For the live DB, `scripts/refresh-demo-data.js` tags the blank-department exam to `IT` and clones missing CSE/ECE/CIVIL cohorts.

## Verification (resolution simulation, mirrors routes/exam.js)
```
IT     sem 5th → exam:IT
CSE    sem 5th → exam:CSE
ECE    sem 5th → exam:ECE
CIVIL  sem 5th → exam:CIVIL
AIML   sem 5th → NO EXAM (honest empty)
```

| Check | Result |
|-------|--------|
| CSE students see only CSE exams | ✅ |
| ECE students see only ECE exams | ✅ |
| Civil students see only Civil exams | ✅ |
| No cross-department leakage (no blank-department exam) | ✅ |
| Department with no published exam → honest "not published yet" | ✅ (AIML) |
| Admin still sees latest exam for management | ✅ (unchanged `/exam` admin branch) |

## Files changed
- `backend/seed.js` (4 cohort exams) · `backend/scripts/refresh-demo-data.js` (live re-cohorting)
- **No change** to `routes/exam.js` or `models/Exam.js` — engine already supported cohorts.

## Collections involved
`exams` (data only).
