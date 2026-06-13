# CampusAssist — Final Project Summary

**Prepared for:** Final College Submission · Demo · Viva
**Date:** 2026-06-13
**Status:** Feature-complete · Live on Render · Android APK built and device-verified

---

## 1. Project Title

**CampusAssist — A College Helpdesk Chatbot and Student Services Platform**
(Web + Android application with an AI-powered helpdesk assistant)

---

## 2. Problem Statement

In most colleges, routine student services — requesting a marksheet or bonafide
certificate, applying for leave, checking exam schedules, fees, attendance, timetables,
and notices — are handled through scattered offices, paper forms, and informal WhatsApp
messages. Students don't know *where* to ask, requests get lost, there is no status
tracking, and staff repeatedly answer the same questions.

**CampusAssist** solves this by providing a **single, mobile-friendly platform** where a
student logs in once and can: ask a 24×7 **AI helpdesk chatbot**, submit and **track**
document requests with reference numbers, apply for leave/OD, and view exams, fees,
attendance, timetable, notices, library, and events — while administrators manage all of
it from one **admin panel**.

---

## 3. Objectives

1. Provide a **single sign-on student portal** for all common helpdesk services.
2. Offer an **AI chatbot** that answers college FAQs instantly, 24×7.
3. Let students **raise and track requests** (certificates, leave) with status and unique reference numbers.
4. Give administrators a **centralised dashboard** to manage students, requests, leaves, notices, exams, attendance, events, and timetables.
5. Enforce **secure authentication and role-based access** (student vs admin).
6. Deliver the product on **both web and Android** from a single codebase.
7. Deploy to a **live, publicly accessible URL** with a managed cloud database.

---

## 4. Technologies Used

| Layer | Technology |
|---|---|
| **Frontend** | React 18.3, Vite 5.4, React Router 6.26, GSAP, CSS Modules |
| **Mobile** | Capacitor 8.4 (Android wrapper around the React build) |
| **Backend** | Node.js (≥18), Express 4.18 |
| **Database** | MongoDB Atlas (cloud) via Mongoose 8 ODM |
| **Auth** | JSON Web Tokens (jsonwebtoken 9), bcryptjs (cost 12) |
| **AI** | Anthropic Claude API (`claude-haiku-4-5`) for the chatbot |
| **Security** | Helmet (CSP), express-rate-limit, express-validator, CORS allowlist |
| **Tooling** | morgan (logging), dotenv, nodemailer |
| **Hosting** | Render (web service) + MongoDB Atlas (database) |

**Why this stack (summary):** a JavaScript-everywhere (MERN) stack lets one language
(JS) cover frontend, backend, and tooling; MongoDB's document model maps naturally to the
varied entities (users, requests, notices, attendance); Capacitor reuses the exact web
build for Android with no second codebase; Render + Atlas give free, production-grade
hosting suitable for a student project. (Per-technology justifications are in
`VIVA_QUESTIONS_AND_ANSWERS.md`.)

---

## 5. System Architecture

CampusAssist is a **single-page application with a REST backend**, deployed as **one
Render web service** that serves both the JSON API and the compiled React app.

```
  React SPA (web)  ─┐
                    ├──HTTPS + JWT──►  Express API (Render)  ──►  MongoDB Atlas
  Android app  ─────┘                        │
  (Capacitor, same                           └──►  Anthropic Claude API (chatbot)
   React build)
```

Request pipeline inside the server:
`Helmet (CSP) → CORS allowlist → rate limiters → JSON parser → route → protect (JWT) → [adminOnly] → Mongoose → MongoDB`.

The **same React build** is wrapped by Capacitor into the Android APK; on a device the
API client automatically targets the production HTTPS API. Full diagrams are in
`PROJECT_ARCHITECTURE.md` (§10).

---

## 6. Database Design

**Engine:** MongoDB Atlas · **ODM:** Mongoose (schemas with types, enums, validators, timestamps).

**Core collections (13):**

| Collection | Key fields | Notes |
|---|---|---|
| **User** | name, studentId (unique), email (unique), password (hashed), department (enum), role (student/admin), isActive, parent details | Passwords bcrypt-hashed; `toJSON` strips password |
| **Request** | student (ref User), type (enum), purpose, urgency, status (enum), refNumber (unique) | `refNumber` like `MA-2026-0042` via atomic `Counter` |
| **Counter** | _id (e.g. `request-2026`), seq | Atomic sequence generator |
| **Leave** | applicant, type (leave/OD), dates, status | Leave & On-Duty workflow |
| **Notice** | title, body, date | Announcements |
| **Exam** | subject, date, details | Exam schedule |
| **Fee** | student, amount, status | Fee records |
| **Book** / **BorrowedBook** | catalogue / borrow ledger | Library module |
| **Attendance** | student, subject, percentage | 75% threshold rule |
| **Event** | title, date, details | College events |
| **Timetable** | day, periods | Weekly schedule |
| **Contact** | name, message | Help / contact-us |

**Design highlights:**
- **Referential links** via `ObjectId` refs (e.g. `Request.student → User`).
- **Enums** enforce valid values (departments, request types, statuses, urgency) at the DB layer.
- **Atomic counters** give human-readable, gap-free, collision-free reference numbers instead of random IDs.
- **Unique indexes** on `studentId` and `email` prevent duplicate accounts.

---

## 7. Authentication Flow

1. **Register** (`POST /api/auth/register`) — validated by `express-validator` (name, student ID, valid email, password ≥8 chars with a letter and a digit/special char, department). Password is bcrypt-hashed (cost 12) in a Mongoose pre-save hook. A JWT is returned.
2. **Login** (`POST /api/auth/login`) — looks up by uppercased student ID, verifies password with `bcrypt.compare`, blocks deactivated accounts, then issues a JWT (`{ id }`, 30-day expiry).
3. **Session** — client stores the token and user in `localStorage` (`ca_token`, `ca_user`).
4. **Authenticated requests** — client sends `Authorization: Bearer <token>`; the `protect` middleware verifies the signature and loads the user (without password).
5. **Authorization** — admin routes additionally pass through `adminOnly`, which checks `req.user.role === 'admin'`.
6. **Expiry / invalid token** — server returns `401`; the client's global handler clears the session and redirects to `/login`.

---

## 8. Key Features

- **AI Helpdesk Chatbot** — Claude-powered answers to college FAQs, with a keyword fallback so it never goes silent.
- **Document Requests** — six certificate types, urgency levels, six-stage status tracking, unique sequential reference numbers.
- **Leave & OD Applications** — apply and track; admin approval.
- **Student Dashboard** — at-a-glance stats and quick links.
- **Notices** with unread tracking.
- **Exams, Fees, Attendance, Timetable, Library, Events** — student views, admin management.
- **Profile** — edit personal and parent details, upload a photo, change password.
- **CGPA Calculator** — handy client-side tool.
- **Admin Panel** — overview dashboard plus management tabs for Students, Requests, Leaves, Notices, Exams, Attendance, Events, Timetable, and Messages; student directory with CSV/SQL export.
- **Cross-platform** — identical experience on web and Android.
- **Light/Dark theme** and animated, mobile-first UI.

---

## 9. Security Features

- **bcrypt** password hashing (cost 12); passwords never leave the server.
- **JWT** Bearer authentication (signed, 30-day expiry); invalid/expired tokens rejected.
- **Role-based authorization** (`protect` + `adminOnly`).
- **Helmet** security headers with a custom **Content-Security-Policy**.
- **CORS allowlist** (production URL, Vite dev/preview, Capacitor schemes).
- **Rate limiting** — 20 auth attempts / 15 min and 150 requests / min per IP.
- **Input validation & sanitisation** via `express-validator`; 5 MB body cap; chat message length cap.
- **TLS everywhere** — MongoDB over TLS, API over HTTPS, Android `allowMixedContent: false`.
- **Minimal Android attack surface** — only the `INTERNET` permission.
- **Account deactivation** via the `isActive` flag.

---

## 10. APK Deployment Process

1. `npm run build` (Vite) compiles the React app to `frontend/dist`.
2. Capacitor syncs `dist` into the native Android project (`frontend/android`).
3. On-device, the API client auto-targets the production HTTPS API.
4. Gradle `assembleDebug` produces `app-debug.apk` (≈ **7.1 MB**, package `com.campusassist.app`, minSdk 24 / Android 7.0+, targetSdk 36) with branded icon and splash.
5. Install by copying the APK to a phone (allow "unknown sources") or via `adb install`.

**Verification:** on a fresh install the app launches without crashes, sends all traffic
to the production HTTPS API, authenticates with JWT, and performs live database reads and
writes. It is a **debug-signed** build — perfect for demos; a **release keystore** is
needed before public/store distribution (steps in `ANDROID_DEPLOYMENT_GUIDE.md`).

---

## 11. Future Enhancements

1. **Release-signed APK** + Google Play listing (keystore, versioning, store assets).
2. **Push notifications** for request status changes, new notices, and fee deadlines.
3. **Online payments** integration for fees (UPI / payment gateway).
4. **File uploads / downloads** — attach medical certificates to leave; download issued certificates as PDFs.
5. **Refresh tokens & shorter access-token lifetime** for tighter session security.
6. **Email/SMS notifications** (nodemailer is already wired in) and OTP-based password reset.
7. **Analytics dashboard** for admins (request volumes, turnaround times).
8. **Internationalisation** (multi-language UI).
9. **Always-on hosting** to remove the free-tier cold start; CDN for static assets.
10. **Automated CI/CD** with a full test suite gating each deploy.

---

## Conclusion

CampusAssist is a complete, deployed, full-stack application that digitises a college
helpdesk end-to-end. It demonstrates modern web and mobile engineering — a React SPA, a
secured Express/MongoDB REST backend, JWT auth with role-based access, an AI chatbot, and
a Capacitor Android build — all running live on cloud infrastructure. It is ready for
submission, demonstration, and viva.
