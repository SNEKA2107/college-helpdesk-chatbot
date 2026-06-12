# CampusAssist — Independent Security Review

**Date:** 2026-06-12 · **Method:** Static + runtime (29/29 live checks passed) · **Prior reports not trusted; re-tested.**

---

## Verified Controls (independently confirmed at runtime)

| Control | Status | Evidence |
|---|---|---|
| Password hashing (bcrypt, cost 12) | ✅ | `models/User.js:25`; login never returns password (`toJSON` strips it) — runtime confirmed |
| JWT auth required on protected routes | ✅ | Unauthenticated `/api/requests` → 401; garbage token → 401 |
| RBAC (`adminOnly`) | ✅ | Student → `/api/students`, `/api/fees/all`, `/api/contact` all 403 |
| IDOR protection on student PII | ✅ | Student reading/editing another student by id → 403 |
| Privilege escalation blocked | ✅ | Student PUT `role:'admin'` on self → role stays `student` (field whitelist in `students.js:62`) |
| User data isolation | ✅ | `/api/requests` as student returns only own 3 records |
| Stored XSS prevention | ✅ | `<script>`/`onerror`/`<img>` in notice stripped by `stripHtml()` (`notices.js:21`) — confirmed |
| CSP header | ✅ | Present on responses |
| `X-Content-Type-Options: nosniff` | ✅ | Present (Helmet) |
| CORS allowlist | ✅ | `server.js:33-48` — explicit origins, not `origin:true` |
| Rate limiting | ✅ | Auth limiter 20/15min, global 150/min; `trust proxy` set (`server.js:13`) |
| Payment amount validation | ✅ | `amount > 500000` → 400 (`fees.js:42`) |
| Input length caps | ✅ | Contact subject/message, chat message, profile photo size all bounded |
| Password policy | ✅ | min 8 + letter + digit/special (`auth.js:16-20`) |
| Secrets not in git | ✅ | `.env` gitignored and **never** in history (`git log --all` empty) |
| JSON 404 for unknown API routes | ✅ | `/api/nonexistent` → 404 `{success:false}` |

---

## Remaining Findings

### [MEDIUM] FIN-01 — Students can self-record fee payments
- **File/Line:** `backend/routes/fees.js:36-63`
- **Root cause:** `POST /api/fees/payment` is gated only by `protect` (any logged-in student). It pushes an arbitrary `{amount, mode, txn}` into the student's own `fee.history`, which directly reduces `balance` and can flip status to `Paid` — with no payment gateway, no admin approval, and a client-supplied transaction id.
- **Attack path:** Student logs in → `POST /api/fees/payment {amount: 55000, mode:"Online", txn:"X"}` → fee shows fully Paid.
- **Evidence:** Runtime — `POST` with `amount:1` returned 200 and appended to history.
- **Fix:** Either (a) make this admin-only / gateway-callback-only, or (b) keep it as an explicitly-labelled demo feature. For a college project, document it as a simulated payment; for production, remove student write access.

### [MEDIUM] FIN-02 — Reference-number generator collides
- **File/Line:** `backend/models/Request.js:24-26`
- **Root cause:** `refNumber = PREFIX-YEAR-rand(100..999)` — only 900 values per (prefix, year), with a `unique:true` index. Birthday-paradox collisions become likely after a few dozen requests of the same type/year; the duplicate-key error surfaces as a 500 on `POST /api/requests`.
- **Fix:** Use a counter/sequence, timestamp, or `crypto.randomUUID()` slice; or retry on duplicate-key.

### [LOW] FIN-03 — `findByIdAndUpdate` skips schema validators on several routes
- **Files:** `notices.js:52`, `requests.js:60`, `students.js:66` (others pass `runValidators:true`).
- **Impact:** Admin (or own-profile) updates can write values that bypass enum/length validation. Admin-only or self-only, so impact is low.
- **Fix:** Add `{ runValidators: true }` consistently.

### [LOW] FIN-04 — Logout is client-side only; JWT not revocable
- **File:** `app.js:226` clears `localStorage`; token stays valid server-side for its 30-day life.
- **Impact:** Standard stateless-JWT tradeoff. A leaked token can't be invalidated before expiry.
- **Fix (optional):** Shorter expiry + refresh tokens, or a server-side denylist. Acceptable for a college project.

### [LOW] FIN-05 — Profile photo stored as base64 in the user document
- **File:** `routes/auth.js:106-121` (capped ~7 MB).
- **Impact:** Large docs; approaches MongoDB's 16 MB doc limit; bloats every `/auth/me` fetch.
- **Fix:** Move to object storage / GridFS for production. Fine for demo.

### [INFO] FIN-06 — `'unsafe-inline'` retained in CSP
- **File:** `server.js:21-22`. Required because pages use inline `<script>`/styles (no bundler). Already documented as an accepted risk; XSS surface mitigated by `stripHtml` on notices and input validation. No action needed for project scope.

### [INFO] FIN-07 — CSRF not applicable
- Auth uses bearer token from `localStorage`, **not** cookies, so classic CSRF does not apply. No action.

---

## Severity Roll-up

| Severity | Count | Items |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 2 | FIN-01, FIN-02 |
| Low | 3 | FIN-03, FIN-04, FIN-05 |
| Info | 2 | FIN-06, FIN-07 |

**Security status: STRONG.** No authentication, authorization, injection, or secrets-exposure vulnerabilities found. The two Medium items are business-logic/robustness issues, not access-control breaks.
