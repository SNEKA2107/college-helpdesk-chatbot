# CampusAssist v1.0 — Release Notes

**Version:** 1.0.0 · **Release date:** 2026-07-22 · **Status:** Production release candidate → v1.0
**Stack:** React 18 + Vite (frontend) · Node/Express (backend) · MongoDB Atlas · Render · Android APK (Capacitor)

CampusAssist v1.0 is the first production release of the AI-assisted college helpdesk and student-success platform. It ships two fully separated role portals, an AI layer with graceful degradation, and a hardened security and operations baseline.

---

## Major Features
- **Two completely separate role portals** — `/student/*` and `/admin/*` with distinct layouts, navigation, and role-enforced routing.
- **AI-assisted student experience** — personalized daily briefing, success scoring, placement readiness, and a conversational campus assistant (all with deterministic fallbacks).
- **Full academic & services suite** — attendance, marks/CGPA, exams, timetable, fees, leave, requests, events, notices, library.
- **Admin control panel** — student approval workflow, content management, analytics, audit log, knowledge base, and faculty directory.
- **Installable Android app** (Capacitor) in addition to the responsive web app.

## Student Portal
Home (AI dashboard) · Dashboard · Success Dashboard · Placement Hub · AI Assistant (Campus Copilot) · Attendance · Marksheet Status · Exam Info · Fees (with payment history) · Timetable · CGPA Calculator · Leave Application · OD Request · Events · Notices · Library · Contact · Profile · Settings.
- Sidebar + topbar + mobile bottom-nav; students see **student features only** — no admin navigation.
- Login redirects students to `/student/dashboard`; admins can never load student pages (and vice-versa).

## Admin Portal
Dashboard/Overview · AI Analytics · Knowledge Base Manager · Faculty Directory · Requests · Leave Applications · Notices · Messages · Students (approval workflow) · Exams · Attendance · Events · Timetable · Marks · Calendar · Fee Verification · Audit Log.
- Self-contained ERP-style control panel; admins see **admin features only**.
- Registration approval gate (pending → approve/reject with reason), all privileged actions audit-logged.

## AI Features
- **Personalized Home briefing** and **Campus Copilot** chat, backed by Claude (`claude-haiku-4-5`) when `ANTHROPIC_API_KEY` is set.
- **Graceful degradation:** with no API key, AI features fall back to deterministic templates / keyword responses — the app remains fully functional.
- **AI Analytics** and **Knowledge Base** manager for admins; Notice AI-summarization.

## Security Improvements
- JWT authentication; passwords bcrypt-hashed (cost 12) and never returned to clients.
- Role-based authorization on every route; **bidirectional portal guards** + backend **403** on cross-role access; IDOR/BOLA protections verified.
- Helmet + Content-Security-Policy, HSTS, X-Frame-Options, nosniff, Referrer-Policy; CORS allowlist.
- Rate limiting (auth 20/15min, global 150/min); `trust proxy` for correct client IPs.
- Secrets kept in environment only (`.env` git-ignored; not in the repo).

## Performance Improvements
- Route-level **lazy loading** and code-splitting; **no sourcemaps** in production; core bundle **57 KB gzip**.
- Measured: standard APIs **55–120 ms**, AI-aggregation endpoints **172–222 ms**, warm SPA navigation **205–350 ms**, server **~145 MB RSS**.
- Environment-gated HTTP logging (`morgan combined` in production).

## Bug Fixes
- Restored the personalized **Home dashboard** (missing `/api/home` route) and the full AI-platform API surface (`/success`, `/placement`, `/conversations`, `/faculty`, `/knowledge`, `/analytics`).
- Fixed **Timetable 404** caused by data drift (blank student semester + legacy timetable rows missing `status`); added idempotent migration `0004-backfill-timetable-status`.
- **Register page** no longer shows example/personal placeholder data; empty fields + correct autocomplete attributes.
- Gated development logging out of production.
- Enforced **admin cannot load student pages** (added `RequireStudent` guard).
- Accessibility: `aria-label`s added to icon-only controls.

## Known Limitations
- **Faculty is not a login role** — faculty-type actions are performed via admin accounts (dedicated role planned for a future version).
- **Large admin lists are not server-paginated** (fine ≤ ~500 students; pagination needed at ~5,000).
- Schema validation errors on some creates return HTTP 500 instead of 400 (low impact — the UI uses validated inputs).
- Render free-tier cold starts; Atlas backups must be enabled operationally before go-live.
- HTTP-level integration tests are limited (model + timetable-cohort suites present; broader supertest suite planned).

See `KNOWN_ISSUES.md` for the full list with severities.

## System Requirements
- **Runtime:** Node.js 18+ (backend), modern evergreen browser (frontend).
- **Database:** MongoDB Atlas (M10+ recommended for production backups/scale).
- **Hosting:** Render web service (or any Node host serving `frontend/dist`).
- **Required env:** `MONGO_URI`, `JWT_SECRET`, `NODE_ENV`, `FRONTEND_URL`. **Optional:** `ANTHROPIC_API_KEY`, `AUTH_RATE_LIMIT`, email vars.
- **Recommended scale tiers:** 50 users — ready now; 500 — with paid always-on instance + Atlas M10; 5,000 — requires horizontal scaling + pagination + load testing.
