# CampusAssist v1.0 — Deployment Checklist

**Version:** 1.0.0 · **Target:** Render web service + MongoDB Atlas
**Companion docs:** `DEPLOYMENT_GUIDE.md` (detailed steps), `OPERATIONS_RUNBOOK.md`, `KNOWN_ISSUES.md`

Work top-to-bottom. Do not proceed past a failed gate.

---

## Pre-flight
- [ ] Release branch merged/selected as the Render-tracked branch (e.g. `main` after merging `release/v1.0-rc1`).
- [ ] `git status` clean on the release branch (no uncommitted app changes).
- [ ] Working tree free of merge-conflict markers.
- [ ] `CHANGELOG.md` and `RELEASE_NOTES_v1.0.md` finalized for 1.0.0.

## 1. Git tag
- [ ] Tag the release commit:
  ```bash
  git tag -a v1.0.0 -m "CampusAssist v1.0.0"
  git push origin v1.0.0
  ```
- [ ] Confirm the tag points at the intended commit (`git show v1.0.0 --stat`).

## 2. Production build
- [ ] Backend deps install clean: `cd backend && npm install --omit=dev`.
- [ ] Frontend builds clean: `cd frontend && npm run build` → `dist/` produced, **no sourcemaps**, no errors.
- [ ] Test suite green: `cd backend && npm test` → **9/9 passing**.
- [ ] (Render performs the same via `render.yaml` `buildCommand`.)

## 3. Database backup
- [ ] **Enable Atlas automated backups** (M10+) — required before go-live (KI-01).
- [ ] Take a manual pre-deploy snapshot:
  ```bash
  mongodump --uri "$MONGO_URI" --archive="campusassist-pre-v1.0.gz" --gzip
  ```
- [ ] Store the snapshot off-Render; record its timestamp in the ops log.

## 4. Environment variables (Render dashboard — never committed)
- [ ] `MONGO_URI` (Atlas SRV string, includes DB name)
- [ ] `JWT_SECRET` (strong random; rotating logs everyone out)
- [ ] `NODE_ENV=production`
- [ ] `FRONTEND_URL` (deployed site URL, for CORS)
- [ ] *(optional)* `ANTHROPIC_API_KEY` — enables full AI (else graceful fallback)
- [ ] *(optional)* `AUTH_RATE_LIMIT` (default 20); `RENDER_EXTERNAL_URL` auto-set by Render
- [ ] Confirm `backend/.env` is **not** committed (it is git-ignored).

## 5. Database migrations (after snapshot)
Run against the target DB from `backend/` (all idempotent — a second run reports ~0 changes):
- [ ] `npm run migrate:attendance`
- [ ] `npm run migrate:fees`
- [ ] `node migrations/0003-notice-lifecycle.js`
- [ ] `npm run migrate:timetable`

## 6. Deploy
- [ ] Trigger the Render deploy (auto on push, or Manual Deploy).
- [ ] Watch build logs for a successful Vite build and `✅ MongoDB Atlas connected successfully`.

## 7. Post-deployment verification
Replace `$BASE` with the live URL:
- [ ] `curl -s -o /dev/null -w "%{http_code}" $BASE/` → **200** (SPA)
- [ ] `curl -s -o /dev/null -w "%{http_code}" $BASE/api/home` → **401** (auth enforced)
- [ ] `curl -s -o /dev/null -w "%{http_code}" $BASE/api/nope` → **404** (API alive)
- [ ] Student login → lands on `/student/dashboard`; admin login → `/admin/dashboard`.
- [ ] Student hitting `/admin/dashboard` is redirected out; `GET /api/students` as a student → **403**.
- [ ] Security headers present: `curl -sI $BASE/ | grep -i "content-security-policy\|strict-transport"`.
- [ ] Spot-check: Home/Timetable/Placement load with data; a notice publishes and is visible to a student.
- [ ] No console errors on the student dashboard (browser devtools).

## 8. Rollback steps (if any gate fails post-deploy)
- [ ] **App:** Render → Deploys → select last known-good deploy → **Rollback** (or redeploy prior Git SHA / `v0.x` tag). Re-run §7 smoke.
- [ ] **Database:** app rollback does **not** revert data. If a migration caused the issue, restore the pre-deploy snapshot (§3) into a new DB, smoke-test, then repoint `MONGO_URI`. (Migrations are additive/idempotent — most rollbacks need no DB action.)
- [ ] **Communicate:** record the rollback + root cause in the incident log (`OPERATIONS_RUNBOOK.md`).

## Sign-off
- [ ] All gates above checked · [ ] Release owner: ____________ · [ ] Date/time: ____________
