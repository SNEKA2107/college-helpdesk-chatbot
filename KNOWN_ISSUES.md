# CampusAssist v1.0 RC1 — Known Issues

**Date:** 2026-07-22
**Scope:** Non-blocking limitations known at Release Candidate. No Critical or High issues remain (see `BUG_TRACKER.md`). Nothing here blocks a controlled pilot; items marked **[Ops]** require an action outside the codebase before/at go-live.

---

## Operational (must confirm before go-live)

### KI-01 — MongoDB Atlas backups must be enabled **[Ops] · High priority (ops)**
Production data lives in Atlas. If the cluster is on the M0 free tier, **no automated backups exist**. Before pilot go-live, enable Atlas Cloud Backup (requires M10+), and take a manual `mongodump`/snapshot immediately before running any migration.
**Workaround until then:** manual `mongodump` on a schedule.

### KI-02 — `ANTHROPIC_API_KEY` not declared in `render.yaml` **[Ops] · Low**
When unset, AI features (Home Daily Briefing, Campus Copilot) **degrade gracefully** to deterministic templates / keyword bot — the app remains fully functional. Set the key in the Render dashboard to enable full AI responses.

---

## Product / data

### KI-03 — Only one cohort has a published timetable · Medium
A published timetable currently exists for **IT / 5th** only. Students in other cohorts (2nd/4th/6th/8th semesters) correctly see "No timetable has been published for your class yet." This is an **admin data-entry gap, not a defect** — admins publish a timetable per active cohort.
**Action:** publish timetables for each cohort included in the pilot.

### KI-04 — Four student records had a blank `semester` · Low
The demo student (`22IT101`) was corrected to `5th` during the audit. Three other student records still have a blank `semester`, which will limit their cohort-scoped views (timetable/exam) until corrected.
**Action:** normalize remaining blank-semester records via admin edit.

---

## Engineering (post-RC backlog)

### KI-05 — N+1 queries in bulk attendance marking · Medium
`POST /api/attendance/bulk` performs a sequential `User.findOne` + upsert per record (~2 round-trips/student). Admin-only, low-frequency, functionally correct and idempotent; acceptable at pilot class sizes.
**Planned fix:** single `User.find({ studentId: { $in } })` + one `bulkWrite`.

### KI-06 — Repository contains unshipped dev artifacts · Low
~31 root dev scripts (`debug-*.js`, `test-*.js`, `audit-*.js`, `screenshot-*.js`), ~25 legacy pre-React `*.html`, and ~31 root screenshot PNGs are **not part of the deployed artifact** (`backend/` + `frontend/dist`) and are not served in production. Left in place during the release freeze to avoid breaking `selenium_model` tests / doc references.
**Planned:** dedicated post-RC cleanup PR (quarantine → remove) with test re-run.

### KI-07 — Test coverage is data/logic-focused · Low
Automated suite (9 tests) covers model invariants and timetable cohort resolution. There is no HTTP-level integration harness (e.g., supertest) exercising full request/response cycles and auth flows end-to-end; those paths are currently covered by the manual live sweep.
**Planned:** add a supertest-based route suite in a future minor release.

### KI-08 — Admin `GET /api/timetable` and `GET /api/fees` return 404 · Informational (not a bug)
Admins have no personal cohort/fee record, so the student-scoped endpoints 404 for them by design. Admin UIs use `/api/timetable/all` and `/api/fees/all` (both `200`). No action required.

---

## Summary
| ID | Area | Severity | Blocks pilot? |
|----|------|----------|---------------|
| KI-01 | Atlas backups | High (ops) | Confirm first |
| KI-02 | AI key optional | Low (ops) | No |
| KI-03 | Timetables per cohort | Medium | No (publish as needed) |
| KI-04 | Blank semesters (3 left) | Low | No |
| KI-05 | Bulk-attendance N+1 | Medium | No |
| KI-06 | Dev artifacts in repo | Low | No |
| KI-07 | Integration test gap | Low | No |
| KI-08 | Admin 404 by design | Info | No |
