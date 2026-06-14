# PHASE 2 — PROGRESS REPORT (High Priority)

**Date:** 2026-06-14 · **Scope:** H1–H5 only · **Commit/push:** none

Per-issue verification across student workflow, admin workflow, persistence, API, permissions, data isolation, and regression safety. Full live-API run: **29/29 passed.**

| Issue | Student workflow | Admin workflow | Persistence | API | Permissions | Isolation | Regression |
|-------|------------------|----------------|-------------|-----|-------------|-----------|------------|
| **H1 Timetable lifecycle** | sees published only; 404 for draft/archived ✅ | draft→publish→archive + history ✅ | status/publishedAt in Mongo ✅ | `/publish`,`/archive`,`/conflicts` ✅ | non-admin publish→403 ✅ | cohort-scoped, no leak ✅ | existing TTs default published → still visible ✅ |
| **H2 Conflict detection** | n/a (admin-gate) | publish blocked on conflict, preview ✅ | n/a (read-time) | 409 + conflicts[] ✅ | adminOnly ✅ | only compares published ✅ | clean publish still works ✅ |
| **H3 Exam per cohort** | sees only cohort/published exam ✅ | create(draft)/edit/publish/archive + `/all` ✅ | dept/year/section/status ✅ | resolver + `/all` + lifecycle ✅ | adminOnly writes ✅ | dept/sem/year/section scoped; blank dept = all ✅ | existing exam default published+blank dept → all see it ✅ |
| **H4 Registration approval** | register→pending→await; blocked till approved ✅ | pending list + approve/reject ✅ | approvalStatus persisted ✅ | register(no token)/login-block/approve/reject ✅ | non-admin approve→403 ✅ | n/a | default 'approved' → existing users/admin unaffected ✅ |
| **H5 Audit logging** | n/a | read-only audit tab ✅ | AuditLog collection ✅ | `GET /audit` (+filters) ✅ | student→403 ✅ | admin-only visibility ✅ | fire-and-forget, never breaks ops ✅ |

## Build / static
- ✅ `node --check` on all 15 changed/new backend files.
- ✅ `vite build` succeeds.

## Notable design choices (backward compatibility)
- New lifecycle fields default to the *visible/working* state (`published` / `approved`) so **no migration** is needed and existing data/logins keep working.
- Content `PUT` endpoints no longer flip status — lifecycle is driven only by explicit `/publish` & `/archive`.
- `apiCall` now returns the parsed body on non-2xx (additive) so the UI can show 409 conflict details.

*All test data created during verification was deleted from the live DB. DO NOT COMMIT.*
