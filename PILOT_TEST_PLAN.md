# CampusAssist v1.0 — Pilot Test Plan

**Owner:** Product Owner / QA Lead
**Date:** 2026-07-22
**Build under test:** v1.0-rc1 (feature-frozen) — see `RELEASE_NOTES.md`, `RELEASE_CHECKLIST.md`

---

## 1. Objectives
- Validate that CampusAssist supports real student and administrative workflows end-to-end in a production-like environment.
- Confirm stability, performance, and data integrity with concurrent real users (not synthetic load).
- Surface usability friction and operational gaps before any wider rollout.
- Exercise the operational playbooks (`OPERATIONS_RUNBOOK.md`, `DEPLOYMENT_GUIDE.md`) with a live user base.

## 2. Scope

**In scope**
- Student self-service: login, personalized Home/Success dashboard, attendance, fees, leave, requests, notices, timetable, exams, library, marks/CGPA, chat (Campus Copilot), profile.
- Administrative operations: user/registration approval, notices, events, exams, timetables, fees verification, analytics, audit log, knowledge base, faculty directory.
- Cross-cutting: authentication, authorization, security headers, rate limiting, AI graceful-degradation.

**Out of scope (pilot)**
- University-wide load / stress testing (separate exercise before scale-up).
- Native Android APK distribution at scale (web pilot first; APK available for opt-in testers).
- Email/notification delivery at volume.
- Any feature development or redesign (frozen).

## 3. Roles

> ⚠️ **Role-model reality:** the system defines exactly **two login roles — `student` and `admin`** (`User.role` enum). **There is no dedicated `faculty` login role.** Faculty-type actions (marking attendance, looking up students) are performed through **admin/staff accounts**. The `Faculty` collection is an admin-managed *directory* of faculty records, not a set of login users. Faculty UAT below is therefore executed by a **staff member using an admin account** (see `PILOT_RISK_REGISTER.md` R-07).

| Role | Pilot representation | Responsibilities in pilot |
|------|----------------------|---------------------------|
| **Student** | Student login accounts (approved) | Daily self-service usage; report bugs/UX issues |
| **Faculty** | Staff using an **admin** account (scoped by convention) | Attendance management, student lookup, notices, request handling |
| **Admin** | Dedicated admin account(s) | Full administration, approvals, content, analytics, monitoring |

## 4. Success Criteria

| # | Criterion | Target | Evidence source |
|---|-----------|--------|-----------------|
| SC-1 | Core student journeys complete without errors | ≥ 95% of UAT student cases **Pass** | TASK 2 UAT results |
| SC-2 | No Critical/High defects open at pilot exit | 0 | `BUG_TRACKER.md` + pilot defect log |
| SC-3 | Auth & authorization hold (no cross-user data access) | 0 IDOR/authz incidents | Verified in audit; monitor during pilot |
| SC-4 | API latency (non-AI endpoints) | p95 < 400 ms | Measured 55–72 ms warm (TASK 3) |
| SC-5 | Dashboard/AI endpoints | p95 < 800 ms | Measured 172–222 ms (TASK 3) |
| SC-6 | Login response | p95 < 800 ms | Measured median 261 ms (TASK 3) |
| SC-7 | Uptime during pilot window | ≥ 99% (business hours) | Health checks (TASK 4) |
| SC-8 | No data loss; backup + restore proven once | 1 successful restore drill | `OPERATIONS_RUNBOOK.md` |
| SC-9 | User satisfaction | ≥ 4/5 average | Post-pilot survey |

**Exit = pilot is successful** when SC-1, SC-2, SC-3, SC-7, SC-8 are met and the remaining criteria are within target or have an agreed action.

## 5. Duration
- **Total: 3 weeks (15 business days)**
  - Week 0 (pre-pilot, 2 days): environment setup, seed/verify accounts, backup drill, smoke test.
  - Week 1: onboard ~5 pilot users (soft launch), triage early issues daily.
  - Week 2: full cohort active; UAT execution; daily monitoring.
  - Week 3: stabilization, defect burn-down, exit review + report.

## 6. Number of Users
- **Target: 20 users** for the initial pilot.
  - ~15 students, ~3 faculty/staff (admin-scoped), ~2 administrators.
- Rationale: 20 concurrent-realistic users sit comfortably within measured resource headroom (server ~145 MB RSS; per-IP rate limit 150 req/min) and Atlas connection limits, while being large enough to expose real workflow and data issues.
- Scale-up to 100 is a **separate, gated** exercise contingent on infrastructure upgrades (see `PILOT_RISK_REGISTER.md` R-01/R-02 and TASK 7).

## 7. Entry & Exit Criteria
**Entry:** RC1 verified (✅), accounts provisioned, backups confirmed enabled, health check green, rollback procedure rehearsed.
**Exit:** success criteria met; defect log triaged; go/no-go decision recorded for the next scale tier.

## 8. Deliverables
UAT results (TASK 2), performance report (TASK 3), pilot defect log, exit report with go/no-go for 100-user scale.
