# CampusAssist — Master Audit Report

**Date:** 2026-06-11  
**Auditor:** Principal Engineer (Claude Sonnet 4.6)  
**Scope:** Full-stack architecture, integration, security, and QA readiness

---

## 1. Project Overview

CampusAssist is a college helpdesk web application for a South Indian engineering college. It provides students with self-service access to notices, exam info, fees, library, timetable, leave applications, document requests, attendance, and an AI chatbot. Administrators manage students, approve/reject leave, fulfill requests, and post notices.

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML5/CSS3/JS MPA — 23 HTML pages, no bundler |
| State | localStorage (`ca_token`, `ca_user`, `ca_theme`, `ca_read_notices`) |
| API Client | Custom `apiCall()` in `app.js` using native `fetch()` |
| Backend | Node.js 20 + Express.js 4.18 |
| Auth | JWT (30-day expiry) + bcryptjs (12 salt rounds) |
| Database | MongoDB Atlas (cloud) via Mongoose ODM — 12 collections |
| Email | nodemailer / Gmail (optional) |
| AI Chat | @anthropic-ai/sdk Claude Haiku (optional, keyword fallback) |
| Animations | GSAP 3.12.5 from cdnjs CDN |
| PWA | Service Worker + manifest.json |
| Deployment | Render.com (render.yaml), Express serves static files |

---

## 2. Frontend Architecture

### Pages Audited (23 total)

| Page | Auth Guard | Role | Primary API |
|---|---|---|---|
| `index.html` | None (redirect if logged in) | Public | — |
| `dashboard.html` | requireAuth | Student/Admin | /auth/me, /notices, /requests, /leave |
| `profile.html` | requireAuth | Student | /auth/me, /auth/profile |
| `notices.html` | requireAuth | Student | /notices |
| `chat.html` | requireAuth | Student | /chat |
| `exam.html` | requireAuth | Student | /exam |
| `fees.html` | requireAuth | Student | /fees |
| `library.html` | requireAuth | Student | /library |
| `timetable.html` | requireAuth | Student | /timetable |
| `leave.html` | requireAuth | Student | /leave |
| `requests.html` | requireAuth | Student | /requests |
| `od.html` | requireAuth | Student | /leave (OD type) |
| `cgpa.html` | requireAuth | Student | /exam (grades) |
| `status.html` | requireAuth | Student | /requests |
| `events.html` | requireAuth | Student | /events |
| `contact.html` | requireAuth | Student | /contact |
| `admin.html` (or similar) | requireAdmin | Admin | All admin endpoints |
| `student-search.html` | requireAdmin (fixed) | Admin | /students/search/:q |
| `student-profile.html` | requireAdmin | Admin | /students/:id |

### app.js — Shared Utilities
- `requireAuth()` — checks `ca_token` in localStorage, redirects to `index.html` if missing
- `requireAdmin()` — checks `ca_token` + `ca_user.role === 'admin'`, redirects if not admin
- `populateUserInfo()` — fills topbar name/avatar from localStorage
- `apiCall(path, opts)` — wraps `fetch()`, prepends `/api`, injects Bearer token, returns `{ok, data, error}`
- `showToast(msg, type)` — shows overlay notification
- `toggleTheme()` — toggles dark/light mode, persists to localStorage

---

## 3. Backend Architecture

### Entry Point: `backend/server.js`
- Trust proxy enabled (`app.set('trust proxy', 1)`) for Render.com
- Helmet security headers with CSP allowing GSAP CDN + Google Fonts
- CORS restricted to known origins via allowedOrigins array
- Auth rate limiter: 20 req / 15 min on `/api/auth/login` and `/api/auth/register`
- Global rate limiter: 150 req / min on all `/api/*`
- MongoDB Atlas connection with TLS, 15s server selection timeout
- Static files served from project root (`..` relative to `backend/`)
- SPA fallback: `GET *` → `index.html`

### Route Map

| Route Prefix | File | Middleware |
|---|---|---|
| /api/auth | routes/auth.js | public (login/register) + protect (me, profile, change-password) |
| /api/students | routes/students.js | protect + adminOnly (GET all, search, by id); protect (PUT own) |
| /api/requests | routes/requests.js | protect; adminOnly for status updates |
| /api/leave | routes/leave.js | protect; adminOnly for approval |
| /api/notices | routes/notices.js | protect; adminOnly for POST/PUT/DELETE |
| /api/chat | routes/chat.js | protect |
| /api/exam | routes/exam.js | protect |
| /api/fees | routes/fees.js | protect; adminOnly for GET /all |
| /api/library | routes/library.js | protect |
| /api/timetable | routes/timetable.js | protect |
| /api/contact | routes/contact.js | protect; adminOnly for GET all / PUT resolve |
| /api/attendance | routes/attendance.js | protect |
| /api/events | routes/events.js | protect |

### Auth Middleware (`middleware/auth.js`)
- `protect`: verifies JWT, loads user from DB, attaches to `req.user`
- `adminOnly`: checks `req.user.role === 'admin'`, returns 403 if not

### Database Models (12 collections)
`User`, `Request`, `Leave`, `Notice`, `Chat`, `Exam`, `Fee`, `LibraryBook`, `Timetable`, `Contact`, `Attendance`, `Event`

---

## 4. Data Flow

```
Browser → app.js:apiCall() → fetch /api/... (Bearer JWT) → Express route
    → middleware/auth.js (verify JWT, load user)
    → Route handler (validate, query MongoDB Atlas via Mongoose)
    → JSON response → app.js parses {ok, data, error} → render DOM
```

Errors surface as `showToast(result.error, 'error')` on all pages.

---

## 5. Dead Code / Orphaned Files

| File | Status |
|---|---|
| `backend/create-admin.js` | Utility — mismatched credentials (fixed) |
| `backend/reset-admin.js` | Utility — mismatched credentials (fixed) |
| `backend/seed-students.js` | Utility — seeding, correct credentials |
| `backend/dev-local.js` | Development proxy helper |
| `open-admin.js` | Dev convenience script |
| `screenshot-*.js` | QA tooling — not production code |
| `test-*.js` | Local test runners — not production code |
| `verify-*.js` | Local verify scripts — not production code |
| `serve.json` | Static server config for local dev |
| `generate-icons.js` | PWA icon generator — one-time tool |
| `e2e_test_report.py` | QA reporting — not production code |
| `automated_test/` | Supplementary test harness |
| `selenium_model/` | Primary Selenium test suite |
| `Vulnerability Test Results/` | Audit evidence |

None of the above are imported by the production server or frontend.

---

## 6. Issues Found and Fixed

See `SECURITY_REPORT.md` for full security findings. Summary of all fixes applied:

| ID | Issue | Status |
|---|---|---|
| SEC-01/BUG-002 | CSP disabled | Fixed |
| SEC-04 | User enumeration in register | Fixed |
| SEC-05 | Weak password policy | Fixed |
| SEC-17 | Missing input validation (chat, contact, fees, photo) | Fixed |
| SEC-20 | Trust proxy / rate-limit IP bypass | Fixed |
| BUG-001 | Admin credential mismatch | Fixed |
| BUG-003 | student-search.html wrong auth guard | Fixed |
| R-08 | CORS allowed all origins in production | Fixed |
| — | leave.html no client-side date validation | Fixed |
| — | requests.html button timing (Selenium) | Fixed |

---

## 7. Deployment Configuration

`render.yaml` defines:
- Build command: `cd backend && npm install`
- Start command: `node backend/server.js`
- Environment: `NODE_ENV=production`, `PORT=10000`
- Required env vars: `MONGO_URI`, `JWT_SECRET`, `FRONTEND_URL`
- Optional env vars: `ANTHROPIC_API_KEY`, `EMAIL_USER`, `EMAIL_PASS`

The app is a monorepo: backend serves itself as the frontend's static file host. No separate frontend deployment is needed.

---

*Report generated by automated audit pass — 2026-06-11*
