# CampusAssist — College Helpdesk Application
## Complete Project Report

**Project Name:** CampusAssist
**Type:** College Helpdesk Web + Mobile Application
**Live URL:** https://college-helpdesk-chatbot-l4bk.onrender.com
**Repository:** https://github.com/SNEKA2107/college-helpdesk-chatbot
**Document Date:** June 14, 2026
**Status:** Production (Web + Android APK); Phase 1 enterprise hardening complete

---

## Table of Contents
1. [Project Objective & Purpose](#1-project-objective--purpose)
2. [Target Users](#2-target-users)
3. [User Roles](#3-user-roles)
4. [Features & Functionalities](#4-features--functionalities)
5. [Frontend Technologies](#5-frontend-technologies)
6. [Backend Technologies](#6-backend-technologies)
7. [Database](#7-database)
8. [APIs & Integrations](#8-apis--integrations)
9. [System Architecture & Workflow](#9-system-architecture--workflow)
10. [UI/UX Design Approach](#10-uiux-design-approach)
11. [Security Features](#11-security-features)
12. [Hosting & Deployment](#12-hosting--deployment)
13. [Source Code Structure](#13-source-code-structure)
14. [Third-Party Tools & Libraries](#14-third-party-tools--libraries)
15. [Testing Strategy](#15-testing-strategy)
16. [Development Methodology](#16-development-methodology)
17. [Future Enhancements](#17-future-enhancements)
18. [Project Timeline & Milestones](#18-project-timeline--milestones)
19. [Challenges & Limitations](#19-challenges--limitations)

---

## 1. Project Objective & Purpose

CampusAssist is a **college helpdesk web and mobile application** that centralizes everyday
student–administration interactions into a single self-service portal. Rather than requiring
students to physically visit college offices for marksheets, fee details, certificates,
attendance records, or leave applications, the platform delivers all of these online.

Key objectives:
- Provide an **AI-powered chatbot** for instant answers to common college queries.
- Offer **self-service modules** for academics, fees, attendance, document requests, and more.
- Give administrators an **admin panel** to manage all student-facing data.
- Ship as both a **deployed website** and an **installable Android app** from a single codebase.

The product was built as a professional, modern, fully responsive application suitable for an
engineering college (South Indian institution context).

## 2. Target Users

- **Students** — the primary users; engineering college students.
- **College administrators / staff** — manage requests, marks, fees, notices, attendance, etc.
- **Parents** — indirectly, since parent/guardian details are stored in each student's profile.

## 3. User Roles

The system defines **two roles** in `backend/models/User.js` (the `role` enum):

| Role | Capabilities |
|------|-------------|
| **student** (default) | Dashboard, AI chat, document requests, attendance, marksheet status, fees, exam schedule, timetable, CGPA calculator, leave & OD applications, events, notices, library, contact, academic calendar, and own profile management. |
| **admin** | All student capabilities **plus** the Admin panel (`/admin`): manage students, requests, leaves, notices, messages, exams, attendance, events, timetable, fees (with payment verification), marks entry, academic calendar, and account settings. |

> There is no separate "staff" role in the codebase — staff responsibilities are performed
> through the **admin** role. Access control is enforced on the frontend with `RequireAuth` /
> `RequireAdmin` route guards and on the backend with `protect` middleware plus role checks.

## 4. Features & Functionalities

### Student-facing modules (17 protected routes + public landing)
- **Dashboard** — quick-link cards with dynamic events and marksheet status
- **AI Chat** — Claude-powered helpdesk assistant
- **Document Requests** — marksheet, bonafide certificate, etc.
- **Attendance** — subject-wise progress bars (75% minimum rule)
- **Marksheet Status** — request tracking timeline
- **Exam** schedule, **Fees** breakdown + payment, **Timetable**
- **CGPA Calculator** — Anna University 10-point grading scale
- **Leave & OD** applications, **Events** (with registration), **Notices** (with filters)
- **Library** (book search / borrowed books), **Contact** + FAQ
- **Profile** (photo upload, parent/guardian details), **Academic Calendar**

### Admin panel (`pages/Admin.jsx` shell + tabs under `pages/admin/`)
Overview, Students, Requests, Leaves, Notices, Messages, Exams, Attendance, Events,
Timetable, **Fees** (with overpayment guard + verification), **Marks** (admin entry,
student view-only), **Calendar** (CRUD), and Account settings.

## 5. Frontend Technologies

- **React 18.3** with **Vite 5.4** (build tool and dev server)
- **react-router-dom 6.26** — single-page-application routing with lazy-loaded pages
  (code splitting via `React.lazy` + `Suspense`)
- **GSAP 3.15** — animations
- **Plain CSS** with a CSS-variables-based design system (no Tailwind or UI library)
- Legacy redirect logic maps old `*.html` URLs onto modern React routes

## 6. Backend Technologies

- **Node.js + Express 4.18** — REST API and static file server in a single service
- **Mongoose 8** — MongoDB object data modeling
- **jsonwebtoken** — JWT authentication (30-day token expiry)
- **bcryptjs** — password hashing (cost factor 12)
- **express-validator** — request input validation
- **helmet** — security headers and Content-Security-Policy
- **cors** — cross-origin allowlist
- **express-rate-limit** — request throttling
- **morgan** — HTTP request logging
- **nodemailer** — email capability

## 7. Database

- **MongoDB Atlas** (cloud-hosted, TLS-enforced connection)
- **15 Mongoose models:** User, Request, Leave, Notice, Event, Contact, Exam, Book,
  BorrowedBook, Timetable, Counter, Attendance, Fee, Marks, CalendarEvent
- Data-integrity highlights:
  - **Unique index + upsert** on Attendance (prevents duplicate records)
  - **Fee overpayment guard** plus admin verification endpoint
  - **Migrations** under `backend/migrations/` (`0001-dedupe-attendance`, `0002-backfill-fee-verification`)

## 8. APIs & Integrations

- **Internal REST API** under `/api/*`, organized into 15 routers: `auth`, `students`,
  `requests`, `leave`, `notices`, `chat`, `exam`, `fees`, `library`, `timetable`, `contact`,
  `attendance`, `events`, `marks`, `calendar`.
- **Anthropic Claude API** (`@anthropic-ai/sdk`) — the chatbot uses **Claude Haiku 4.5**
  (`claude-haiku-4-5-20251001`) with a college-specific system prompt. It **gracefully falls
  back to a local keyword knowledge base** when no API key is configured or the API call fails.
- **Capacitor** — wraps the web app into a native Android shell.

## 9. System Architecture & Workflow

The application uses a **monolithic single-service architecture** — one Express process serves
both the API and the built React frontend.

```
   Browser / Android WebView (React SPA)
            │  HTTPS, JWT in Authorization header
            ▼
   Express server (backend/server.js)
       ├── /api/*   → routers → Mongoose → MongoDB Atlas
       ├── /api/chat → Anthropic Claude API (with keyword fallback)
       └── static    → serves frontend/dist (React build)
                       SPA fallback → index.html
```

- The server serves `frontend/dist` (the React build) when present; if missing, it falls back
  to the legacy static HTML site at the repo root.
- **Authentication flow:** login by **studentId + password** → server issues a **JWT (30-day
  expiry)** → token is sent on subsequent protected requests → `protect` middleware verifies it.

## 10. UI/UX Design Approach

- **Indigo/Dark design system** (primary color `#4E85BF`, dark sidebar).
- **Three themes** — Dark (default), Light, and Night (warm amber) — persisted in `localStorage`.
- Shared **sidebar + topbar** layout (`Layout.jsx`), plus a **bottom navigation** bar for mobile.
- Fully **responsive**; the landing page CSS is scoped under a `.landing` wrapper to isolate its
  variables from the global theme.
- Reusable components include Modal, a Toast system (`useToast` hook), and a theme toggle.

## 11. Security Features

- **JWT-based authentication**; passwords are **bcrypt-hashed (cost 12)** and never returned to
  clients (the `toJSON` method strips the password field).
- **Password policy** at registration: minimum 8 characters, must contain a letter and a
  digit/special character.
- **Helmet** with a tuned **Content-Security-Policy**.
- **CORS allowlist** of explicit origins (Render production URL, Vite dev/preview, Capacitor
  schemes); denies disallowed origins without throwing 500 errors.
- **Rate limiting:** global limit of 150 requests/min per IP, plus a stricter auth limiter
  (20 requests / 15 minutes) on login and registration.
- `trust proxy` enabled for correct client-IP resolution behind Render/Nginx.
- **Account deactivation** check (`isActive`) blocks disabled accounts at login.
- Request body size caps (5 MB) to limit abuse.

## 12. Hosting & Deployment

- **Render** free-tier single web service at
  `https://college-helpdesk-chatbot-l4bk.onrender.com`.
- **Auto-deploys** on every push to the `main` branch.
- Because the Render service was created from the dashboard, it **ignores `render.yaml`** — the
  React frontend is built via a `postinstall` script in `backend/package.json`
  (`cd ../frontend && npm install --include=dev && npm run build`).
- The free tier **sleeps when idle** (30–60s cold start); deploys take roughly 2–5 minutes.
- **Android APK** built via Capacitor (~4.2 MB, v1.0, minSdk 24 / target 36) and device-tested
  on Android 15 against the live API. (Debug build only — no release keystore yet.)

## 13. Source Code Structure

```
college-helpdesk-chatbot/
├── backend/
│   ├── server.js              # Express app entry point
│   ├── models/                # 15 Mongoose schemas
│   ├── routes/                # 15 API routers
│   ├── middleware/auth.js     # protect + role guards
│   ├── migrations/            # data migrations (0001, 0002)
│   ├── tests/critical.test.js # node:test suite
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/             # student pages + Admin.jsx
│   │   ├── pages/admin/       # admin tabs
│   │   ├── components/        # Layout, Sidebar, Topbar, BottomNav, Modal…
│   │   ├── routes/            # AppRoutes.jsx, guards.jsx
│   │   └── hooks/useToast.jsx
│   ├── android/               # Capacitor Android project
│   └── capacitor.config.json
└── *.html                     # legacy static site (fallback only)
```

## 14. Third-Party Tools & Libraries

**Backend (runtime):** @anthropic-ai/sdk, bcryptjs, cors, dotenv, express,
express-rate-limit, express-validator, helmet, jsonwebtoken, mongoose, morgan, nodemailer.
**Backend (dev):** mongodb-memory-server, nodemon.

**Frontend (runtime):** react, react-dom, react-router-dom, gsap, @capacitor/core,
@capacitor/android.
**Frontend (dev):** vite, @vitejs/plugin-react, @capacitor/cli.

## 15. Testing Strategy

- **Backend tests** via Node's built-in test runner (`npm test` → `tests/critical.test.js`),
  using **mongodb-memory-server** (in-memory MongoDB) — 5/5 passing.
- **End-to-end** check (`test-react-e2e.js`) with the backend on port 5000 and a Vite preview
  on port 4173.
- **Android device verification** using Puppeteer-core over `adb forward` CDP to attach to the
  Android WebView; full migration audit reported 35/35 live checks passing.

## 16. Development Methodology

- **Iterative, phased remediation** driven by `ENTERPRISE_GAP_ANALYSIS.md` — 29 issues
  (5 Critical, 8 High, 10 Medium, 10 Low) — addressed in **strict priority order**, one group
  at a time, with sign-off between phases.
- **Phase 1 (Critical) complete & verified:** marks system, academic calendar, fee overpayment
  guard, attendance dedupe, and admin account tab.
- Git-based workflow with continuous deployment (auto-deploy on push to `main`).

## 17. Future Enhancements

- **High-priority gap-analysis group (8 issues)** — next planned phase.
- Subsequent **Medium (10)** and **Low (10)** priority groups.
- Integration of a **real payment gateway** (current design intentionally uses admin
  verification rather than live payments).
- A **release keystore** and signed / Play Store APK (only a debug APK exists today).
- Decommissioning the legacy static HTML site and removing the one known dead file
  (`frontend/src/utils/bot.js`).

## 18. Project Timeline & Milestones

| Date | Milestone |
|------|-----------|
| **May 2026** | Full redesign and rebuild of frontend + backend; MongoDB Atlas integration. |
| **June 13, 2026** | React 18 + Vite migration completed; React build becomes the deployed frontend; Capacitor Android APK built and device-tested. |
| **June 2026** | CORS/Origin deployment bug fixed; Phase 1 (Critical) enterprise hardening completed and verified. |
| **Current** | Awaiting go-ahead to begin the High-priority remediation phase. |

## 19. Challenges & Limitations

- **Render free tier:** cold-start sleep (30–60s) and the dashboard-created service ignoring
  `render.yaml` (worked around with a `postinstall` build script).
- **CORS gotcha:** relying solely on the `FRONTEND_URL` env var caused 500 errors on the app's
  own frontend; fixed by always allowing the production URL. (Note: testing the live API
  requires sending an `Origin` header to simulate a real browser.)
- **Two coexisting frontends:** the React app (`frontend/src`, the live target) and the legacy
  root HTML site (fallback only); a self-destructing service worker (`sw.js`) evicts the old
  cache-first worker from returning visitors' browsers.
- **Capacitor toolchain pinning:** the Android build requires JDK 21 for Gradle 8.14 (a newer
  system JDK is incompatible).
- **No live payments**, **debug-only APK**, and **Medium/Low gap-analysis items still open**.

---

*Report generated for CampusAssist. For deeper detail on any section — architecture diagrams,
the security model, or the admin panel internals — those can be expanded into dedicated
documents.*
