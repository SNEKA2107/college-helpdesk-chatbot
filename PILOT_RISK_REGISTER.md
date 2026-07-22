# CampusAssist v1.0 — Pilot Risk Register

**Build:** v1.0-rc1 · **Date:** 2026-07-22 · **Owner:** Product Owner

Scoring: **Probability** and **Impact** each Low / Medium / High. **Exposure** = combined priority.
Owners: **Ops** (operator), **Eng** (engineering on-call), **Prod** (product owner), **Admin** (CampusAssist admin).

---

| ID | Risk | Prob. | Impact | Exposure | Mitigation | Owner | Status |
|----|------|-------|--------|----------|------------|-------|--------|
| **R-01** | **Render free-tier cold starts** after 15 min idle → slow first request/timeouts; shared CPU limits concurrency | High | Medium | 🔴 High | Fine for 20 users. **Upgrade to a paid always-on instance before a 100-user pilot.** Document expected cold-start in comms | Ops | Open — accepted for 20-user pilot |
| **R-02** | **MongoDB Atlas backups** may be absent (M0 free tier has none) → data-loss risk | Med | High | 🔴 High | Enable Atlas Cloud Backup (M10+) **before go-live**; manual `mongodump` before every migration; monthly restore drill | Ops | Open — **must close before go-live** (KI-01) |
| **R-03** | **No dedicated Faculty login role** (roles are student/admin only) → faculty use admin accounts | High | Medium | 🟠 Med | Provision individual admin accounts per staff member; document the convention; add a scoped faculty role post-pilot | Prod / Eng | Open — accepted with workaround |
| **R-04** | **`ANTHROPIC_API_KEY` unset** → AI briefing/chat degrade to templates | Med | Low | 🟢 Low | Graceful fallback already built (no outage). Set key in dashboard to enable full AI | Ops | Mitigated by design (KI-02) |
| **R-05** | **Bulk-attendance N+1** slows large rosters | Low | Med | 🟢 Low | Admin-only, correct/idempotent; acceptable at pilot class sizes. Batch with `$in`+`bulkWrite` post-pilot | Eng | Open — backlog (KI-05) |
| **R-06** | **Ephemeral Render logs** (lost on restart/redeploy) → hard to investigate past incidents | High | Low | 🟢 Low | Capture key events to Atlas (audit log already persists); ship logs to an aggregator before scale-up | Ops | Open — accepted for pilot |
| **R-07** | **Weak attribution** for faculty actions performed via shared/impersonal admin accounts | Med | Med | 🟠 Med | One admin account per staff member (no sharing); rely on audit log; enforce least-necessary access | Admin | Open |
| **R-08** | **Expectation gap:** no standalone "Department management" or "Reports/BI" modules — these are user/content attributes + CSV/SQL exports | Med | Low | 🟢 Low | Set stakeholder expectations in onboarding; use exports for reporting; evaluate a reporting module post-pilot | Prod | Open — documented (UAT A02/A06) |
| **R-09** | **Cohort data gaps** (blank semesters, unpublished timetables) → empty/"not published" views | Med | Med | 🟠 Med | Pre-pilot data prep: normalize student cohorts; publish timetables per active cohort; verify per user before onboarding | Admin | Open — pre-pilot task (KI-03/04) |
| **R-10** | **Rate-limit false positives** on shared campus NAT/IP (global 150 req/min & auth 20/15min are per-IP) | Med | Med | 🟠 Med | Monitor 429/`Too many` logs; raise limits or move to per-user keying if legitimate users are throttled | Ops / Eng | Open — monitor |
| **R-11** | **Single instance = single point of failure**; no horizontal scaling/HA | Low (pilot) | High | 🟠 Med | Acceptable for a time-boxed pilot with rollback + backups; add redundancy/HA before university-wide | Eng | Open — accepted for pilot |
| **R-12** | **Thin automated integration tests** (9 tests, model/logic-level) → regressions could slip | Med | Med | 🟠 Med | Manual UAT + smoke gate each deploy during freeze; add supertest route suite post-pilot | Eng | Open — backlog (KI-07) |
| **R-13** | **Secret management / JWT rotation** — rotating `JWT_SECRET` logs everyone out; secrets only in dashboard | Low | High | 🟠 Med | Secrets are dashboard-only (verified not in repo). Rotate on a maintenance window; communicate forced re-login | Ops | Mitigated |
| **R-14** | **Student PII in a real pilot** → privacy/consent/compliance obligations | Med | High | 🔴 High | Obtain participant consent; limit data to what's needed; restrict admin access; define retention & deletion; ensure TLS (present) | Prod / Admin | **Open — confirm before onboarding real users** |
| **R-15** | **Concurrent-usage spikes** (e.g., everyone checks attendance at 9am) on free tier | Med | Med | 🟠 Med | 20 users within measured headroom; watch latency; upgrade tier before larger cohorts | Ops | Open — monitor |

---

## Risk posture summary
- **Must close before onboarding real users:** R-02 (backups), R-14 (privacy/consent).
- **Accepted for the 20-user pilot with monitoring:** R-01, R-03, R-06, R-09, R-10, R-11, R-15.
- **Backlog (post-pilot, non-blocking):** R-05, R-08, R-12; enable full AI (R-04) at will.
- No **code-level** blocker remains (Critical/High bugs fixed in RC — see `BUG_TRACKER.md`). The dominant residual risks are **operational and infrastructural**, not application defects.
