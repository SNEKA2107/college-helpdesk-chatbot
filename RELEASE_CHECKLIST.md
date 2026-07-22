# CampusAssist v1.0 — Release Candidate (RC1) Checklist

**Prepared by:** Release Manager
**Date:** 2026-07-22
**Build:** frontend `dist` (Vite, code-split) + `backend/server.js` (Express) → MongoDB Atlas
**Feature status:** ❄️ FROZEN — stabilization only, no new features

Legend: ✅ pass · ⚠️ pass with note / ops action · ⛔ blocker (none remain)

---

## 1. Verify every module ✅
- **Backend routes:** 23 route modules `require` and mount cleanly; full live sweep of 34 endpoints × {unauth, student, admin} — correct 401/403/200, all < 300 ms.
- **Student smoke:** 16/16 core endpoints `200`. **Admin smoke:** 7/7 admin endpoints `200`.
- **Automated tests:** `npm test` → **9/9 passing** (5 model invariants + 4 timetable cohort/lifecycle).
- **Frontend:** production build succeeds; every page's backing API returns data (see implementation audit / `BUG_TRACKER.md`).

## 2. Remove debug code ✅
- Shipped backend (`routes`, `services`, `middleware`, `models`): **no** `console.log` / `console.debug` / `debugger`. `console.error` retained for legitimate error logging.
- Frontend `src`: **0** `console.log` / `console.debug` statements.
- No `TODO`/`FIXME` in shipped code (the two scan hits were `"+91 XXXXX"` phone placeholders).

## 3. Remove unused files ⚠️ (deferred to post-RC cleanup — see KNOWN_ISSUES)
- The deployed artifact is **`backend/` + `frontend/dist`** only. Not shipped / not served: ~31 root dev scripts (`debug-*.js`, `test-*.js`, `audit-*.js`, `screenshot-*.js`), ~25 legacy pre-React `*.html`, ~31 root `*.png` screenshots (mostly gitignored).
- **Decision:** during a release freeze these are **documented, not deleted** — a mass delete risks breaking `selenium_model` tests and doc references and is out of scope for "stabilize." Tracked as a post-RC cleanup task.

## 4. Optimize production build ✅
- `npm run build` (Vite) → built in ~1.7 s. Route-level code-splitting, esbuild minification, gzipped.
- **No sourcemaps** emitted to `dist` (no source disclosure). Total `dist` ≈ 686 KB; largest gzip chunks: `index` 57 KB, GSAP/ScrollTrigger 45 KB, `Admin` 17 KB.
- Hashed asset filenames enable long-cache immutability.

## 5. Check environment variables ✅
- App reads 11 vars: `MONGO_URI`, `JWT_SECRET`, `PORT`, `NODE_ENV`, `FRONTEND_URL`, `ANTHROPIC_API_KEY`, `AUTH_RATE_LIMIT`, `RENDER_EXTERNAL_URL`, `EMAIL_SERVICE`, `EMAIL_USER`, `EMAIL_PASS`.
- `backend/.env` is **git-ignored and untracked** (verified: not in index, not in HEAD). Only `.env.example` is tracked. **No secrets in the repo.**
- `.env.example` updated this release to document `AUTH_RATE_LIMIT` (optional, default 20) and `RENDER_EXTERNAL_URL` (Render auto-sets).

## 6. Verify database migrations ✅
- `0001-dedupe-attendance`, `0002-backfill-fee-verification`, `0003-notice-lifecycle` — all **idempotent** (`$exists` guards / index no-op), re-runnable.
- **Added this release:** `0004-backfill-timetable-status.js` (+ `npm run migrate:timetable`) — mirrors 0003, backfills `status:'published'` on legacy statusless timetables (root cause of the pilot Timetable 404). Verified idempotent: re-run reports **0 modified** (data already consistent).

## 7. Verify logging ✅
- HTTP access logging via `morgan`, now **environment-gated**: `combined` (production) / `dev` (development).
- Errors logged via central Express error handler (`console.error('Server error:', err.stack)`) returning a generic 500 body (no stack leaked to clients).

## 8. Verify backups ⚠️ (ops action required — see KNOWN_ISSUES)
- Data lives in **MongoDB Atlas**. Backup posture must be confirmed in the Atlas dashboard **before pilot go-live**: on M0 free-tier there are **no automated backups** — a paid tier (M10+) with continuous/snapshot backups is required for production data safety.
- Recommended: enable Atlas Cloud Backup + a documented manual `mongodump` snapshot immediately prior to running any migration.

## 9. Verify security headers ✅ (verified live)
- Helmet active: `Content-Security-Policy`, `Strict-Transport-Security` (max-age 180d, includeSubDomains), `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-DNS-Prefetch-Control`, `X-Download-Options`, `X-Permitted-Cross-Domain-Policies`. `X-Powered-By` removed.
- Rate-limit headers present (`RateLimit-Limit: 150; w=60`). CORS origin allowlist enforced.

## 10. Verify production configuration ✅ (one ops note)
- `render.yaml`: `NODE_ENV=production`; `MONGO_URI` / `JWT_SECRET` / `FRONTEND_URL` are `sync:false` (set in dashboard, never committed). Build compiles the React frontend; start = `node backend/server.js`.
- `trust proxy` set (correct client IPs behind Render). SPA fallback + `/api` 404 handler present.
- **Note:** `ANTHROPIC_API_KEY` is not declared in `render.yaml`. If unset, AI briefing/chat **degrade gracefully** to deterministic templates/keyword bot — acceptable for RC. Set it in the dashboard to enable full AI.

---

## Security / correctness carried from the implementation audit (`BUG_TRACKER.md`)
- Auth (JWT), role gating (`adminOnly`), and **IDOR/BOLA** protections verified live (cross-user edit → 403; self privilege-escalation blocked). Passwords bcrypt cost 12, stripped from all responses.
- Critical + High bugs from the audit are **fixed and verified** (backend/frontend sync; Timetable data backfill).

## RC1 verdict
All 10 tasks pass or are documented with a clear ops action. **No blockers remain.** CampusAssist v1.0 **RC1 is ready for pilot** pending two operational confirmations: (1) Atlas backups enabled (Task 8), (2) `ANTHROPIC_API_KEY` set if full AI is desired (Task 10).
