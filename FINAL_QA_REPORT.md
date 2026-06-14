# FINAL QA REPORT — RC1 (v1.0-submission)

**Date:** 2026-06-14 · **Method:** Live API integration run against the backend + MongoDB Atlas, exercising a full fresh student lifecycle and admin flows. All test data deleted afterward.

## Result: 18 / 18 PASS

| # | Checklist item | Result | Evidence |
|---|----------------|--------|----------|
| 1 | Admin Login | ✅ | `ADMIN01` returns admin role + token |
| 2 | Student Registration | ✅ | returns `pending:true`, **no token** (no auto-login) |
| 3 | (Login before approval) | ✅ | blocked with 403 |
| 4 | Registration Approval | ✅ | admin `PUT /students/:id/approve` |
| 5 | Student Login | ✅ | succeeds **after** approval |
| 6 | Dashboard | ✅ | new student stats all zero (clean, no inherited data) |
| 7 | Timetable | ✅ | admin create→publish; student sees own cohort timetable |
| 8 | Exams | ✅ | admin create→publish; student sees cohort exam + **DB instructions** |
| 9 | Leave | ✅ | submit with base64 document; admin can view/download it |
| 10 | OD | ✅ | submit (On Duty) succeeds |
| 11 | Notices | ✅ | admin create; student sees it |
| 12 | Announcements | ✅ | (notices/events) student sees admin-created notice |
| 13 | Events | ✅ | **server-side** registration reflected in `event.registrations` |
| 14 | Profile | ✅ | update name/phone persists |
| 15 | Chatbot | ✅ | dynamic reply, **no hardcoded "June 15" date** |
| 16 | Logout / auth guard | ✅ | protected route → 401 without token |
| 17 | Registration Approval (audit) | ✅ | approve/reject audited |
| 18 | Admin audit logging | ✅ | `timetable.publish` etc. recorded |

## Coverage notes
- **Data isolation:** new student sees clean empty states (requests/leave/dashboard); cohort timetable/exam scoped, no cross-cohort leakage.
- **Permissions:** student blocked from admin-only endpoints (verified across phases: audit/publish/approve → 403).
- **Persistence:** documents, registrations, approvals all survive in MongoDB across sessions.
- **MongoDB communication:** all flows read/write Atlas successfully.

## Items verified earlier (still valid)
Phase 1 (15/15), Phase 2 (29/29), Fast-track (15/15) — cumulative with this run.

**Verdict:** ✅ All 15 required checklist items (and supporting checks) pass. No regressions found.
