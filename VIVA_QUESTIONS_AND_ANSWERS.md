# CampusAssist — Viva Questions & Answers

**For:** Final project viva voce
**Date:** 2026-06-13
**Scope:** 30 likely questions with detailed answers, grounded in the actual codebase.

> Tip: answers are written the way you'd *say* them. Read for understanding, then explain
> in your own words. Where a fact is specific (a version, a config), it's real — say it
> with confidence.

---

## A. React (Frontend)

**Q1. What is React and why did you use it for this project?**
React is a JavaScript library for building user interfaces from reusable **components**. I
used it because CampusAssist has many screens that share UI (dashboard, requests, chat,
admin tabs), and React's component model lets me reuse pieces like `Layout`, `Sidebar`,
`Modal`, and `BottomNav` instead of duplicating HTML. Its **virtual DOM** updates only what
changes, which keeps the UI fast, and its huge ecosystem (React Router, Vite) made
development quick. I'm on **React 18.3**.

**Q2. How does routing work in your app?**
I use **React Router DOM 6**. Routes are declared in `src/routes/AppRoutes.jsx`, and I
protect them with **route guards** (`src/routes/guards.jsx`): a guard checks whether a token
exists (and for admin pages, whether the role is admin) before rendering, otherwise it
redirects to `/login`. Because it's a single-page app, navigation happens client-side
without full page reloads, and the backend has an **SPA fallback** so deep links still work.

**Q3. How do you manage state and talk to the backend?**
Component state uses React **hooks** (`useState`, `useEffect`) and a few custom hooks
(`useTheme`, `useToast`, `usePageAnimations`, `useUnreadNotices`). All server communication
goes through a single helper, `src/services/api.js` — `apiCall()` — which attaches the JWT,
handles JSON, and centralises 401 handling (it clears the session and redirects to login).
Session helpers live in `src/services/auth.js`.

**Q4. What is Vite and why not Create React App?**
Vite is the build tool and dev server. It uses native ES modules for near-instant startup
and fast hot-reload during development, and it bundles an optimised production build with
Rollup. I chose it over Create React App because CRA is effectively deprecated and slower;
Vite is the current standard, and it also outputs the `dist/` folder that both Render and
Capacitor consume.

---

## B. Node.js & Express (Backend)

**Q5. What is Node.js and why use it on the server?**
Node.js is a JavaScript runtime built on Chrome's V8 engine that runs JS outside the
browser. I used it so the **whole stack is one language** — I write JavaScript on the
frontend and backend, share mental models, and even reuse the API-resolver logic on web and
Android. Node's non-blocking, event-driven I/O is a great fit for an API that's mostly
waiting on the database and an external AI call.

**Q6. What is Express and what does it do in your project?**
Express is a minimal web framework for Node. In `backend/server.js` it wires up the whole
request pipeline: security headers (Helmet), CORS, rate limiters, JSON parsing, then the 13
route groups under `/api/*`, static serving of the React build, an API 404 handler, the SPA
fallback, and a global error handler. Each resource (auth, requests, chat, …) is its own
router module in `backend/routes/`.

**Q7. Explain middleware with an example from your code.**
Middleware are functions that run in order on each request and can either pass control on
(`next()`) or end the response. My clearest example is `protect` in
`backend/middleware/auth.js`: it reads the `Authorization: Bearer` header, verifies the JWT,
loads the user onto `req.user`, and calls `next()` — or returns 401 if the token is missing
or invalid. `adminOnly` is a second middleware that checks the role. Helmet, CORS, and the
rate limiters are also middleware.

**Q8. How is your backend code organised?**
By responsibility: `models/` (Mongoose schemas), `routes/` (one router per resource),
`middleware/` (auth/authorization), `utils/` (email), and `server.js` as the composition
root. This separation makes each file small and testable, and adding a feature usually means
adding one model + one router.

---

## C. MongoDB & Database Design

**Q9. Why MongoDB and not a SQL database like MySQL?**
CampusAssist's entities vary in shape — a user has optional parent fields and a photo, a
request has a lifecycle, notices are free-form. MongoDB's **document model** stores these
flexibly without rigid migrations, and it maps directly to the JSON my API already speaks.
With **Mongoose** I still get schema validation, enums, and relationships, so I get
structure *and* flexibility. It's also the standard "M" in the MERN stack I built on.

**Q10. What is Mongoose and what does it give you?**
Mongoose is an ODM (Object Data Modeling) library. It lets me define **schemas** with types,
required fields, enums, defaults, unique indexes, and `timestamps`, and it gives model
methods and hooks. For example, `User` has a `pre('save')` hook that bcrypt-hashes the
password, an instance method `matchPassword`, and a `toJSON` that strips the password — all
defined on the schema.

**Q11. Walk me through your database design.**
There are 13 collections. `User` holds students and admins (unique `studentId` and `email`,
hashed password, a `role` enum, and an `isActive` flag). `Request` references a `User` and
carries a type/urgency/status and a unique `refNumber`. `Counter` is a small collection that
generates those reference numbers atomically. The rest — `Leave`, `Notice`, `Exam`, `Fee`,
`Book`, `BorrowedBook`, `Attendance`, `Event`, `Timetable`, `Contact` — each back one module.
I use `ObjectId` references to relate documents (e.g. a request to its student).

**Q12. How do you generate the request reference numbers, and why that way?**
With an **atomic counter**. `Counter.next('request-2026')` runs
`findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true, upsert: true })`, which the
database performs atomically, so even concurrent requests get unique, sequential numbers. In
`Request`'s pre-save hook I format it as `PREFIX-YEAR-0001` (e.g. `BC-2026-0007`). I chose
this over random IDs because it's human-readable, ordered, and guaranteed collision-free.

---

## D. Authentication & Authorization

**Q13. Explain your authentication flow end to end.**
On register/login the server validates input, verifies or hashes the password with bcrypt,
and issues a **JWT** signed with `JWT_SECRET` containing the user id, with a 30-day expiry.
The client stores the token in `localStorage` and sends it as `Authorization: Bearer <token>`
on every request. The `protect` middleware verifies the signature, loads the user, and
attaches it to the request. On logout — or any 401 — the client clears the token and
redirects to login.

**Q14. What is JWT and why did you choose it over sessions?**
A JWT (JSON Web Token) is a signed, self-contained token with three parts — header, payload,
signature. I chose it because it's **stateless**: the server doesn't store sessions, it just
verifies the signature, which scales well and works cleanly across web *and* the Android app
(no cookies needed). The signature (HMAC with my secret) means the token can't be tampered
with without detection.

**Q15. What's the difference between authentication and authorization in your app?**
**Authentication** is proving *who you are* — that's the `protect` middleware verifying the
JWT. **Authorization** is what you're *allowed to do* — that's `adminOnly`, which checks
`req.user.role === 'admin'` before letting a request reach an admin-only handler. A logged-in
student is authenticated but not authorized for admin routes, so they get a **403**.

**Q16. How are passwords stored? Could you recover a user's password?**
Passwords are hashed with **bcrypt** at cost factor 12 before saving (in the User model's
pre-save hook) and are never stored or returned in plaintext — `toJSON` deletes the field.
No, I **cannot recover** a password; bcrypt is a one-way hash. On login I hash the attempt
and compare with `bcrypt.compare`. A reset flow would issue a new password, not reveal the old.

**Q17. Where is the JWT stored on the client, and what are the trade-offs?**
In `localStorage` (`ca_token`). The trade-off: localStorage is simple and works identically
on web and in the Capacitor WebView, but it's readable by JavaScript, so it's vulnerable to
XSS if the app had an injection flaw. I mitigate that with a strict **Content-Security-Policy
via Helmet** and input validation. A hardened alternative would be httpOnly cookies plus
CSRF protection; for this project's scope, token-in-localStorage with CSP is a reasonable
balance, and I note it as a future improvement.

---

## E. REST APIs

**Q18. What makes your API RESTful?**
It's organised around **resources** (`/api/requests`, `/api/leave`, `/api/notices`, …), uses
**HTTP verbs** for actions (GET to read, POST to create, PUT to update), returns **JSON**
with appropriate **status codes** (200, 201, 400, 401, 403, 404, 409, 500), and is
**stateless** — each request carries its own JWT and nothing is kept server-side between
calls.

**Q19. Give an example of good status-code use in your code.**
In the auth route: registering a duplicate returns **409 Conflict**; invalid login returns
**401 Unauthorized**; a deactivated account returns **403 Forbidden**; validation failures
return **400** with the specific errors; a created account returns **201**. This makes the
API predictable and lets the frontend react correctly (e.g. the global 401 handler logs the
user out).

**Q20. How does the frontend consume the API across web and mobile?**
Through one wrapper, `apiCall()`. The base URL is chosen at runtime by `resolveApiBase()`:
on a Capacitor native device it targets the production HTTPS API (a phone has no localhost
backend); on the Vite dev server it targets the local backend; in production web it uses a
same-origin `/api`. This is why the **same code** works on both web and Android.

---

## F. Security

**Q21. What security measures did you implement?**
Defence in depth: **bcrypt** password hashing; **JWT** auth with expiry; **role-based**
authorization; **Helmet** with a custom **Content-Security-Policy**; a **CORS allowlist**;
**rate limiting** (20 auth attempts/15 min, 150 requests/min per IP); **input validation**
with express-validator and body-size caps; **TLS** to MongoDB and **HTTPS** for the API; and
a minimal Android footprint (only the `INTERNET` permission, no cleartext traffic).

**Q22. How do you prevent brute-force attacks on login?**
With `express-rate-limit`. The auth limiter allows only ~20 attempts per IP per 15-minute
window and returns a friendly "too many attempts" message; a global limiter caps all `/api`
traffic at 150 requests/minute. I also set `trust proxy: 1` so the limiter sees the real
client IP behind Render's proxy rather than the proxy's IP.

**Q23. What is CORS and how is it configured here?**
CORS controls which web origins may call the API from a browser. I use an **allowlist** in
`server.js`: the production URL, the Vite dev and preview servers, and the Capacitor schemes
(`https://localhost`, `capacitor://localhost`). Disallowed origins are denied *silently*
(returning `false` rather than throwing, so a blocked origin doesn't become a 500).

**Q24. What is a Content-Security-Policy and why did you set one?**
A CSP tells the browser which sources of scripts, styles, fonts, and images are allowed,
which limits the damage of an XSS injection. I configured Helmet's CSP explicitly —
`defaultSrc 'self'`, `objectSrc 'none'`, `frameAncestors 'none'` (no clickjacking), and
specific allowances for the fonts/CDN the app actually uses. It's a real, tuned policy, not
the default.

---

## G. Capacitor & Android APK

**Q25. How did you turn a web app into an Android app?**
With **Capacitor**. Capacitor wraps the compiled web build (`frontend/dist`) in a native
Android shell that runs it in a WebView and exposes native capabilities. I run `vite build`,
sync the output into the native project, and build with Gradle. The result is a real APK,
`com.campusassist.app`, that installs and runs like any native app — but it's the *same*
React code, so I maintain one codebase for web and mobile.

**Q26. Tell me about the APK — size, SDK, signing.**
It's `app-debug.apk`, about **7.1 MB**, **minSdk 24** (Android 7.0+), targetSdk 36, with a
branded launcher icon and splash screen. It's currently a **debug-signed** build, which is
perfect for installing and demoing but not for the Play Store — for public release I'd build
a **release** variant signed with a keystore (the steps are documented in
`ANDROID_DEPLOYMENT_GUIDE.md`).

**Q27. How does the Android app reach your backend? Any special handling?**
A phone has no `localhost` server, so the API client detects the native Capacitor context
and points all calls at the **production HTTPS API** on Render. The Capacitor config sets
`androidScheme: https` and `allowMixedContent: false`, so the WebView serves over HTTPS and
blocks insecure mixed content — consistent with the all-HTTPS API. The app requests only the
`INTERNET` permission.

---

## H. Deployment

**Q28. How and where is the project deployed?**
On **Render** (a cloud platform) as a single **web service**, configured with `render.yaml`.
The build installs backend and frontend dependencies and runs `vite build`; the start
command is `node backend/server.js`, and that one server serves both the API and the React
build. The database is **MongoDB Atlas**, a managed cloud cluster. Secrets — `MONGO_URI`,
`JWT_SECRET`, `FRONTEND_URL` — are injected as environment variables, never committed.

**Q29. Why serve the API and frontend from one service?**
Simplicity and correctness: one deploy, one URL, **no CORS issues** for the web app (it's
same-origin with its API), and the free tier covers it. `server.js` serves `frontend/dist`
when present and falls back to the legacy static site otherwise, with an SPA catch-all so
client routes resolve. The only cost is the free-tier cold start, which I work around by
warming the server before a demo.

---

## I. Project Architecture & "Why this technology?"

**Q30. Why did you choose this overall technology stack (MERN + Capacitor)?**
I chose a **MERN-style stack** — MongoDB, Express, React, Node — plus **Capacitor**, for four
reasons:
1. **One language everywhere.** JavaScript on frontend, backend, and tooling lowered the
   context-switching cost and let me move fast as a solo developer.
2. **Right data model.** MongoDB's documents fit the varied, evolving entities of a helpdesk
   better than rigid SQL tables, while Mongoose still gives me validation and structure.
3. **One codebase, two platforms.** Capacitor reuses the exact React build for Android, so I
   didn't write or maintain a separate mobile app.
4. **Free, production-grade hosting.** Render + MongoDB Atlas let me deploy a real, public,
   HTTPS-secured app at zero cost — ideal for a student project that still needs to be live.
Add the **Anthropic Claude API** for a genuinely capable chatbot (with a fallback for
reliability), and the stack delivers a complete, modern, deployable product end to end.

---

## Rapid-fire backups (if they probe further)

- **What's bcrypt's cost factor and why 12?** Work factor controlling hash rounds (2¹²
  iterations); 12 is a strong, common default — secure but not so slow it hurts login UX.
- **What happens if the Claude API key is missing?** The chat route falls back to a keyword
  knowledge base, so the bot still answers — graceful degradation.
- **How do you stop a student editing another student's data?** Updates are keyed to the
  user id *inside the verified token* (`req.user._id`), not to anything the client sends.
- **What's `trust proxy: 1`?** Tells Express it's behind one proxy (Render), so it reads the
  real client IP from `X-Forwarded-For` — needed for correct rate limiting.
- **Biggest limitation?** Free-tier cold start and a debug-signed APK — both known, both have
  a clear fix (paid tier / release keystore).
