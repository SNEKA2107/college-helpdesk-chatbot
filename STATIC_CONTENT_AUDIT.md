# STATIC CONTENT AUDIT — CampusAssist

**Audit date:** 2026-06-14
**Scope:** React frontend (`frontend/src`) + backend routes that emit content. This is the deployed app (Render serves `frontend/dist`; the root `*.html` files are legacy and no longer served when a build exists).
**Goal:** Identify every hardcoded / static / mock / placeholder / demo element that should be MongoDB-driven, and separate it from legitimate static UI configuration.
**Status:** AUDIT ONLY — no code changed.

---

## Classification key

| Class | Meaning | Action |
|-------|---------|--------|
| 🔴 FAKE DATA | Mock/demo records rendered as if real | Must remove — violates "no mock data" |
| 🟠 STALE HARDCODE | Real-world facts hardcoded in code (dates, fees, phones) | Move to DB / admin-managed |
| 🟡 IGNORES DB | A DB field exists and is populated, but UI uses a hardcoded copy | Wire UI to DB |
| 🟢 LEGIT STATIC | UI config / reference tables / labels — correctly static | Keep |

---

## 🔴 FAKE DATA (critical — must remove)

### SC-1 — `Events.jsx` renders 8 hardcoded demo events
**File:** `frontend/src/pages/Events.jsx:9-18`, used at `:30`
```js
const DEMO_EVENTS = [ {CodeFest 2025…}, {Ethnic Day…}, … 8 items ];
…
setEvents(res.ok && res.data.events?.length ? res.data.events : DEMO_EVENTS);
```
**Problem:** When the `Event` collection is empty (which is the real state for this deployment and for any fresh DB), the page silently shows 8 fabricated events with fake dates, venues, organizers and seat counts. A brand-new student sees a full events calendar that does not exist. Directly violates "no mock data / no placeholder records / no fake dashboard statistics."
**Note:** The Dashboard "Upcoming Events" widget (`Dashboard.jsx:89`) reads the same `/events` API but does **not** fall back to demo — so Dashboard correctly shows "No upcoming events" while the Events page shows 8 fakes. Inconsistent.
**Fix target:** Delete `DEMO_EVENTS`; render the real empty state that already exists (`:70-75`).

---

## 🟠 STALE HARDCODE (real facts frozen in code)

### SC-2 — Chatbot keyword fallback has hardcoded semester facts
**File:** `backend/routes/chat.js:8-20` (`knowledgeBase`) and the AI system prompt `:47-58`
```
exam: 'Semester V exams start June 15, 2026…'
fees: 'Semester V total fee: ₹55,000…deadline May 25, 2026'
contact: 'Admin Office: +91 98765 43210…'
```
**Problem:** Fee amounts, exam dates, and phone numbers are frozen in source. They will be wrong the moment the admin changes real data (which is now stored in `Exam`, `Fee`, etc.). The same facts are duplicated into the Claude system prompt.
**Fix target:** Have the bot read live facts from the DB (latest `Exam`, the student's `Fee`, `Notice`s) rather than from a hardcoded map.

### SC-3 — `Status.jsx` collection info & SLA hardcoded
**File:** `frontend/src/pages/Status.jsx:166-173, :79`
```
Office Location: Administrative Block, Room 101
Collection Hours: Mon–Fri, 9 AM – 4 PM
Contact: +91 98765 43210
Estimated completion: 3–5 working days
```
**Problem:** Institution contact details and SLA presented as fact, frozen in code.
**Fix target:** Move to an admin-editable settings record (or reuse a Config collection).

### SC-4 — `Contact.jsx` office directory & FAQ hardcoded
**File:** `frontend/src/pages/Contact.jsx:7-18` (`OFFICES`, `DEPARTMENTS`, `FAQS`)
**Problem:** Phone numbers, emails, office hours, and FAQ answers are static arrays. These are real institutional data shown to students.
**Fix target:** Back with a `Contact`/`Office` directory + FAQ collection editable by admin (or at minimum a Config doc).

### SC-5 — `Library.jsx` rules + `GET /api/library/hours` hardcoded
**Files:** `frontend/src/pages/Library.jsx:9` (`RULES`), `backend/routes/library.js:36-46`
**Problem:** Library hours are returned hardcoded from the route handler; borrowing rules are a static array. Changing hours requires a redeploy.
**Fix target:** Store in Config/Library-settings collection.

---

## 🟡 IGNORES EXISTING DB DATA

### SC-6 — `Exam.jsx` ignores `exam.instructions` from the DB
**File:** `frontend/src/pages/Exam.jsx:7-16` (`INSTRUCTIONS_LEFT/RIGHT`), rendered `:106-119`
**Problem:** The `Exam` model **has** an `instructions: [String]` array, it is populated by seed and editable in `ExamsTab`, but the student Exam page renders a hardcoded copy and never reads `exam.instructions`. Admin edits to instructions are invisible to students.
**Fix target:** Render `exam.instructions` (fall back to defaults only if empty).

### SC-7 — Non-functional "Download" buttons (placeholder workflows)
| File | Line | Button | Behavior |
|------|------|--------|----------|
| `Exam.jsx` | `:35` | "Download Hall Ticket" | Shows a toast, downloads nothing |
| `Fees.jsx` | `:48` | "Download Receipt" | Toast "coming soon" |
| `Status.jsx` | `DOC_SHORTCUTS :16` | doc shortcut buttons | Navigate only; cosmetic |
**Problem:** These present a capability that does not exist (simulated workflow). Either implement or remove.

---

## 🟢 LEGITIMATE STATIC (keep — not data)

These are UI configuration, reference scales, or labels — correctly hardcoded, **not** flagged for change:

| File | Constant | Why it's fine |
|------|----------|---------------|
| `Dashboard.jsx` | `QUICK_ACCESS`, `MOBILE_ACTIONS`, `EVENT_ACCENTS`, `MARKSHEET_STEPS` | Navigation tiles, color accents, stepper labels — app structure, not records. Counts/feeds on this page ARE from the API (`/requests/stats`, `/notices`, `/events`, `/requests`). |
| `Cgpa.jsx` | `GRADE_REF`, `CGPA_SCALE` | Anna University grading scale — a fixed standard, legitimately constant. The actual marks/SGPA/CGPA come from `/api/marks/cgpa`. |
| `Status.jsx` | `STATUS_STEPS`, `STATUS_PROGRESS`, badge maps | Mirror the real `Request.status` enum. |
| `Leave.jsx` / `Od.jsx` | `LEAVE_TYPES`, `OD_TYPES`, `GUIDELINES` | Form option lists + guideline text. (But see note below.) |
| `Admin.jsx` | `NAV_SECTIONS` | Admin nav structure. |
| `Timetable.jsx` | `DAYS`, `WEEKDAYS`, `SUB_CLASS` | Day labels + CSS class map. Grid data is DB-driven (`/api/timetable`). |
| Various | category/filter lists, badge→class maps | Presentation only. |

### Landing page — borderline
**File:** `Landing.jsx:29 TESTIMONIALS`, `:42 STATS`
`TESTIMONIALS` (fake student quotes) and `STATS` (e.g. headline numbers) are fabricated marketing content on the public landing page. Not a data-integrity issue inside the authenticated app, but they are fake. **Recommendation: MEDIUM** — replace with real or neutral copy, or clearly mark as illustrative. Not blocking.

---

## Per-module verdict (the audit checklist requested)

| Module | Element | Source today | Verdict |
|--------|---------|--------------|---------|
| **Dashboard** | Stats / counts | `/requests/stats`, `/notices` | 🟢 DB-driven |
| Dashboard | Activity feed / notifications | `/notices` | 🟢 DB-driven |
| Dashboard | Upcoming events | `/events` | 🟢 DB-driven (no fake fallback here) |
| Dashboard | Marksheet status stepper | `/requests` (own) | 🟢 DB-driven |
| **Student / Attendance** | summary, records | `/api/attendance/summary` | 🟢 DB-driven |
| Student / Marks, GPA | semesters, CGPA | `/api/marks/cgpa` | 🟢 DB-driven |
| Student / Requests, Leave | history | `/requests`, `/leave` (own) | 🟢 DB-driven |
| Student / Fee status | breakdown, history | `/api/fees` (own) | 🟢 DB-driven |
| **Admin** | student/request/leave/notice counts | `/students`, `/requests`, `/leave`, `/notices` | 🟢 DB-driven |
| Admin | fee / attendance / marks summaries | respective APIs | 🟢 DB-driven |
| **Academic / Exam** | schedule, practicals | `/api/exam` | 🟢 data DB-driven … |
| Academic / Exam | instructions | hardcoded | 🟡 SC-6 ignores DB |
| Academic / Exam | hall ticket | button stub | 🔴 SC-7 simulated |
| Academic / Timetable | grid | `/api/timetable` | 🟢 DB-driven (but see leakage in timetable report) |
| Academic / Results, internal marks | — | `/api/marks` | 🟢 DB-driven |
| **Communication / Events** | event list | `/events` **or DEMO_EVENTS** | 🔴 SC-1 fake fallback |
| Communication / Notices | notices | `/notices` | 🟢 DB-driven |
| Communication / Calendar | entries | `/api/calendar` | 🟢 DB-driven |
| Communication / Notifications | (reuses notices) | `/notices` | 🟢 DB-driven |
| **Chat** | bot facts | hardcoded knowledgeBase + prompt | 🟠 SC-2 stale |
| **Contact** | offices, FAQ | hardcoded | 🟠 SC-4 |
| **Library** | hours, rules | hardcoded | 🟠 SC-5 |

---

## Summary count

| Class | Count | Items |
|-------|-------|-------|
| 🔴 Fake data | 1 | SC-1 (Events DEMO_EVENTS) — plus simulated download buttons SC-7 |
| 🟠 Stale hardcode | 3 | SC-2 chat, SC-4 contact, SC-5 library |
| 🟡 Ignores DB | 1 | SC-6 exam instructions |
| 🟢 Legit static | many | navigation, scales, labels |
| Borderline | 1 | Landing testimonials/stats |

**Headline:** The core authenticated data flows (dashboard, attendance, marks, fees, requests, leave, notices, calendar, timetable, exam *data*) are genuinely MongoDB-driven. The real offenders are **SC-1 (fake events)** — the only true mock-data-rendered-as-real issue — followed by hardcoded institutional facts (chat, contact, library) and the exam-instructions DB bypass.

*AUDIT ONLY — DO NOT COMMIT.*
