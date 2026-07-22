# CampusAssist v1.0 — Operations Runbook

**Build:** v1.0-rc1 · **Date:** 2026-07-22 · **Audience:** on-call operator / admin
**Environment:** Render web service (`node backend/server.js` serving `frontend/dist`) + MongoDB Atlas

---

## Roles & contacts
| Role | Responsibility |
|------|----------------|
| Pilot Operator | Daily monitoring, first-response, backups |
| Admin (CampusAssist) | User approvals, content, in-app triage |
| Engineering on-call | Code/DB incidents, rollbacks |

*(Fill in names/contact channels before pilot start.)*

---

## Daily monitoring (5–10 min, each business morning)
1. **Availability:** `GET /` → 200; `GET /api/home` (no token) → 401. (Render free tier may cold-start; first hit can be slow — see Incident I-3.)
2. **Render dashboard:** service status = Live; check CPU/memory (baseline ~145 MB RSS) and recent deploy state.
3. **Logs (last 24h):** scan Render logs for `Server error:` stack traces, repeated 5xx, or `MongoDB connection error`.
4. **Atlas:** cluster healthy; connections well under tier limit; no alerts.
5. **Auth sanity:** perform one demo login; confirm token issued.
6. **AI status:** if `ANTHROPIC_API_KEY` is set, confirm briefing/chat return AI (not fallback); if intentionally unset, confirm graceful fallback still serves.
7. Record anything abnormal in the incident log.

## Weekly maintenance
1. **Backup verification:** confirm the latest Atlas snapshot exists and is recent (see "Backup verification" below).
2. **Defect triage:** review the pilot defect log; re-prioritize; confirm no new Critical/High.
3. **Rate-limit review:** check logs for `Too many requests`/`Too many attempts` — tune `AUTH_RATE_LIMIT`/global limit if legitimate users are throttled (e.g., shared campus NAT/IP).
4. **Dependency check:** `npm audit` (backend + frontend) for new high/critical CVEs; schedule patches (no feature changes during freeze).
5. **Data hygiene:** resolve any remaining blank-`semester` students (KI-04); publish timetables for newly-onboarded cohorts (KI-03).

## Monthly maintenance
1. **Restore drill:** restore the latest snapshot into a scratch database and run the smoke test — prove backups are usable (target: SC-8).
2. **Security review:** confirm security headers still present (`curl -sI`); review audit log for anomalies; rotate `JWT_SECRET` if warranted (note: rotation logs everyone out).
3. **Certificate/URL check:** TLS valid; CORS `FRONTEND_URL` still correct.
4. **Capacity review:** trend memory/latency vs. user growth; decide on tier upgrades before scaling the pilot.
5. **Log retention:** archive/rotate logs per policy.

---

## Log locations
| Log | Where |
|-----|-------|
| HTTP access + app logs | **Render dashboard → service → Logs** (stdout/stderr). `morgan combined` in production. |
| Server errors | Same stream, prefixed `Server error:` (central Express handler) and `Home briefing AI error:` etc. |
| DB connection | Startup lines: `✅ MongoDB Atlas connected successfully` / `❌ MongoDB connection error:` |
| Rate-limit hits | Response bodies `Too many requests` / `Too many attempts` in access logs |
| Audit trail (privileged actions) | In-app **Admin → Audit Log** (`/api/audit`), stored in MongoDB `auditlogs` |
| Atlas DB metrics/slow queries | **Atlas dashboard → Metrics / Profiler** |

> Note: logs are ephemeral on Render (lost on redeploy/restart). For the pilot this is acceptable; for scale, ship logs to an external aggregator (post-pilot).

---

## Incident response

**Severity:** SEV-1 = outage / data loss · SEV-2 = major feature broken / auth failing · SEV-3 = minor/cosmetic.

**General flow:** Detect → Assess severity → Communicate → Mitigate → Verify → Log post-mortem.

| ID | Symptom | Likely cause | Action |
|----|---------|--------------|--------|
| I-1 | Site down / 5xx across the board | Bad deploy, crash, env misconfig | Check Render logs → **Rollback** to last good deploy (`DEPLOYMENT_GUIDE.md` §9); verify smoke |
| I-2 | `MongoDB connection error` / DB unreachable | Atlas down, IP/network, bad `MONGO_URI` | Verify Atlas status + network access + secret; restart service; escalate to engineering |
| I-3 | First request very slow / timeouts after idle | **Render free-tier cold start** | Expected on free tier; upgrade to always-on to eliminate (R-01). Not a code defect |
| I-4 | Users can't log in | JWT_SECRET changed, approval gate, rate limit | Confirm secret unchanged; check approvalStatus; inspect `Too many attempts`; raise `AUTH_RATE_LIMIT` if false-positive |
| I-5 | A page shows "Could not load…" | An API 4xx/5xx or missing cohort data | Reproduce with token; check logs; if data (e.g., no published timetable) → seed/publish, don't change code |
| I-6 | AI replies missing/erroring | `ANTHROPIC_API_KEY` unset/invalid/quota | App auto-falls back to templates — no outage; fix key at leisure |
| I-7 | Suspected unauthorized data access | Authz regression / token misuse | Treat as SEV-1 security: review audit log, rotate `JWT_SECRET` (logs all out), escalate |
| I-8 | 429s for legitimate users | Rate limit too tight / shared IP | Tune limits; consider per-user keying (post-pilot) |

**Escalation:** SEV-1/SEV-2 → page engineering on-call immediately; SEV-3 → next business day.

---

## Backup verification (weekly)
1. Atlas → Backup → confirm a snapshot within the expected window exists.
2. Check snapshot size is non-trivial and consistent with data growth.
3. Record the latest snapshot timestamp in the ops log.
4. Monthly: perform the **restore drill** (below) — a snapshot is only a backup once a restore has succeeded.

## Recovery procedure
**Data corruption / accidental deletion / bad migration:**
1. Declare SEV-1; stop write traffic if feasible (e.g., temporarily scale down / maintenance).
2. Identify the last good snapshot (pre-incident).
3. Restore to a **new** database/cluster first; smoke-test it (`DEPLOYMENT_GUIDE.md` §8).
4. Repoint `MONGO_URI` to the restored DB (or restore in-place if the tool/tier supports it), redeploy.
5. Verify integrity (login, dashboard, a known record); resume traffic.
6. Post-mortem: root cause, prevention, update this runbook.

**Full-service loss:** redeploy from the tagged release (`DEPLOYMENT_GUIDE.md` §5) + restore latest snapshot.

**RPO/RTO targets (pilot):** RPO ≤ 24h (daily snapshot) · RTO ≤ 4h. Tighten with continuous backup before scale-up.
