# CampusAssist v1.0 — Deployment Guide

**Build:** v1.0-rc1 · **Date:** 2026-07-22 · **Platform:** Render (web service) + MongoDB Atlas

This guide reflects the **actual** repository configuration (`render.yaml`, `backend/server.js`, `backend/package.json`). No code changes are required to deploy.

---

## 1. Prerequisites
- A MongoDB Atlas cluster (see §2) and its connection string.
- A Render account with access to this GitHub repository.
- A strong `JWT_SECRET` (e.g. `openssl rand -base64 48`).
- (Optional) An Anthropic API key for full AI features.

## 2. MongoDB (Atlas)
1. Create a cluster. **For production use M10+ (not the M0 free tier) so automated backups are available** — see `OPERATIONS_RUNBOOK.md` and KI-01.
2. Create a database user with least privilege (readWrite on the app DB only).
3. **Network access:** allow Render egress. Prefer an Atlas Private Endpoint / specific IP allowlist; avoid `0.0.0.0/0` in production.
4. Copy the SRV connection string → this becomes `MONGO_URI` (include the DB name, e.g. `.../campusassist`).
5. Connection settings are already tuned in `server.js` (`tls: true`, `serverSelectionTimeoutMS: 15000`, `socketTimeoutMS: 45000`).

## 3. Environment variables
Set these in the **Render dashboard** (never commit real values; `backend/.env` is git-ignored; only `.env.example` is tracked).

| Variable | Required | Purpose | Notes |
|----------|----------|---------|-------|
| `MONGO_URI` | ✅ | Atlas connection string | `sync:false` — dashboard only |
| `JWT_SECRET` | ✅ | Signs/verifies JWTs | Long random string; rotating it invalidates all sessions |
| `NODE_ENV` | ✅ | `production` | Enables prod logging (`morgan combined`) |
| `FRONTEND_URL` | ✅ | CORS allow-origin | Set to the deployed site URL |
| `PORT` | auto | Render injects it | `server.js` falls back to 5000 |
| `ANTHROPIC_API_KEY` | ⬜ | Full AI (briefing/chat) | **Unset ⇒ graceful fallback** to templates/keyword bot |
| `AUTH_RATE_LIMIT` | ⬜ | Max logins / 15 min / IP | Default 20 |
| `RENDER_EXTERNAL_URL` | auto | Render sets it | Auto-added to CORS allowlist |
| `EMAIL_SERVICE` / `EMAIL_USER` / `EMAIL_PASS` | ⬜ | Email notifications | Optional |

## 4. Build & start commands
Already declared in `render.yaml`:

```yaml
buildCommand: cd backend && npm install --omit=dev && cd ../frontend && npm install --include=dev && npm run build
startCommand: node backend/server.js
```

- The build installs backend deps (prod only), then builds the React frontend into `frontend/dist`.
- At runtime `server.js` serves `frontend/dist` (SPA) and mounts the API under `/api/*`.

## 5. Deploy procedure
1. Merge the release commit to the deploy branch (Render's tracked branch — typically `main`).
2. Confirm all env vars are set (§3).
3. Trigger deploy (auto on push, or "Manual Deploy" in Render).
4. Watch build logs → expect a successful Vite build and `✅ MongoDB Atlas connected successfully`.
5. Run **post-deploy verification** (§8).
6. Apply any pending migrations (§7) **after** taking a snapshot.

## 6. Health checks
There is no dedicated `/health` route; use these:
| Check | Request | Healthy response |
|-------|---------|------------------|
| App/SPA up | `GET /` | `200` (serves `index.html`) |
| API up | `GET /api/<unknown>` | `404 {success:false}` (proves API layer alive) |
| Auth enforced | `GET /api/home` (no token) | `401` |
| DB connected | Deploy log line | `✅ MongoDB Atlas connected successfully` |

Configure Render's health check path to `/` (expects 200). *(Optional post-pilot hardening: add a lightweight `/api/health` returning DB ping status — a small, non-feature addition.)*

## 7. Database migrations
Idempotent, re-runnable. **Take an Atlas snapshot first.** From `backend/`:
```bash
npm run migrate:attendance   # 0001 — dedupe attendance
npm run migrate:fees         # 0002 — backfill fee verification
node migrations/0003-notice-lifecycle.js   # 0003 — notice lifecycle
npm run migrate:timetable    # 0004 — backfill timetable status
```
Each reports how many rows it modified; a second run should report ~0.

## 8. Post-deploy verification (smoke)
```bash
BASE=https://<your-service>.onrender.com
curl -s -o /dev/null -w "%{http_code}\n" $BASE/                       # 200
curl -s -o /dev/null -w "%{http_code}\n" $BASE/api/home               # 401
TOKEN=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d '{"studentId":"22IT101","password":"student123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
curl -s -o /dev/null -w "%{http_code}\n" $BASE/api/home -H "Authorization: Bearer $TOKEN"  # 200
```
Confirm security headers: `curl -sI $BASE/ | grep -i "content-security-policy\|strict-transport"`.

## 9. Rollback procedure
1. **App code:** in Render → Deploys → select the last known-good deploy → **Rollback** (or redeploy the previous Git SHA/tag). Render keeps prior builds.
2. **Verify:** re-run §8 smoke against the rolled-back build.
3. **Database:** app rollbacks do **not** revert data. If a migration caused the issue, restore from the pre-migration Atlas snapshot (§10 / runbook). Because migrations are additive/idempotent, most rollbacks need **no** DB action.
4. **Communicate:** note the rollback in the incident log (`OPERATIONS_RUNBOOK.md`).

**Rollback triggers:** failed health check, spike in 5xx, DB connection failures, or a Critical/High defect in production.

## 10. Backup procedure
- **Preferred:** enable **Atlas Cloud Backup** (continuous/snapshot) on an M10+ cluster; verify a restore once (runbook).
- **Manual snapshot (any tier), always before a migration/deploy:**
  ```bash
  mongodump --uri "$MONGO_URI" --archive="campusassist-$(date +%F).gz" --gzip
  # restore:
  mongorestore --uri "$MONGO_URI" --archive="campusassist-YYYY-MM-DD.gz" --gzip
  ```
- Store archives off-Render (e.g., object storage) with a documented retention (e.g., 30 days).

---

## Deploy sign-off checklist
- [ ] Env vars set (§3) · [ ] Atlas backups enabled (§10) · [ ] Snapshot taken · [ ] Build green + DB connected · [ ] Migrations applied (§7) · [ ] Smoke passed (§8) · [ ] Rollback target identified (§9)
