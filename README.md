# CampusAssist — Smart College Helpdesk

[![Selenium E2E Audit](https://github.com/SNEKA2107/college-helpdesk-chatbot/actions/workflows/selenium-audit.yml/badge.svg?branch=demo-branch)](https://github.com/SNEKA2107/college-helpdesk-chatbot/actions/workflows/selenium-audit.yml)
[![Project Summary](https://github.com/SNEKA2107/college-helpdesk-chatbot/actions/workflows/project-summary.yml/badge.svg)](https://github.com/SNEKA2107/college-helpdesk-chatbot/actions/workflows/project-summary.yml)

> A full-stack, AI-powered college helpdesk platform. Students log in to a single portal for attendance, exams, fees, timetable, results, leave/OD requests, notices, library and a 24×7 AI assistant — while administrators run every module from a unified console.

**🌐 Live demo:** https://college-helpdesk-chatbot-l4bk.onrender.com
**Demo logins:** Student `22IT101` / `student123` · Admin `ADMIN01` / `admin@123`

---

## 📖 Project Overview

CampusAssist digitises the everyday helpdesk services of a college into one mobile-friendly web application (also shipped as an Android APK via Capacitor). Instead of scattered offices, paper forms and informal chats, a student signs in once to check attendance, results, fees, exams, timetable and notices; raise and **track** document/leave requests with reference numbers; and ask an **AI assistant** grounded in the college's own data. Administrators manage students, academics, requests and content from a 17-tab console with analytics and an audit trail.

The application is a **React single-page app** backed by a **Node/Express REST API** and **MongoDB**, deployed as a single Render web service that serves both the API and the compiled SPA. See [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md) and [`FINAL_PROJECT_SUMMARY.md`](FINAL_PROJECT_SUMMARY.md).

## ✨ Features

**Students** — Dashboard (landing) · AI Assistant · Attendance · Results (marks) · CGPA Calculator · Exam info · Fees · Timetable · Leave & OD requests · Certificate requests (tracked) · Notices · Events · Library · Contact · Profile · Settings.

**Admins** — 17-tab console: Overview, Students (approve/reject, search, export), Requests, Leaves, Attendance, Marks, Fees, Exams, Timetable, Events, Calendar, Notices, Messages, Knowledge Base, Faculty, AI Analytics, Audit, Account.

**AI** — grounded chat with source citations, conversation memory, follow-up suggestions, 👍/👎 feedback, and AI notice summarisation. Full list in [`FEATURES.md`](FEATURES.md).

## 📸 Screenshots

> _Placeholders — drop images into `docs/screenshots/` and update the paths._

| Landing | Student Dashboard | AI Assistant |
|---|---|---|
| `![Landing](docs/screenshots/landing.png)` | `![Dashboard](docs/screenshots/dashboard.png)` | `![Chat](docs/screenshots/chat.png)` |

| Admin Console | Attendance | Mobile (APK) |
|---|---|---|
| `![Admin](docs/screenshots/admin.png)` | `![Attendance](docs/screenshots/attendance.png)` | `![Mobile](docs/screenshots/mobile.png)` |

## 🧰 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 5, React Router 6, GSAP, CSS Modules |
| Backend | Node.js + Express 4 |
| Database | MongoDB + Mongoose 8 (Atlas in prod; in-memory MongoDB for local/CI) |
| Auth | JWT (`jsonwebtoken`) + bcryptjs (cost 12) |
| AI | Anthropic Claude SDK (`claude-haiku-4-5`) with graceful fallback |
| Security | Helmet (CSP), express-rate-limit, express-validator, CORS allowlist |
| Mobile | Capacitor (Android APK) |
| QA | node:test unit suites + Selenium WebDriver / Pytest (POM) |
| Hosting | Render (single web service) + MongoDB Atlas |

## 🏗️ System Architecture

```
  React SPA (web) ─┐
                   ├── HTTPS + JWT ──►  Express API (Render) ──►  MongoDB Atlas
  Android (APK) ───┘                          │
  (same React build)                          └──►  Anthropic Claude API (AI chat)
```

Per-request pipeline: `Helmet (CSP) → CORS allowlist → rate limiters → JSON parser → route → protect (JWT) → [adminOnly] → service → Mongoose → MongoDB`. Full diagrams in [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md).

## 📦 Installation

**Prerequisites:** Node.js ≥ 18, npm, and (for production) a MongoDB Atlas cluster + optional Anthropic API key.

```bash
git clone https://github.com/SNEKA2107/college-helpdesk-chatbot.git
cd college-helpdesk-chatbot
```

## 💻 Local Setup

The fastest path uses an **in-memory MongoDB** — no Atlas account needed:

```bash
# Backend + seeded in-memory DB, serves the built app on http://localhost:5000
node backend/dev-local.js
```

For frontend hot-reload development against the local backend:

```bash
cd frontend
npm install
npm run dev            # Vite dev server on http://localhost:5173
```

## 🔐 Environment Variables

Create `backend/.env` (git-ignored; template in `backend/.env.example`):

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGO_URI` | ✅ (prod) | MongoDB Atlas connection string |
| `JWT_SECRET` | ✅ | Signs/verifies JWTs (use a long random string) |
| `NODE_ENV` | ✅ (prod) | `production` enables combined logging |
| `FRONTEND_URL` | ✅ (prod) | CORS allow-origin (deployed site URL) |
| `PORT` | auto | Server port (defaults to 5000) |
| `ANTHROPIC_API_KEY` | ⬜ | Full AI prose; **unset ⇒ graceful retrieval-only fallback** |
| `AUTH_RATE_LIMIT` | ⬜ | Max logins / 15 min / IP (default 20) |
| `RENDER_EXTERNAL_URL` | auto | Render injects; auto-added to CORS allowlist |
| `EMAIL_SERVICE` / `EMAIL_USER` / `EMAIL_PASS` | ⬜ | Email notifications |

Frontend build override (optional): `VITE_API_URL` points the SPA at a specific API base.

## ▶️ Running the Backend

```bash
cd backend
npm install
# with a real Atlas DB (uses backend/.env):
npm start                 # node server.js  → http://localhost:5000
# or fully self-contained with a seeded in-memory DB:
npm run dev:local
```

## ▶️ Running the Frontend

```bash
cd frontend
npm install
npm run dev               # dev server (Vite) → http://localhost:5173
npm run build             # production build → frontend/dist
npm run preview           # preview the production build → http://localhost:4173
```

> In production, the backend serves `frontend/dist` directly — the frontend is not deployed separately.

## 🚀 Deployment

Deployed on **Render** as one web service (API + SPA) with **MongoDB Atlas**. Auto-deploys on push to `main`; the frontend build runs during install. Full steps — Render config, Atlas setup, env vars, migrations, health checks, rollback and backups — in [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md).

## 📁 Folder Structure

```
college-helpdesk-chatbot/
├── frontend/                 # React + Vite SPA (deployed UI)
│   └── src/
│       ├── pages/            # 22 student screens + admin/ (17 tabs)
│       ├── components/       # shared chrome (Layout, Sidebar, Topbar, BottomNav, Modal)
│       ├── features/         # cohesive domains (chat/, charts/, analytics/)
│       ├── hooks/            # useTheme, useToast, useChat, ...
│       ├── services/         # api.js (fetch wrapper), auth.js (session)
│       ├── routes/           # AppRoutes + guards
│       ├── layouts/          # StudentLayout / AdminLayout (role boundaries)
│       └── styles/           # design tokens + per-feature CSS
├── backend/
│   ├── server.js             # app bootstrap (security, CORS, routes, static serve)
│   ├── routes/               # 20 route modules (~91 endpoints)
│   ├── services/             # aiAgent, successEngine, placementEngine, summarizer
│   ├── models/               # 23 Mongoose schemas
│   ├── middleware/           # auth (protect, adminOnly)
│   ├── utils/                # audit, email, intentCategory, timetableConflicts
│   ├── migrations/           # ordered, idempotent data migrations
│   ├── scripts/              # seed / demo / maintenance
│   └── tests/                # node:test suites
├── selenium_model/           # Selenium + Pytest E2E audit suite
└── docs/                     # supporting documentation
```

## 🔌 API Overview

RESTful API under `/api/*`, JWT-protected (Bearer token). ~91 endpoints across 20 modules: `auth`, `students`, `requests`, `leave`, `notices`, `chat`, `conversations`, `knowledge`, `faculty`, `analytics`, `exam`, `fees`, `library`, `timetable`, `contact`, `attendance`, `events`, `marks`, `calendar`, `audit`. Every admin route additionally passes `adminOnly`. Full reference with payloads in [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md).

## 🤖 AI Features

The **Campus Copilot** (`backend/services/aiAgent.js`) runs: **intent classification** → **grounded retrieval** (scoped to the student, with source citations from exams/fees/attendance/marks/notices/knowledge-base/faculty) → **Claude generation** (`claude-haiku-4-5`) with **conversation memory** and **follow-up** suggestions. Without `ANTHROPIC_API_KEY` it falls back to a retrieval-only answer that still cites sources, so the assistant never goes silent. Answers can be rated 👍/👎, and every exchange is logged as a labelled training example. Notices are auto-summarised (summary, key dates, action items, AI priority).

## 🔒 Authentication

Registration is validated (`express-validator`) and gated by **admin approval**; passwords are **bcrypt-hashed (cost 12)**. Login issues a **JWT** (30-day expiry) stored client-side; requests send `Authorization: Bearer <token>`. The `protect` middleware verifies tokens; `adminOnly` enforces the admin role. Frontend route guards (`RequireStudent`/`RequireAdmin`) mirror server enforcement, and a global 401 handler clears the session and redirects to login.

## 🔮 Future Improvements

- Shorter access-token lifetime + refresh tokens; optional `httpOnly` cookie auth.
- Online fee payments (UPI/gateway) and PDF certificate downloads.
- Push/email notifications for request status, notices and fee deadlines.
- Always-on hosting (remove free-tier cold start) + CDN for assets.
- Expanded automated test coverage and Lighthouse/axe a11y gating in CI.
- Release-signed APK + Play Store listing.

## 📄 License

Released under the **MIT License**. _(Add a `LICENSE` file at the repo root to formalise this.)_

## 👤 Author

**Sneka S** — [@SNEKA2107](https://github.com/SNEKA2107)
Repository: https://github.com/SNEKA2107/college-helpdesk-chatbot

---

_Built as a full-stack academic + portfolio project demonstrating React, Express, MongoDB, JWT auth, AI integration, and cloud deployment._
