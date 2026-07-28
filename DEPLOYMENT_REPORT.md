# CampusAssist — Deployment Report

**Prepared:** 29 July 2026
**Objective:** Deploy CampusAssist to production with no paid service and no payment card.
**Status:** Code and configuration are deploy-ready. **Deployment itself is not yet executed** — it requires an authenticated session that this environment does not have. Section 8 is the exact click-path.

---

## 1. Hosting provider selected

**Vercel — a second project in the same GitHub repository, with root directory `backend`.**

Your frontend already runs on Vercel on a card-free account. Adding the backend as a second project means **no new signup, no card, no identity check**. Vercel [officially supports Express](https://vercel.com/docs/frameworks/backend/express) (docs last updated 2026-07-06): the app becomes a single Vercel Function.

### Why not the others

Every alternative you listed was checked against its current (July 2026) policy:

| Provider | Current status | Verdict |
|---|---|---|
| **Render** | Free tier still exists and its docs say a card is optional — but you hit payment verification in practice, so it is out per your instruction | ❌ blocked for you |
| **Railway** | Free tier removed 2023. Prepaid-credit option removed early 2026, so a post-paid card is now mandatory | ❌ card required |
| **Fly.io** | Free tier removed 2024. Trial is 2 VM-hours / 7 days; cannot deploy or attach volumes without a card | ❌ card required |
| **Koyeb** | Acquired by Mistral AI, Feb 2026. New users can no longer sign up for Starter; entry point is Pro at $29/mo | ❌ no longer free |
| **Northflank** | Free tier exists (2 services, 1 database), but card requirement is reported inconsistently — an unnecessary gamble | ⚠️ fallback only |
| **Oracle Cloud Always Free** | Genuinely free compute, but requires a card for identity verification at signup | ❌ card required |
| **Cyclic, Deta** | Both shut down | ❌ gone |

**Fallback order if Vercel disappoints:** Northflank → Clever Cloud. Section 9 covers the one scenario where you would actually need to switch.

---

## 2. Architecture after deployment

```
Browser
   │
   ├──► https://<frontend>.vercel.app        Vercel project #1  (React + Vite, static)
   │            │
   │            └── fetch(VITE_API_URL) ──┐
   │                                      ▼
   └──────────► https://<backend>.vercel.app/api   Vercel project #2  (Express, serverless)
                                          │
                                          ▼
                                  MongoDB Atlas (free M0)
```

Both projects build from the same GitHub repo, distinguished only by **Root Directory** (`frontend` vs `backend`).

---

## 3. Root cause of "Cannot connect to server"

Not a bug — missing configuration. `frontend/src/services/api.js` resolves its API base like this:

```js
if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;   // line 6
…
return '/api';                                                            // line 18 — fallback
```

On Vercel your hostname is not `localhost`, so it falls through to the relative path `/api`. That resolves against the **frontend's own** host, where no API exists, so every call 404s and the UI reports the connection error.

**Fix:** set `VITE_API_URL` on the frontend project (step 6 below). The code already supports it — no source change needed.

---

## 4. Deployment issues found and fixed

All changes are deployment plumbing. **No business logic was modified.**

| # | Issue | Consequence if unfixed | Fix |
|---|---|---|---|
| 1 | `process.exit(1)` on missing env / DB failure (`server.js`) | Serverless has no process to restart — you get an opaque `FUNCTION_INVOCATION_FAILED` with nothing in the log | Exit only when running as a real server; serverless stays alive so `/api/health` can report the cause |
| 2 | `mongoose.connect()` at module load, uncached | Every cold start opens a new pool → Atlas connection cap exhausted → intermittent failures under load | Connection promise cached on `globalThis`; concurrent cold requests await one in-flight connect; failed promise cleared so the next request retries |
| 3 | CORS allow-list had no Vercel origin | Browser blocks every response — the exact error you are seeing | Added `FRONTEND_URL`, `VERCEL_URL`, `EXTRA_ORIGINS`, and opt-in `*.vercel.app` preview support |
| 4 | `express.static` + `sendFile` SPA fallback | Vercel ignores `express.static`; `frontend/dist` is absent from the backend bundle, so the fallback throws on every unmatched route | Static serving and SPA fallback now activate only when not serverless **and** `dist/` exists; otherwise a clear API-only JSON 404 |
| 5 | `postinstall` unconditionally built the frontend | Backend deploy wastes minutes building a `dist/` it never serves, and fails outright if frontend devDependencies fail to install | `backend/scripts/postinstall.js` skips on Vercel / `SKIP_FRONTEND_BUILD=1` / missing frontend |
| 6 | No health endpoint | A failed deploy is undiagnosable from outside | `GET /api/health` reports DB state, missing env vars, and uptime; returns 503 when degraded |
| 7 | `app.listen()` unconditional, app not exported | Serverless platforms import the app rather than binding a port | Exports `module.exports = app`; listens only when not serverless |

### Already correct — verified, not changed

- `PORT` binding: `process.env.PORT || 5000` ✓
- `app.set('trust proxy', 1)` ✓ — required for correct client IPs behind a proxy
- Helmet security headers ✓
- JWT verification middleware ✓
- Env validation at boot ✓
- No `setInterval`, WebSockets, or disk writes in request paths — the app is serverless-compatible as written. The only `fs` writes live in `export-students.js`, a standalone script that never runs on the server.

---

## 5. Environment variables

### Backend project (Vercel → Settings → Environment Variables)

| Variable | Value | Required |
|---|---|---|
| `MONGO_URI` | Your Atlas connection string | ✅ |
| `JWT_SECRET` | Long random string | ✅ |
| `FRONTEND_URL` | `https://<your-frontend>.vercel.app` — no trailing slash | ✅ |
| `NODE_ENV` | `production` | ✅ |
| `ALLOW_VERCEL_PREVIEWS` | `1` — only if you want preview builds to reach the API | ➖ |
| `EXTRA_ORIGINS` | Comma-separated extra origins (custom domain) | ➖ |
| `ANTHROPIC_API_KEY` | Enables the full AI Copilot; without it the keyword/knowledge-base fallback is used | ➖ |
| `EMAIL_USER` / `EMAIL_PASS` | Notification emails; skipped silently if unset | ➖ |

Do **not** set `PORT` — Vercel manages it.

### Frontend project

| Variable | Value | Required |
|---|---|---|
| `VITE_API_URL` | `https://<your-backend>.vercel.app/api` | ✅ |

Vite inlines `VITE_*` at **build** time. Changing it requires a **redeploy**, not just a restart.

---

## 6. ⚠️ Security action required before deploying

Your `backend/.env` was displayed during this session, exposing:

- **Atlas password** for user `snekasm07_db_user`
- **`JWT_SECRET`**

`.env` is correctly gitignored and was **never committed** (verified via `git log --all`), so this is not in your repository. But it is in a chat log.

**Before going live:**
1. Atlas → Database Access → edit `snekasm07_db_user` → **Autogenerate a new password**
2. Generate a fresh `JWT_SECRET` (rotating it logs everyone out — do it now, not after launch)
3. Set both as environment variables in Vercel — never in a committed file

---

## 7. Atlas network access — the step that silently breaks deploys

Vercel functions have **dynamic outbound IPs**. If your Atlas cluster still allow-lists only your home IP, the backend deploys successfully and then fails every request with a connection timeout that looks like a code bug.

**Atlas → Network Access → Add IP Address → Allow access from anywhere (`0.0.0.0/0`).**

Your database stays protected by credentials and TLS. On a free M0 cluster this is the standard configuration.

---

## 8. Deployment steps

No CLI and no card. All of this is dashboard clicks.

**1. Commit and push**
```bash
git add backend/ frontend/.env.example DEPLOYMENT_REPORT.md
git commit -m "chore(deploy): make backend serverless-ready for Vercel"
git push origin feat/unified-login
```

**2. Rotate the Atlas password and JWT secret** (section 6)

**3. Open Atlas network access to `0.0.0.0/0`** (section 7)

**4. Create the backend project**
- vercel.com → **Add New → Project** → import `SNEKA2107/college-helpdesk-chatbot`
- **Root Directory: `backend`** ← the critical setting
- Framework Preset: **Express** (or Other — `vercel.json` handles it)
- Add the environment variables from section 5. `FRONTEND_URL` is your existing frontend URL.
- **Deploy**

**5. Verify the backend before touching the frontend**
```bash
curl https://<your-backend>.vercel.app/api/health
```
Expect `"status":"ok"` and `"database":"connected"`. If `database` is not `connected`, it is section 7.

**6. Point the frontend at the backend**
- Frontend project → Settings → Environment Variables
- `VITE_API_URL` = `https://<your-backend>.vercel.app/api`
- **Deployments → ⋯ → Redeploy** (required — Vite inlines env vars at build time)

**7. Run the smoke test**
```bash
FRONTEND_ORIGIN=https://<your-frontend>.vercel.app \
  node backend/scripts/smoke-production.js https://<your-backend>.vercel.app
```

---

## 9. Production checklist

The smoke test covers all 37 checks below. It passes **37/37 against localhost** — run it against production to fill in the right-hand column.

| # | Check | Local | Production |
|---|---|---|---|
| 1 | Health endpoint reachable | ✅ | ⬜ |
| 2 | Database connected | ✅ | ⬜ |
| 3 | Required env vars set | ✅ | ⬜ |
| 4 | Public endpoint responds | ✅ | ⬜ |
| 5 | Frontend origin allowed by CORS | ✅ | ⬜ |
| 6 | Unknown origin rejected | ✅ | ⬜ |
| 7–9 | Login — student / admin / faculty | ✅ | ⬜ |
| 10 | Invalid password rejected | ✅ | ⬜ |
| 11 | Protected route blocks anonymous | ✅ | ⬜ |
| 12 | Tampered JWT rejected | ✅ | ⬜ |
| 13 | Valid JWT accepted | ✅ | ⬜ |
| 14–17 | RBAC — student refused admin + faculty areas | ✅ | ⬜ |
| 18–37 | Modules — dashboards, attendance, timetable, library, notices, leave, requests, fees, exam, marks, events, calendar, AI chat, departments, admin audit/analytics, faculty portal | ✅ | ⬜ |

Manual browser checks after the smoke test passes:
- ⬜ Register a new student → appears as pending for admin approval
- ⬜ AI Chat returns a response (see the timeout caveat in section 10)
- ⬜ Protected routes bounce to `/login` when signed out
- ⬜ Browser console clean of CORS/CSP errors

---

## 10. Known issues and limitations

**1. AI Chat may time out on the free plan — the one real risk.**
Vercel Hobby functions cap at 60s (`vercel.json` sets `maxDuration: 60`). Anthropic calls for long answers can approach that. CRUD endpoints respond in 2–120ms and are unaffected. If chat times out, either shorten `max_tokens` in the chat route or leave `ANTHROPIC_API_KEY` unset to use the keyword/knowledge-base fallback, which is instant.

**2. Rate limiting is weaker than on a single server.**
`express-rate-limit` uses an in-memory store, which is per-instance. Serverless runs many instances, so the effective ceiling is higher than the configured 150/min. Real protection would need a shared store (Upstash Redis has a free tier). Acceptable for a college project; note it if this ever handles real student data.

**3. Cold starts.**
First request after idle takes ~1–3s. Subsequent requests are fast.

**4. No WebSocket support.**
Not currently used — the chat is REST-based, so nothing breaks. It would block a future live-notifications feature.

**5. Atlas M0 storage is 512 MB.**
Leave documents are stored base64-encoded in MongoDB. Heavy upload use will hit this ceiling.

**6. `PROD_API` fallback in `frontend/src/services/api.js:3`** still points at the old Render URL. `VITE_API_URL` overrides it for web builds, so it is harmless there — but **Capacitor APK builds use it directly**. Update it before your next APK build.

**7. Hobby plan is non-commercial.** Fine for academic use; a deployed college service charging fees would need review.

---

## 11. Files created and modified

**Created**
| File | Purpose |
|---|---|
| `backend/vercel.json` | Vercel function config (60s max duration) |
| `backend/scripts/postinstall.js` | Guarded frontend build |
| `backend/scripts/smoke-production.js` | 37-check production verification, zero dependencies |
| `frontend/.env.example` | Documents `VITE_API_URL` |
| `DEPLOYMENT_REPORT.md` | This report |

**Modified**
| File | Change |
|---|---|
| `backend/server.js` | Serverless detection, cached Mongo connection, CORS origins, health endpoint, conditional static serving, app export |
| `backend/package.json` | `postinstall` now calls the guarded script |
| `backend/.env.example` | Documents the new deployment variables |

**Not modified:** every route, model, service, middleware and React component. No business logic changed.

---

## 12. Final status

| Item | Status |
|---|---|
| Provider selected and policy-verified | ✅ Vercel — card-free, account already active |
| Backend made serverless-safe | ✅ 7 issues found and fixed |
| Deployment configs generated | ✅ |
| Local verification | ✅ 37/37 smoke checks; SPA serving preserved |
| Credentials rotated | ⬜ **You must do this** (section 6) |
| Atlas network access opened | ⬜ **You must do this** (section 7) |
| Backend deployed | ⬜ Needs your Vercel session |
| Frontend `VITE_API_URL` set + redeployed | ⬜ Needs your Vercel session |
| Production smoke test | ⬜ Run after deploy |

**Blocking factor:** deployment requires an authenticated Vercel session. Everything that could be prepared without one is done and verified locally.
