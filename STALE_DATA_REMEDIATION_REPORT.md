# STALE DATA REMEDIATION REPORT — Phase 1

**Date:** 2026-06-15 · **Scope:** Demo/seed content freshness (no workflow changes)

## Problem
Seed data used hard-coded 2026 dates (`fee due 2026-05-25`, `exam start 2026-06-15`, notices referencing May 2026). Relative to evaluation day these read as **overdue / already-started / expired**, making the app look neglected to new users.

## Fix
`backend/seed.js` now computes **every demo date relative to the run date** via helpers (`dRel/ymd/human`, `ACADEMIC_YEAR`). Re-seeding any fresh DB always yields current data.

| Area | Before | After (relative) |
|------|--------|------------------|
| Fee due date | `2026-05-25` (overdue) | today **+21 days** |
| Fee payment history | Jan 2026 fixed | today **−150 … −140 days** |
| Exam theory start / hall ticket | `2026-06-15` / `2026-06-10` | today **+14** / **+9 days** |
| Notices (fee/exam/holiday/scholarship) | fixed May/June text | dates rendered from `human(+21/+14/+15/+20)`, `publishedAt` recent, `expiresAt` future |
| Borrowed books due dates | `2026-06-15/22` | today **+7** and **+2 days** |
| Academic year | `2025–2026` | computed (`2026–2027`) |
| Events (NEW) | none seeded → empty dashboard | 3 events at today **+7 / +14 / +21** |

## Live-database remediation (existing data)
Because the live DB was seeded earlier, `backend/scripts/refresh-demo-data.js` re-bases existing records (dry-run by default, `--apply` to write; idempotent; never deletes).

**Dry run against the live DB confirmed 7 stale records:**
```
1. notice "Semester V Examination Schedule Released" → refresh dates
2. notice "Internal Marks Published"                 → refresh dates
3. notice "College Holiday – May 30, 2026"           → refresh dates
4. notice "Scholarship Application Open"             → refresh dates
5. exam 6a16ff6b… : blank department → 'IT' (stop leakage)
6. exam 6a16ff6b… (IT): dates re-based forward
7. fee 22IT101: dueDate 2026-05-25 → 2026-07-05
```
> The remediation was **not applied** to production — it mutates live data, so it awaits an explicit go-ahead + DB snapshot. Run: `cd backend && node scripts/refresh-demo-data.js --apply`.

## Verification
- `node --check seed.js` ✅ · helper output validated (future dues, past history).
- Fresh seed produces no past-due / expired content.
- New users see current notices + upcoming events.

## Files changed
- `backend/seed.js` (relative dates, events seed) · `backend/scripts/refresh-demo-data.js` (**new**)

## Collections involved
`notices`, `exams`, `fees`, `borrowedbooks`, `events` — data values only; **no schema changes**.
