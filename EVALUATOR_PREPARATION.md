# CampusAssist — Evaluator Preparation

**For:** Defending the project against a tough/senior evaluator
**Date:** 2026-06-13

> This is the "hard questions" file. An easy evaluator asks *what* you built; a tough one
> probes *why*, *what's weak*, and *what you'd do differently*. Honesty plus a clear
> rationale beats over-claiming. Never bluff — acknowledge a gap, then show you understand
> the fix.

---

## 1. Tough Evaluator Questions (with the best professional answers)

### Q1. "Storing the JWT in localStorage is insecure — it's exposed to XSS. Why did you do that?"
**Answer:** "You're right that localStorage is readable by JavaScript, so it's only as safe
as the app is free of XSS. I made a deliberate trade-off: localStorage works identically on
web and inside the Capacitor Android WebView with no cookie/CSRF complexity, which suited a
single-developer, cross-platform project. I reduced the XSS risk with a tuned **Helmet
Content-Security-Policy** (`defaultSrc 'self'`, `objectSrc 'none'`) and server-side input
validation. The production-grade hardening — **httpOnly, Secure, SameSite cookies plus CSRF
tokens and a short-lived access token with refresh** — is on my future-work list, and I can
describe exactly how I'd implement it."

### Q2. "A 30-day token with no revocation. How do you log someone out or block a stolen token?"
**Answer:** "Logout clears the client token, but the token itself stays valid until expiry —
that's the known cost of stateless JWTs. For this project's threat model that's acceptable,
but the correct fix is **short-lived access tokens (e.g. 15 min) plus refresh tokens**, with
a server-side **denylist** or token-version field on the user so I can revoke immediately. I
already have the `isActive` flag, which blocks deactivated accounts at login; extending that
check into the `protect` middleware would let an admin kill an active session at the next
request."

### Q3. "Your AI chatbot can hallucinate. What stops it giving a student wrong information?"
**Answer:** "Three controls. First, a **constrained system prompt** that pins the real
college facts and explicitly says *do not invent student-specific data like grades or
attendance*. Second, **output limits** — 300 tokens, 2–4 sentences — so it stays terse and
on-topic, plus a 1000-character cap on input. Third, a **deterministic keyword knowledge
base** that the route falls back to, so for the common questions there's a known-correct
answer path. I'd agree it's an assistant, not an authority — for anything official it directs
students to the Requests page or the admin office."

### Q4. "Why MongoDB? This data — students, requests, fees — is clearly relational. Isn't SQL the right call?"
**Answer:** "It's a fair challenge. The data has relationships, and I model them with
`ObjectId` references and enforce structure with Mongoose schemas, enums, and unique indexes
— so I'm not giving up integrity. I chose MongoDB because the entities are **heterogeneous
and evolving** (optional parent fields, photos, free-form notices), the documents map
**directly to the JSON** my API speaks, and it's the standard store for a MERN stack, which
kept the project in one language. For heavy multi-table joins and transactions, PostgreSQL
would be the better fit — and I can articulate that trade-off, which I think matters more
than the specific choice."

### Q5. "Is this actually production-ready, or just a demo?"
**Answer:** "It's **deployment-ready and demo-ready**, and honestly close to production with
a few clearly-scoped gaps. What's real: it's live on the cloud over HTTPS, with bcrypt, JWT,
RBAC, Helmet CSP, CORS, and rate limiting; the Android app installs and runs against the live
backend with working auth and real database reads/writes. What's *not* production-grade yet:
the APK is debug-signed (needs a release keystore), there's no automated CI test gate, and
hosting is free-tier with a cold start. None are architectural problems — they're the last
mile, and I know exactly what each costs to close."

### Q6. "You used `'unsafe-inline'` in your CSP. Doesn't that defeat the purpose?"
**Answer:** "Partly, yes, and I'd flag it as the weakest point of the CSP. It's there because
the legacy static pages and some inline handlers needed it; the modern React build doesn't
rely on inline scripts the same way. The correct hardening is to **remove `unsafe-inline`
and move to nonce- or hash-based script policies**. The CSP still provides real value today —
`objectSrc 'none'`, `frameAncestors 'none'`, and a restricted `connectSrc`/`imgSrc` — but
tightening the script policy is a concrete next step I can name."

### Q7. "Walk me through exactly what happens, server-side, when a student submits a request."
**Answer:** "The request hits `/api/requests` and passes the global rate limiter, then the
`protect` middleware verifies the JWT and loads the user. The handler builds a `Request`
document tied to `req.user`'s id (so a student can't forge another's request). On save, the
model's pre-save hook calls `Counter.next('request-2026')` — an atomic
`findByIdAndUpdate` with `$inc` and `upsert` — to get a unique sequence number, formats the
`refNumber` like `BC-2026-0007`, and persists to MongoDB Atlas over TLS. The response returns
the saved request as JSON. The admin later updates its `status` through an `adminOnly` route."

### Q8. "What's your test coverage? How do you know it works?"
**Answer:** "I have **end-to-end and integration testing** rather than unit-test coverage
numbers: Selenium/Playwright scripts and Python E2E reports that drive real flows (login,
dashboard, requests, admin tabs), plus a **device-verified APK run** with screenshots and a
network-traffic audit (38 production API calls, 0 to localhost, 0 errors) recorded in
`FINAL_APK_SUMMARY.md`. I'd be honest that the gap is **automated unit tests in CI** — the
behaviour is verified, but not yet gated on every commit. Adding a Jest/Vitest suite to the
pipeline is my top engineering-hygiene improvement."

### Q9. "If 10,000 students used this at once, what breaks first?"
**Answer:** "The **free-tier single instance** — one Render dyno and the free Atlas cluster.
The app is **stateless** (JWT, no server sessions), so it scales **horizontally** cleanly:
I'd move to a paid tier, run multiple instances behind a load balancer, and scale the Atlas
cluster. The next bottlenecks would be **database indexing** (I'd add indexes on hot query
fields beyond the existing unique ones) and the **AI calls** (rate/queue them or cache common
answers). Nothing in the architecture prevents scaling — it's a hosting/tuning step."

### Q10. "Why should this exist? Couldn't a Google Form and a WhatsApp group do the same?"
**Answer:** "A form collects a request but gives the student **no reference number, no status,
and no single place to also check exams, fees, attendance, and notices** — and gives staff no
structured, role-secured dashboard. CampusAssist unifies all of that with **tracked requests,
an AI assistant, and an admin workflow**, on both web and Android, behind real
authentication. The value is the *integration and accountability*, not any single form."

---

## 2. Known Weaknesses (own them before they're found)

| # | Weakness | Honest framing | Mitigation / fix |
|---|---|---|---|
| 1 | **Debug-signed APK** | Fine for demo/sideload, not for the Play Store | Build release variant + keystore (`ANDROID_DEPLOYMENT_GUIDE.md`) |
| 2 | **JWT in localStorage** | XSS-exposed; mitigated by CSP | httpOnly+SameSite cookies + CSRF; short access token + refresh |
| 3 | **No token revocation** | 30-day token valid until expiry | Refresh tokens + denylist / token-version; check `isActive` in `protect` |
| 4 | **`'unsafe-inline'` in CSP** | Weakens script policy | Move to nonce/hash-based CSP; drop legacy inline handlers |
| 5 | **No automated CI tests** | Verified by E2E + device runs, not unit tests in CI | Add Jest/Vitest + GitHub Actions gate |
| 6 | **Free-tier cold start** | ~20–30 s first request after idle | Paid always-on tier or a keep-warm ping |
| 7 | **Chatbot can hallucinate** | Constrained + fallback, but not authoritative | Retrieval over real data; stricter guardrails |
| 8 | **Legacy static files in repo** | Old HTML/JS pages still present | Remove or archive them; React build is the live frontend |
| 9 | **Single region/instance** | No redundancy on free tier | Multi-instance + managed scaling when needed |
| 10 | **No automated DB backups configured by us** | Relies on Atlas defaults | Enable scheduled backups + a restore drill |

---

## 3. Future Improvements (what "version 2" looks like)

1. **Release-signed APK** on the Google Play Store with proper versioning.
2. **Refresh-token auth** with short-lived access tokens and server-side revocation.
3. **Push notifications** for request status, notices, and deadlines.
4. **Online fee payment** via a UPI/payment gateway.
5. **File handling** — attach medical certificates to leave; download certificates as PDFs.
6. **Email/SMS** notifications (nodemailer already integrated) and OTP password reset.
7. **Automated CI/CD** with unit + integration tests gating every deploy.
8. **Admin analytics** — request volumes, turnaround times, attendance trends.
9. **Hardened CSP** (nonce-based) and **always-on hosting** with a CDN.
10. **Internationalisation** for regional languages.

---

## 4. How to Defend Your Design Decisions

A repeatable structure for any "why did you…?" question — **Claim → Reason → Trade-off → Future**:

1. **State the decision plainly.** "I stored the token in localStorage."
2. **Give the reason it fit *this* project.** "It works identically on web and the Android
   WebView with no cookie/CSRF plumbing — right for a solo, cross-platform build."
3. **Acknowledge the trade-off honestly.** "The cost is XSS exposure, which I reduced with a
   Helmet CSP and input validation."
4. **Show you know the better path.** "At production scale I'd switch to httpOnly cookies
   with CSRF and short-lived tokens."

**Principles to repeat:**
- **Scope-appropriate engineering.** Justify choices against the project's real constraints
  (one developer, free hosting, a demo deadline), not against an imaginary FAANG system.
- **Defence in depth over silver bullets.** No single control is perfect; point to the
  *stack* — bcrypt + JWT + RBAC + Helmet + CORS + rate limiting + TLS.
- **Honesty is a strength.** Naming a weakness *and its fix* signals engineering maturity;
  evaluators reward it more than a flawless-sounding claim they can puncture.
- **Tie back to the problem.** Every feature exists to solve "students can't get or track
  helpdesk services in one place." Keep returning there.

---

## 5. One-Line Rebuttals (keep these in your back pocket)

- *"It's just CRUD."* → "CRUD plus an AI chatbot, role-based admin workflows, atomic
  reference numbering, and a native Android build — all deployed live and secured in depth."
- *"Anyone can clone a template."* → "I can explain every layer — the auth middleware, the
  atomic counter, the CSP, the Capacitor API resolver — because I built and debugged them."
- *"The AI is just an API call."* → "It's an API call *with* a constrained prompt, output
  limits, and a deterministic fallback so it degrades gracefully — that's the engineering."
- *"Why not React Native / Flutter for mobile?"* → "Capacitor reuses my exact web build, so
  one codebase ships to web and Android — less to maintain and no UI rewrite."
