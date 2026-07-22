# CampusAssist AI — Project Inventory

**Project:** CampusAssist AI — Intelligent College Operating System
**Type:** Final Year Major Project (Full-Stack + Applied AI)
**Branch of record:** `demo-branch` (HEAD `21ad702`)
**Live demo:** https://college-helpdesk-chatbot-l4bk.onrender.com *(see [09_DEPLOYMENT_READINESS](09_DEPLOYMENT_READINESS.md) — live site currently serves the pre-AI `main` build; AI phases are on `demo-branch`)*

---

## 1. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | React | 18.3.1 |
| | Vite (build tool) | 5.4.8 |
| | react-router-dom | 6.26.2 |
| | GSAP + ScrollTrigger (animation) | 3.15.0 |
| Mobile | Capacitor (Android APK) | 8.4.0 |
| Backend | Node.js + Express | 4.18.2 |
| Database | MongoDB Atlas + Mongoose ODM | 8.0.3 |
| Auth | JSON Web Tokens + bcryptjs | jwt 9.0.2 / bcrypt 2.4.3 |
| AI | Anthropic Claude SDK (`claude-haiku-4-5-20251001`) | 0.39.0 |
| Security | helmet, express-rate-limit, cors | 7.1 / 7.1.5 / 2.8.5 |
| Utilities | morgan, express-validator, nodemailer, dotenv | — |
| Testing | node:test + mongodb-memory-server; Selenium E2E suite | — |

## 2. Codebase Metrics

| Artifact | Count |
|---|---|
| Mongoose models | 23 |
| Express route modules | 23 |
| AI service modules | 5 (`aiAgent`, `successEngine`, `summarizer`, `placementEngine`, `homeBriefing`) |
| Student-facing pages (React) | 24 |
| Admin dashboard tabs | 17 |
| Seed/maintenance scripts | 4 |
| Backend unit tests | 5 (all passing) |

## 3. Feature Phases (all implemented)

| Phase | Module | Key files |
|---|---|---|
| 1 | Campus Copilot (intent → grounded RAG → Claude, citations, memory, follow-ups) | `services/aiAgent.js`, `features/chat/*` |
| 2 | Student Success Dashboard (weighted score, risks, recommendations, trends) | `services/successEngine.js`, `pages/Success.jsx` |
| 3 | Smart Notice Summarizer (AI summary/keyDates/actionItems/priority) | `services/summarizer.js` |
| 4 | AI Analytics Dashboard (QueryLog aggregation) | `routes/analytics.js`, `features/analytics/AnalyticsTab.jsx` |
| 5 | Personalized Student Home (AI daily briefing + 10 widgets) | `services/homeBriefing.js`, `pages/Home.jsx` |
| 6 | Placement Hub (readiness, eligibility, skill-gap, resume score, recommender, prep) | `services/placementEngine.js`, `pages/Placement.jsx` |
| 7 | Knowledge Base Manager + Faculty Directory + Training-data collection + Feedback | `routes/knowledge.js`, `routes/faculty.js`, `models/KnowledgeDocument.js`, `models/Faculty.js` |

## 4. Data Models (23)

**Identity & AI:** `User`, `Conversation`, `Message`, `QueryLog`, `SuccessMetric`, `KnowledgeArticle`, `KnowledgeDocument`, `Faculty`
**Academics:** `Attendance`, `Marks`, `Exam`, `Timetable`, `CalendarEvent`
**Services:** `Fee`, `Request`, `Leave`, `Notice`, `Event`, `Contact`, `Book`, `BorrowedBook`
**Infrastructure:** `AuditLog`, `Counter`

## 5. REST API Surface (23 route modules under `/api`)

`auth`, `students`, `requests`, `leave`, `notices`, `chat`, `conversations`, `success`, `home`, `placement`, `knowledge`, `faculty`, `analytics`, `exam`, `fees`, `library`, `timetable`, `contact`, `attendance`, `events`, `marks`, `calendar`, `audit`

## 6. Student Pages (24)

Landing, Login, Register, **Home (AI)**, Dashboard, Chat (Copilot), **Success**, **Placement**, Requests, Attendance, Status, Exam, Fees, Timetable, Cgpa, Leave, OD, Events, Notices, Library, Contact, Profile, Calendar.

## 7. Admin Tabs (17)

Overview, **AI Analytics**, **Knowledge Base**, **Faculty Directory**, Requests, Leaves, Notices, Messages, Students, My Account, Exams, Attendance, Events, Timetable, Marks, Calendar, Audit Log.

## 8. Security Controls

- JWT bearer auth via `protect`; role gate via `adminOnly`.
- `helmet` security headers + Content-Security-Policy.
- CORS origin allowlist (web, Vite dev/preview, Capacitor WebViews).
- Two-tier rate limiting: global (150 req/min/IP) + auth (20/15 min).
- `trust proxy` for correct client IP behind Render.
- Stored-XSS mitigation: HTML stripped on notice/knowledge/faculty inputs.
- Append-only `AuditLog` for every admin mutation.
- Passwords hashed with bcrypt (cost 12); `password` never serialized (`toJSON` strips it).

## 9. Demo Credentials & Seed Scripts

| Role | ID | Password |
|---|---|---|
| Student | `22IT101` | `student123` |
| Admin | `ADMIN01` | `admin@123` |

- `node backend/scripts/seed-success-demo.js` — attendance/marks/skills/success snapshots for 22IT101.
- `node backend/scripts/seed-knowledge-demo.js` — Phase 7 faculty (ML teacher, IT HOD) + 4 KB documents.

## 10. Repository Layout

```
college-helpdesk-chatbot/
├── backend/            Express API
│   ├── models/         23 Mongoose schemas
│   ├── routes/         23 route modules
│   ├── services/       5 AI engines
│   ├── middleware/     auth (protect, adminOnly)
│   ├── utils/          audit, intentCategory
│   ├── scripts/        seed/maintenance
│   ├── tests/          critical.test.js
│   └── server.js       app entry (helmet, cors, rate-limit, routes, SPA)
├── frontend/           React + Vite SPA
│   ├── src/pages/      24 pages + admin/ (17 tabs)
│   ├── src/features/   chat, charts, analytics
│   ├── src/services/   api, auth
│   └── android/        Capacitor APK project
└── docs/               This submission package
```
