# CampusAssist — Project Architecture

**Project:** CampusAssist — College Helpdesk Chatbot & Student Services App
**Document type:** Technical architecture reference (Phase 1 analysis)
**Date:** 2026-06-13
**Status:** Feature-complete · Deployed on Render · Android APK built & device-verified

> This document is generated from a direct analysis of the codebase. Every technology
> claim below is traceable to a file in the repository (paths are given in line).

---

## 1. Frontend Technologies

| Technology | Version | Role | Evidence |
|---|---|---|---|
| **React** | 18.3.1 | UI library (SPA) | `frontend/package.json` |
| **Vite** | 5.4.8 | Build tool / dev server | `frontend/vite.config.js` |
| **React Router DOM** | 6.26.2 | Client-side routing, route guards | `frontend/src/routes/AppRoutes.jsx`, `guards.jsx` |
| **GSAP** | 3.15.0 | Page/element animations | `frontend/src/hooks/usePageAnimations.js` |
| **CSS Modules + global CSS** | — | Styling (`*.module.css` + `src/styles/*.css`) | `frontend/src/styles/` |
| **@capacitor/core + @capacitor/android** | 8.4.0 | Native Android wrapper around the web build | `frontend/capacitor.config.json` |

**Structure:** The React app lives in `frontend/src` and is organised as:
- `pages/` — one component per screen (Login, Register, Dashboard, Requests, Chat, Profile, Leave, Od, Notices, Exam, Fees, Library, Timetable, Attendance, Events, Contact, Cgpa, Status, Landing).
- `pages/admin/` — the admin panel split into tabs (Overview, Students, Requests, Leaves, Notices, Exams, Attendance, Events, Timetable, Messages).
- `components/` — reusable UI (Layout, Sidebar, Topbar, BottomNav, Modal, AuthThemeButton).
- `services/` — `api.js` (fetch wrapper + API base resolver) and `auth.js` (session/token helpers).
- `hooks/` — theme, toasts, page animations, unread-notices polling.
- `utils/` — formatting, bot helpers, sound.

> **Note — legacy static frontend:** the repository root also contains an earlier
> vanilla HTML/CSS/JS version (`index.html`, `dashboard.html`, `style.css`, `app.js`, etc.).
> The React app in `frontend/` is the current, deployed frontend; the static files are
> retained as history and are served only as a fallback if no React build is present
> (see §10 static-file logic in `backend/server.js`).

---

## 2. Backend Technologies

| Technology | Version | Role | Evidence |
|---|---|---|---|
| **Node.js** | ≥18 | Runtime | root `package.json` `engines` |
| **Express** | 4.18.2 | HTTP server / REST framework | `backend/server.js` |
| **Mongoose** | 8.0.3 | MongoDB ODM (schemas, validation) | `backend/models/*` |
| **jsonwebtoken** | 9.0.2 | JWT issue/verify | `backend/routes/auth.js`, `middleware/auth.js` |
| **bcryptjs** | 2.4.3 | Password hashing (cost factor 12) | `backend/models/User.js` |
| **helmet** | 7.1.0 | Security headers + Content-Security-Policy | `backend/server.js` |
| **express-rate-limit** | 7.1.5 | Brute-force / abuse protection | `backend/server.js` |
| **express-validator** | 7.0.1 | Request body validation & sanitisation | `backend/routes/auth.js` |
| **cors** | 2.8.5 | Cross-origin allowlist | `backend/server.js` |
| **morgan** | 1.10.0 | HTTP request logging | `backend/server.js` |
| **nodemailer** | 6.9.9 | Email sending utility | `backend/utils/email.js` |
| **@anthropic-ai/sdk** | 0.39.0 | Claude AI chatbot integration | `backend/routes/chat.js` |
| **dotenv** | 16.3.1 | Environment configuration | `backend/server.js` |

---

## 3. Database

- **Engine:** MongoDB (cloud-hosted on **MongoDB Atlas**), connected over TLS.
- **Access layer:** Mongoose ODM with strongly-typed schemas, enums, and validators.
- **Connection:** `mongoose.connect(process.env.MONGO_URI, { tls: true, ... })` in `backend/server.js`; the process exits if the DB is unreachable (fail-fast).
- **Collections / Models (13):**

| Model | Purpose |
|---|---|
| `User` | Students & admins — credentials, profile, parent details, role, active flag |
| `Request` | Document/certificate requests with auto-generated reference numbers |
| `Leave` | Leave & On-Duty (OD) applications |
| `Notice` | College notices / announcements |
| `Exam` | Exam schedule entries |
| `Fee` | Fee records |
| `Book` | Library catalogue |
| `BorrowedBook` | Borrow/return ledger |
| `Attendance` | Per-subject attendance records |
| `Event` | College events |
| `Timetable` | Weekly class timetable |
| `Contact` | Contact-us / help messages |
| `Counter` | Atomic sequence generator for human-readable reference numbers |

**Reference-number design:** `Request` uses the `Counter` collection's atomic
`findByIdAndUpdate({ $inc: { seq: 1 } }, { upsert: true })` to produce sequential,
collision-free refs like `MA-2026-0042` (`backend/models/Request.js`).

---

## 4. Authentication Mechanism

- **Scheme:** Stateless **JWT (JSON Web Token)** Bearer authentication.
- **Login credential:** Student ID + password (`POST /api/auth/login`). Student IDs are normalised to uppercase.
- **Token:** Signed with `JWT_SECRET`, payload `{ id }`, **30-day** expiry (`genToken` in `backend/routes/auth.js`).
- **Password storage:** bcrypt hash with **cost factor 12**, hashed in a Mongoose `pre('save')` hook; never returned to clients (`toJSON` strips `password`).
- **Verification:** `protect` middleware (`backend/middleware/auth.js`) reads the `Authorization: Bearer <token>` header, verifies the signature, loads the user (minus password), and rejects missing/invalid/expired tokens with `401`.
- **Client session:** Token + user object kept in `localStorage` (`ca_token`, `ca_user`) via `frontend/src/services/auth.js`; a global `401` handler clears the session and redirects to `/login`.
- **Account state:** Deactivated accounts (`isActive: false`) are blocked at login with `403`.

---

## 5. APIs

### 5a. Internal REST API (`/api/*`)
A single Express API exposes 13 route groups, all JSON, all (except auth/register/login) behind the `protect` middleware:

```
/api/auth        register, login, me, change-password, profile
/api/students     student directory & admin management
/api/requests     certificate/document requests (student + admin)
/api/leave        leave & OD applications
/api/notices      notices / announcements
/api/chat         AI chatbot
/api/exam         exam schedule
/api/fees         fees
/api/library      books, borrow/return
/api/timetable    weekly timetable
/api/contact      contact / help messages
/api/attendance   attendance records
/api/events       college events
```
Admin-only operations across 11 of these routers are gated by the `adminOnly` middleware.

### 5b. External API — Anthropic Claude (chatbot)
- `backend/routes/chat.js` calls the **Anthropic Claude API** (model `claude-haiku-4-5-20251001`) with a college-specific system prompt, capped at 300 tokens and 2–4 sentence answers.
- **Graceful degradation:** if `ANTHROPIC_API_KEY` is not set or the call fails, the route falls back to a built-in keyword knowledge base (exams, fees, marksheet, bonafide, library, timetable, leave, notices, contact, attendance), so the chatbot always responds.

---

## 6. Hosting / Deployment Platform

| Concern | Choice |
|---|---|
| **App host** | **Render** (free web-service tier) |
| **Config** | `render.yaml` (Infrastructure-as-Code) |
| **Build** | `cd backend && npm install --omit=dev && cd ../frontend && npm install --include=dev && npm run build` |
| **Start** | `node backend/server.js` |
| **Database** | **MongoDB Atlas** (separate managed cluster) |
| **Live URL** | `https://college-helpdesk-chatbot-l4bk.onrender.com` |
| **Secrets** | `MONGO_URI`, `JWT_SECRET`, `FRONTEND_URL` injected as Render env vars (`sync: false`) |

**Single-service design:** one Render service serves *both* the JSON API (`/api/*`) and
the compiled React SPA. `backend/server.js` serves `frontend/dist` if it exists (built
during deploy), with an SPA fallback (`app.get('*')`) so client-side routes resolve.

**Known free-tier behaviour:** the service sleeps when idle; the first request after
idle incurs a ~20–30 s cold start. Wake it before a demo.

---

## 7. Android APK Generation Process

The Android app is the **same React build** wrapped natively with **Capacitor**:

1. **Build the web app:** `npm run build` in `frontend/` → `frontend/dist`.
2. **Sync into Android:** Capacitor copies `dist` into the native Android project (`frontend/android`) as web assets.
3. **Native config:** `capacitor.config.json` sets `appId: com.campusassist.app`, `appName: CampusAssist`, `androidScheme: https`, `allowMixedContent: false`.
4. **API targeting on device:** `frontend/src/services/api.js` detects a Capacitor native context and points all calls at the production Render API over HTTPS (a device has no localhost backend).
5. **Compile:** Gradle `assembleDebug` → `frontend/android/app/build/outputs/apk/debug/app-debug.apk`.

**Current artifact:** `app-debug.apk` ≈ **7.1 MB** (7,148,911 bytes, built 2026-06-13),
package `com.campusassist.app`, **minSdk 24 (Android 7.0+)**, targetSdk 36. Branded
launcher icon + splash assets are now committed to the repository. Verified on a fresh
install: launches without crashes, all traffic to the production HTTPS API, working auth,
live DB reads/writes. It is a **debug-signed** build (fine for demos; a release keystore
is required before public/store distribution — see `ANDROID_DEPLOYMENT_GUIDE.md`).

---

## 8. Security Features Implemented

| Layer | Control | Where |
|---|---|---|
| **Password security** | bcrypt hashing, cost 12; min-length & complexity rules; password stripped from all responses | `models/User.js`, `routes/auth.js` |
| **Authentication** | JWT Bearer, signed, 30-day expiry; invalid/expired tokens rejected | `middleware/auth.js` |
| **Authorization** | Role-based access (`student` / `admin`); `adminOnly` guard on privileged routes | `middleware/auth.js`, 11 routers |
| **HTTP headers** | Helmet with explicit Content-Security-Policy, `objectSrc 'none'`, `frameAncestors 'none'` | `server.js` |
| **CORS** | Strict origin allowlist (prod URL, Vite dev/preview, Capacitor schemes); denies silently (no 500) | `server.js` |
| **Rate limiting** | Auth: 20 attempts / 15 min per IP; Global: 150 req/min per IP | `server.js` |
| **Input validation** | `express-validator` on auth; body size cap (5 MB); message length cap on chat | `routes/auth.js`, `routes/chat.js` |
| **Transport** | MongoDB over TLS; API served over HTTPS; Android `allowMixedContent: false`, no cleartext | `server.js`, `capacitor.config.json` |
| **Android surface** | Only the `INTERNET` permission requested; debug-only debuggable flag | manifest audit (`FINAL_APK_SUMMARY.md`) |
| **Account control** | `isActive` flag to deactivate accounts; enforced at login | `routes/auth.js` |
| **Proxy correctness** | `trust proxy: 1` so rate-limit IPs are accurate behind Render/Nginx | `server.js` |

---

## 9. Major Project Modules

1. **Authentication & Profile** — register, login, JWT session, change password, edit profile (incl. parent details & photo).
2. **Document Requests** — request certificates (Marksheet, Bonafide, Transfer, Migration, Conduct, Provisional), track status with sequential ref numbers; admin processes them.
3. **Leave & OD** — apply for leave / on-duty; admin approval workflow.
4. **Notices** — announcements with unread tracking on the client.
5. **Exams** — exam schedule (admin-managed).
6. **Fees** — fee details and status.
7. **Library** — catalogue + borrow/return ledger.
8. **Timetable** — weekly class timetable (admin-managed).
9. **Attendance** — per-subject attendance, 75% threshold messaging.
10. **Events** — college events (admin-managed).
11. **Contact / Help** — contact messages to admin.
12. **AI Chatbot** — Claude-powered helpdesk assistant with keyword fallback.
13. **CGPA Calculator** — client-side utility.
14. **Admin Panel** — overview dashboard + management tabs for Students, Requests, Leaves, Notices, Exams, Attendance, Events, Timetable, Messages.

---

## 10. Architecture Flow

### High-level (request lifecycle)
```
┌─────────────────────────────────────────────────────────────────────┐
│  CLIENTS                                                              │
│  • Web SPA (React build, served by backend at the Render URL)        │
│  • Android app (Capacitor WebView wrapping the same React build)     │
└───────────────┬─────────────────────────────────────────────────────┘
                │  HTTPS  (fetch, Authorization: Bearer <JWT>)
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  RENDER WEB SERVICE  (Node.js + Express — backend/server.js)         │
│                                                                       │
│   helmet (CSP) → CORS allowlist → rate limiters → express.json        │
│        │                                                              │
│        ├── /api/auth/*        (public: register/login + protected)    │
│        ├── /api/<resource>/*  → protect (JWT) → [adminOnly?] → handler│
│        │                                   │                          │
│        │                                   ▼                          │
│        │                          Mongoose models ──► MongoDB Atlas   │
│        │                                                              │
│        ├── /api/chat  → protect → Anthropic Claude API (or fallback)  │
│        │                                                              │
│        └── static: serve frontend/dist (React) + SPA fallback (*)     │
└─────────────────────────────────────────────────────────────────────┘
```

### Authentication flow
```
Register/Login ──► auth route validates ──► bcrypt verify / create
        │                                          │
        │                                  jwt.sign({id}, JWT_SECRET, 30d)
        ▼                                          │
Client stores token + user in localStorage ◄───────┘
        │
        ▼
Every protected request sends  Authorization: Bearer <token>
        │
        ▼
protect middleware: jwt.verify → load user → req.user
        │
        ├─ student route → handler runs
        └─ admin route  → adminOnly checks req.user.role === 'admin'
```

### Build & deploy flow
```
git push (main)
   │
   ▼
Render build:  install backend deps  ──►  install frontend deps  ──►  vite build → frontend/dist
   │
   ▼
Render start:  node backend/server.js   (serves API + React build)

Android (manual, local):  vite build ──► capacitor sync ──► gradle assembleDebug ──► app-debug.apk
```

---

## Architecture summary (one paragraph)

CampusAssist is a **MERN-style single-page application**: a **React + Vite** frontend, an
**Express/Node.js** REST backend, and **MongoDB Atlas** for storage via **Mongoose**.
Authentication is **stateless JWT** with **bcrypt**-hashed passwords and **role-based**
authorization (student/admin). The backend is hardened with **Helmet CSP, a CORS
allowlist, rate limiting, and input validation**. An **AI chatbot** is powered by the
**Anthropic Claude API** with a keyword fallback. The whole thing deploys as a **single
Render web service** that serves both the API and the React build, and the same React
build is wrapped with **Capacitor** into a native **Android APK**.
