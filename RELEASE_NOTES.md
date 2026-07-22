# CampusAssist v1.0 — Release Notes (Release Candidate 1)

**Release:** v1.0-rc1
**Date:** 2026-07-22
**Status:** Release Candidate — feature-frozen, stabilization complete
**Stack:** React 18 + Vite (frontend) · Node/Express (backend) · MongoDB Atlas · deployed on Render · Android APK via Capacitor

CampusAssist is an AI-assisted college helpdesk and student-success platform. v1.0 is the first production-candidate release, consolidating the architecture and implementation programs into a stable, secure build.

---

## Highlights

### Student experience
- **Personalized Home** — AI Daily Briefing (Claude-backed, with a deterministic template fallback), success score, attendance risk, upcoming exams, placement snapshot, smart notice feed, and Copilot activity.
- **Success Dashboard** — credit-weighted CGPA, attendance trend + prediction, and a composite success score with recommendations.
- **Placement Hub** — readiness scoring, per-company eligibility (CGPA/attendance gates), and recommended skills.
- **Campus Copilot (Chat)** — conversational assistant with saved conversation threads; Claude-backed with a keyword-bot fallback when no API key is configured.
- **Academics & services** — Attendance, Marks/CGPA, Exams & schedule, Timetable, Fees (with payment history + verification), Library (borrow/renew), Leave, Requests, Events, Notices, Calendar, Profile.

### Admin experience
- Student directory with registration **approval workflow** (pending/approve/reject).
- **Knowledge Base** and **Faculty Directory** management.
- **Analytics** dashboard and an **Audit Log** of privileged actions.
- Content management for Notices (with AI summarization), Exams, Timetables (draft → published → archived lifecycle), Fees verification, and Events.

### Platform
- JWT authentication with bcrypt (cost 12) password hashing and a registration-approval gate.
- Role-based authorization (`student` / `admin`) enforced on every route; ownership checks prevent cross-user data access.
- Hardened HTTP layer: Helmet + CSP, HSTS, CORS allowlist, and request rate limiting.
- Responsive React SPA served by the Express backend; installable Android APK.

---

## Changes in RC1 (stabilization since implementation audit)

- **Backend/frontend synchronization** — restored the full API surface the shipped frontend calls (`/home`, `/success`, `/placement`, `/conversations`, `/faculty`, `/knowledge`, `/analytics`), eliminating the 404s that broke the Home, Success, Placement, Chat, and admin Knowledge/Faculty/Analytics pages.
- **Timetable reliability** — fixed the demo cohort's data drift (blank student semester + legacy timetable rows missing the `status` field) and added idempotent migration `0004-backfill-timetable-status` so no environment can regress into the Timetable 404.
- **Production logging** — `morgan` access logging is now environment-gated (`combined` in production, `dev` locally).
- **Environment documentation** — `.env.example` now documents `AUTH_RATE_LIMIT` and `RENDER_EXTERNAL_URL`.
- **Test coverage** — added `timetable-cohort.test.js` (cohort isolation + published-status contract, including a regression for the RC bug). Suite: **9/9 passing**.

No features were added, removed, or redesigned in RC1.

---

## Verification summary
- Automated tests: **9/9 passing** (`npm test`).
- Endpoint sweep: student **16/16**, admin **7/7** → `200`; unauthenticated → `401`; unknown routes → `404`; all responses < 300 ms.
- Security: live-verified headers, auth/authz, and IDOR protections (see `RELEASE_CHECKLIST.md` and `BUG_TRACKER.md`).
- Production build: clean, minified, no sourcemaps, ~686 KB.

## Upgrade / deploy notes
1. Set production env vars in the Render dashboard: `MONGO_URI`, `JWT_SECRET`, `FRONTEND_URL`, `NODE_ENV=production`, and (optional, for full AI) `ANTHROPIC_API_KEY`.
2. Take an Atlas snapshot, then run pending migrations: `npm run migrate:timetable` (and `migrate:attendance` / `migrate:fees` if not previously applied). All are idempotent.
3. Confirm **Atlas automated backups** are enabled before go-live (see `KNOWN_ISSUES.md`).

See `KNOWN_ISSUES.md` for the current list of non-blocking limitations.
