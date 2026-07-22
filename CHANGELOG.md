# Changelog

All notable changes to CampusAssist are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
- Nothing yet.

## [1.0.0] — 2026-07-22

First production release. Feature-complete after architecture, security, verification,
portal-separation, university-acceptance, and production-polish passes.

### Added
- Separate **Student** (`/student/*`) and **Admin** (`/admin/*`) portals with dedicated
  `StudentLayout` / `AdminLayout` route layouts and bidirectional role guards.
- Personalized **Home** AI dashboard, **Success Dashboard**, **Placement Hub**, and
  **Campus Copilot** AI assistant (Claude-backed with deterministic fallbacks).
- Admin **AI Analytics**, **Knowledge Base Manager**, and **Faculty Directory**.
- Idempotent migration `0004-backfill-timetable-status` (+ `npm run migrate:timetable`).
- Timetable cohort/lifecycle regression test suite (`backend/tests/timetable-cohort.test.js`).
- `aria-label`s on icon-only controls (menu, dialog close, password toggles).
- Release/ops documentation: pilot plan, UAT, performance, deployment guide, operations
  runbook, risk register, university acceptance, portal verification, production polish.

### Changed
- Post-login redirects: students → `/student/dashboard`, admins → `/admin/dashboard`.
- Student navigation namespaced to `/student/*` with backward-compat redirects from legacy paths.
- HTTP access logging gated by environment (`morgan combined` in production, `dev` locally).
- `.env.example` documents `AUTH_RATE_LIMIT` and `RENDER_EXTERNAL_URL`.
- Register form: emptied example/personal placeholders; added registration autocomplete semantics.

### Fixed
- Home dashboard failed to load — restored the `/api/home` route and its service/model chain.
- Restored the full AI-platform API surface (`/success`, `/placement`, `/conversations`,
  `/faculty`, `/knowledge`, `/analytics`) that the shipped frontend depends on.
- Timetable returned 404 for the demo cohort — data drift (blank student semester + legacy
  timetable rows missing `status`) corrected and covered by migration `0004`.
- Admins could load student pages — added `RequireStudent` guard (bidirectional isolation).

### Security
- Enforced role-based access at both the client (portal guards) and server (403 on cross-role).
- Verified JWT auth, bcrypt (cost 12) password hashing, IDOR/BOLA protections, Helmet/CSP,
  HSTS, CORS allowlist, and rate limiting.
- Confirmed no secrets tracked in the repository (`.env` git-ignored).

[Unreleased]: https://example.com/compare/v1.0.0...HEAD
[1.0.0]: https://example.com/releases/tag/v1.0.0
