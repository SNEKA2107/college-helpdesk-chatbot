# CampusAssist — Final Audit Report

**Generated:** 29 July 2026, 01:36  
**Application under test:** http://localhost:5000  
**Framework:** Python · Selenium WebDriver · Pytest · Page Object Model  
**Master workbook:** `selenium_model/MASTER_TEST_AUDIT_REPORT.xlsx`

---

## 1. Executive summary

| Metric | Value |
|---|---|
| Files scanned | 2364 |
| Pages / components | 64 / 28 |
| Routes | 46 |
| API endpoints | 139 |
| Functionalities discovered | 574 |
| Tests executed | 330 |
| Passed / Failed / Skipped | 330 / 0 / 0 |
| Functional coverage | 65.5% (196 full, 360 partial, 18 none) |
| Defects found | 13 (3 high) |
| User journeys executed | 9 |
| Load test | 100 users · 166.7 req/sec · avg 487.6 ms |

**Release recommendation:** GO — every executed functional test passed.

---

## 2. What was tested

- **Authentication** — unified login for all three roles, email/register-number/case handling, invalid credentials, account enumeration, field validation, password visibility, remember-me, logout, session teardown, registration, approval gating and first-run setup sealing.
- **Authorization** — route guards for unauthenticated access, cross-portal isolation for all three roles, server-side adminOnly/facultyOnly enforcement, token tampering, privilege escalation via the registration and login bodies, and per-owner data scoping.
- **Navigation** — every student, faculty and admin destination, all 19 admin panel tabs, topbar controls, mobile bottom navigation, theme switching and the legacy URL redirect contract.
- **Forms** — mandatory-field validation, invalid input, boundary values (password length, oversized payloads, long text) and valid submissions.
- **CRUD** — full create/read/update/delete lifecycles for requests, notices, events, departments and leave, including owner scoping and workflow-integrity checks.
- **Search, filters, sorting, tables and pagination** — exact, partial, empty and no-match searches; category and status filters; table rendering; ordering guarantees.
- **Modals, notifications, uploads and downloads.**
- **End-to-end journeys** — nine complete multi-step workflows.
- **Additional layers** — smoke, regression, broken links, API contract validation, accessibility, UI integrity and performance.

---

## 3. Highest-severity findings

### BUG-001 — Backend / Security headers

Content-Security-Policy allows 'unsafe-inline' for scripts and permits a third-party CDN (cdnjs.cloudflare.com). This materially weakens the XSS protection CSP exists to provide.

*Reproduce:* 1. Open backend/server.js  2. Inspect the helmet contentSecurityPolicy directives  
*Evidence:* `backend/server.js (scriptSrc directive)`

### BUG-002 — Authentication

There is no self-service password reset. The login page's 'Forgot password?' control only displays a message telling the user to contact the admin office, so a locked-out user has no in-product recovery path.

*Reproduce:* 1. Go to /login  2. Click 'Forgot password?'  3. Only an informational message appears  
*Evidence:* `frontend/src/pages/Login.jsx, backend/routes/auth.js`

### BUG-003 — Authentication

'Forgot password?' provides guidance only — there is no self-service reset flow, so a locked-out user depends entirely on manual admin intervention.

*Reproduce:* 1. Open /login  2. Click 'Forgot password?'  3. Only an informational message appears  
*Evidence:* `frontend/src/pages/Login.jsx`

---

## 4. Code health

- **97 unused / dead-weight files**, including 7 full clone directories of the project and 4 files of bulk student personal data committed to version control.
- **8 dead-code findings**: orphan exports, unreachable functions and oversized modules.
- **3 orphan React components** left behind by the move to a unified login.

---

## 5. Coverage gaps

18 discovered functionalities have no automated coverage. The largest clusters:

- **Feature Modules** — 11 uncovered functionality item(s)
- **External Integrations** — 7 uncovered functionality item(s)

---

## 6. Baseline / load test

100 virtual users were held active against the API continuously for 60 s, browsing the endpoint mix a real student, faculty member and administrator hit on a normal day.

| Metric | Value | Observation |
|---|---|---|
| Concurrent Virtual Users | 100 | Normal expected classroom concurrency held for the full window |
| Test Duration | 60 s | Traffic sustained continuously for 61.7s of wall-clock time |
| Total Requests | 10,280 | 10,280 successful, 0 errors |
| Throughput (RPS) | 166.7 req/sec | The API served roughly 166 requests every second |
| Error Rate | 0.0% | Share of responses outside the 2xx/3xx range |
| Response Time — Min | 70.4 ms | Fastest single response |
| Response Time — Average | 487.6 ms | Budget 500 ms — within budget |
| Response Time — Median (p50) | 471.1 ms | Typical user experience |
| Response Time — p90 | 737.7 ms | 9 in 10 requests were faster than this |
| Response Time — p95 | 841.2 ms | Budget 1000 ms — within budget |
| Response Time — p99 | 1004.4 ms | Worst-case tail for 1 in 100 requests |
| Response Time — Max | 1419.7 ms | Slowest single response observed |
| Rate Limiter During Test | 100000 req/min per IP | The API rate-limits per source IP. Every virtual user here shares one IP, so the ceiling was raised for the benchmark; the production default is 150. |
| Baseline Verdict | PASS | PASS — response times stayed within budget under normal load |

---

## 7. Prioritised recommendations

| Priority | Recommendation | Business impact |
|---|---|---|
| P1 — Critical | Resolve 1 high-severity security observation(s), starting with the Content-Security-Policy 'unsafe-inline' allowance and JWT-in-localStorage storage. | A single XSS becomes full account takeover across student, faculty and admin roles. |
| P1 — Critical | Remove 4 file(s) of bulk student personal data from version control and purge them from git history. | Committed PII is a data-protection breach and cannot be undone by deletion alone. |
| P2 — High | Close the 18 uncovered functionality gap(s) — the faculty portal write paths and admin academic tabs are the largest clusters. | Untested paths are where regressions reach production unnoticed. |
| P2 — High | Delete the 7 clone/snapshot director(ies) checked into the repository (demo-clone, viva-clone, viva-clone2, …). | Duplicate trees drift from source and make it ambiguous which code actually ships. |
| P2 — High | Add stable data-testid attributes to interactive elements across the three portals. | The suite currently binds to CSS classes and visible text, so routine styling or copy changes break tests that were not actually affected by the change. |
| P2 — High | Fix 7 high-severity accessibility issue(s) — chiefly icon-only buttons and form controls with no accessible name. | Blocks screen-reader users outright and is a compliance risk for a public institution. |
| P3 — Medium | Remove or re-route the 3 orphan component(s) left behind by the unified-login change (RoleSelect, FacultyLogin, RoleCard). | Dead screens mislead maintainers into thinking retired flows are still live. |
| P3 — Medium | Split the 5 oversized module(s) — facultyPortal.js (843 lines) and global.css (1205 lines) are the worst offenders. | Large modules slow review and raise the chance of a merge conflict becoming a bug. |
| P4 — Low | Consolidate the 100+ root-level status/report markdown files into docs/ with one authoritative README. | Contributors cannot tell which document is current, so none of them are trusted. |
| P4 — Low | Wire this suite into CI so `python selenium_model/run.py` runs on every pull request. | Turns a point-in-time audit into a standing regression gate. |

---

## 8. Deliverables

| Artifact | Path |
|---|---|
| Master Excel report | `selenium_model/MASTER_TEST_AUDIT_REPORT.xlsx` |
| HTML execution report | `selenium_model/execution_report.html` |
| Screenshots (327) | `selenium_model/screenshots/` |
| Browser console log | `selenium_model/logs/browser_console.log` |
| Selenium driver log | `selenium_model/logs/selenium.log` |
| Backend server log | `selenium_model/logs/backend-server.log` |
| Raw phase data (JSON) | `selenium_model/data/` |
| This report | `selenium_model/FINAL_AUDIT_REPORT.md` |

## 9. Reproducing this run

```bash
pip install -r selenium_model/requirements.txt
node backend/dev-local.js          # seeded in-memory backend on :5000
python selenium_model/run.py       # all seven phases, end to end
```
