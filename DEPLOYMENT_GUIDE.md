# CampusAssist — Deployment Guide

**Platform:** Render (single web service) + MongoDB Atlas · Reflects the actual repo config (`render.yaml`, `backend/server.js`, `backend/package.json`).

---

## 1. Local Deployment

### Option A — zero-config (in-memory MongoDB, no Atlas)
```bash
git clone https://github.com/SNEKA2107/college-helpdesk-chatbot.git
cd college-helpdesk-chatbot
node backend/dev-local.js        # seeds an in-memory DB and serves on http://localhost:5000
```
Demo logins: Student `22IT101` / `student123` · Admin `ADMIN01` / `admin@123`.

### Option B — backend + frontend dev servers (hot reload)
```bash
# Terminal 1 — backend against a real DB (uses backend/.env)
cd backend && npm install && npm start          # http://localhost:5000

# Terminal 2 — frontend dev server
cd frontend && npm install && npm run dev        # http://localhost:5173 (proxies to :5000)
```

### Build the frontend for production locally
```bash
cd frontend && npm run build     # → frontend/dist
npm run preview                  # preview the production build on :4173
```

---

## 2. Prerequisites (production)
- MongoDB Atlas cluster + connection string (§4).
- A Render account with access to the GitHub repository.
- A strong `JWT_SECRET` (e.g. `openssl rand -base64 48`).
- (Optional) an Anthropic API key for full AI prose.

---

## 3. Environment Variables
Set these in the **Render dashboard** (never commit real values; `backend/.env` is git-ignored — only `.env.example` is tracked).

| Variable | Required | Purpose | Notes |
|----------|----------|---------|-------|
| `MONGO_URI` | ✅ | Atlas connection string | include the DB name, e.g. `.../campusassist` |
| `JWT_SECRET` | ✅ | Signs/verifies JWTs | long random string; rotating invalidates all sessions |
| `NODE_ENV` | ✅ | `production` | enables `morgan combined` logging |
| `FRONTEND_URL` | ✅ | CORS allow-origin | set to the deployed site URL |
| `PORT` | auto | Render injects it | `server.js` falls back to 5000 |
| `ANTHROPIC_API_KEY` | ⬜ | Full AI (chat/summariser) | **unset ⇒ graceful retrieval-only fallback** |
| `AUTH_RATE_LIMIT` | ⬜ | Max logins / 15 min / IP | default 20 |
| `RENDER_EXTERNAL_URL` | auto | Render sets it | auto-added to the CORS allowlist |
| `EMAIL_SERVICE` / `EMAIL_USER` / `EMAIL_PASS` | ⬜ | Email notifications | optional (nodemailer) |

---

## 4. MongoDB (Atlas)
1. Create a cluster. **Use M10+ (not M0 free tier) for production** so automated backups are available.
2. Create a least-privilege DB user (readWrite on the app DB only).
3. **Network access:** allow Render egress — prefer a Private Endpoint / specific IP allowlist over `0.0.0.0/0`.
4. Copy the SRV connection string → `MONGO_URI` (include the DB name).
5. Connection tuning is already in `server.js` (`tls:true`, `serverSelectionTimeoutMS:15000`, `socketTimeoutMS:45000`).

---

## 5. Render Configuration

`render.yaml` (build/start commands):
```yaml
buildCommand: cd backend && npm install --omit=dev && cd ../frontend && npm install --include=dev && npm run build
startCommand: node backend/server.js
```
- The build installs backend prod deps, then builds the React frontend into `frontend/dist`.
- At runtime `server.js` serves `frontend/dist` (SPA + fallback) and mounts the API under `/api/*`.
- **Note:** if the Render service was created from the dashboard, it may ignore `render.yaml`'s `buildCommand`; in that case the frontend build runs via the `postinstall` script in `backend/package.json` (`cd ../frontend && npm install --include=dev && npm run build`). **Do not remove that script** or deploys silently revert to the legacy static site.
- Set Render's **health check path** to `/` (expects 200).

---

## 6. Production Deployment Procedure
1. Merge the release commit to Render's tracked branch (`main`).
2. Confirm all env vars are set (§3).
3. Trigger deploy (auto on push, or "Manual Deploy" in Render).
4. Watch build logs → expect a successful Vite build and `✅ MongoDB Atlas connected successfully`.
5. Run **post-deploy verification** (§8).
6. Apply any pending migrations (§7) **after** taking a snapshot.

---

## 7. Database Migrations
Idempotent and re-runnable. **Take an Atlas snapshot first.** From `backend/`:
```bash
npm run migrate:attendance     # 0001 — dedupe attendance
npm run migrate:fees           # 0002 — backfill fee verification
node migrations/0003-notice-lifecycle.js   # 0003 — notice lifecycle
npm run migrate:timetable      # 0004 — backfill timetable status
```
Each reports how many rows it changed; a second run should report ~0.

---

## 8. Post-deploy Verification (smoke)
```bash
BASE=https://<your-service>.onrender.com
curl -s -o /dev/null -w "%{http_code}\n" $BASE/                 # 200 (SPA)
curl -s -o /dev/null -w "%{http_code}\n" $BASE/api/does-not-exist   # 404 (API alive)
TOKEN=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d '{"studentId":"22IT101","password":"student123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
curl -s -o /dev/null -w "%{http_code}\n" $BASE/api/attendance/summary -H "Authorization: Bearer $TOKEN"  # 200
```
Confirm security headers: `curl -sI $BASE/ | grep -i "content-security-policy\|strict-transport"`.

Health check reference:
| Check | Request | Healthy |
|-------|---------|---------|
| SPA up | `GET /` | 200 |
| API alive | `GET /api/<unknown>` | 404 JSON |
| Auth enforced | protected route, no token | 401 |
| DB connected | deploy log | `✅ MongoDB Atlas connected successfully` |

---

## 9. Rollback
1. **App:** Render → Deploys → select the last known-good deploy → **Rollback** (or redeploy the previous Git SHA/tag).
2. **Verify:** re-run §8 against the rolled-back build.
3. **Database:** app rollbacks do not revert data; migrations are additive/idempotent so most rollbacks need no DB action. If a migration caused the issue, restore the pre-migration snapshot (§10).
4. **Communicate:** log the rollback (`OPERATIONS_RUNBOOK.md`).

**Triggers:** failed health check, 5xx spike, DB connection failures, or a Critical/High production defect.

---

## 10. Backups
- **Preferred:** enable **Atlas Cloud Backup** on M10+ and verify a restore once.
- **Manual (any tier), before every migration/deploy:**
  ```bash
  mongodump  --uri "$MONGO_URI" --archive="campusassist-$(date +%F).gz" --gzip
  mongorestore --uri "$MONGO_URI" --archive="campusassist-YYYY-MM-DD.gz" --gzip
  ```
- Store archives off-Render with a documented retention (e.g. 30 days).

---

## 11. Mobile (Android APK)
```bash
cd frontend && npm run build     # produce dist
npx cap sync android             # sync dist → frontend/android
cd android && ./gradlew assembleDebug   # → app/build/outputs/apk/debug/app-debug.apk
```
The APK targets the production HTTPS API automatically. A **release keystore** is required before store distribution (see `ANDROID_DEPLOYMENT_GUIDE.md`).

---

## Deploy sign-off checklist
- [ ] Env vars set (§3) · [ ] Atlas backups enabled (§10) · [ ] Snapshot taken · [ ] Build green + DB connected · [ ] Migrations applied (§7) · [ ] Smoke passed (§8) · [ ] Rollback target identified (§9)
