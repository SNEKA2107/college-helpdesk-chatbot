# CampusAssist — Chatbot Capability Audit

Source of truth for the intent dataset. Every intent below is backed by a real
model, route and page in this repository. Nothing here is aspirational.

## 1. Roles that actually exist

| Role | Auth | Portal |
|---|---|---|
| `student` | `/login` | `/student/*` (19 pages) |
| `faculty` | `/login` (unified) | `/faculty/*` (13 pages) |
| `admin`   | `/login` (unified) | `/admin/*` |

`User.role` enum is exactly `['student','admin','faculty']`.

**There is no parent, alumni, applicant or visitor login.** Parent details are
*fields on the student record* (`parentName`, `parentPhone`, `parentEmail`,
`parentOccupation`, `parentAddress`) — not an account. Questions from those
personas must be answered honestly: the portal has no separate access for them,
and they are routed to the student's own login or the Contact desks.

## 2. Modules confirmed present

| Module | Model(s) | Route | Student page |
|---|---|---|---|
| Attendance | `Attendance` | `/api/attendance` | `Attendance.jsx` |
| Marks / CGPA | `Marks` | `/api/marks`, `/api/marks/cgpa` | `Cgpa.jsx` |
| Timetable | `Timetable` | `/api/timetable`, `/today` | `Timetable.jsx` |
| Exams | `Exam` | `/api/exam`, `/schedule`, `/practicals` | `Exam.jsx` |
| Fees | `Fee` | `/api/fees`, `/payment` | `Fees.jsx` |
| Leave | `Leave` | `/api/leave` | `Leave.jsx`, `Od.jsx` |
| Certificates | `Request` | `/api/requests` | `Requests.jsx`, `Status.jsx` |
| Library | `Book`, `BorrowedBook` | `/api/library`, `/hours`, `/renew` | `Library.jsx` |
| Notices | `Notice` | `/api/notices` | `Notices.jsx` |
| Events | `Event` | `/api/events`, `/:id/register` | `Events.jsx` |
| Calendar | `CalendarEvent` | `/api/calendar` | `Calendar.jsx` |
| Faculty directory | `Faculty` | `/api/faculty` | via Copilot |
| Contact | `Contact` | `/api/contact` | `Contact.jsx` |
| Coursework | `Assignment`, `StudyMaterial` | `/api/coursework` | `StudyCoursework.jsx` |
| Profile | `User` | `/api/auth/profile` | `Profile.jsx` |
| Knowledge base | `KnowledgeArticle`, `KnowledgeDocument` | `/api/knowledge` | admin tab |
| Placement hub | `placementEngine` | via Copilot | Placement UI |
| Success score | `successEngine`, `SuccessMetric` | via Copilot | Dashboard |
| Chat | `Conversation`, `Message`, `QueryLog` | `/api/chat` | `Chat.jsx` |

## 3. Business rules the answers must respect

**Attendance** — `status` ∈ `Present | Absent | Late`; `Late` counts as present in
the percentage. Minimum **75% per subject**. Risk bands in `successEngine`:
`<75` high, `<85` medium, else low.

**Marks** — internal out of **40**, external out of **60**, pass at **50**.
Grade bands: `≥91 O(10)`, `≥81 A+(9)`, `≥71 A(8)`, `≥61 B+(7)`, `≥50 B(6)`,
else `RA(0)`. A faculty-entered mark is hidden until `published: true`.

**Fees** — `Fee` has `components[]`, `total`, `balance`, `dueDate`, `lateFine`,
`status`, and `history[]` of payments. A payment is **recorded** with a mode
(`Online | DD | Cash | NEFT`) and a txn reference, then carries
`verified: false` until an **admin verifies** it. There is no payment gateway.

**Leave** — types are exactly: `Medical Leave`, `Personal Leave`,
`On Duty (OD) – Event`, `On Duty (OD) – Training`, `Emergency Leave`,
`Family Function`. `toDate` may not precede `fromDate`. Optional document
upload is magic-byte validated. Status `Pending → Approved | Rejected`.

**Certificates** — types: `Marksheet`, `Bonafide Certificate`,
`Transfer Certificate`, `Migration Certificate`, `Conduct Certificate`,
`Provisional Certificate`, `Other`. Urgency `Normal | Urgent | Emergency`.
Workflow: `Submitted → Under Review → Processing → Ready for Collection →
Completed | Rejected`, tracked by a unique `refNumber`.

**Library** — hours are hardcoded: Mon–Fri 8:00 AM–6:00 PM, Sat 9:00 AM–4:00 PM,
Sun & holidays closed. Renewal returns *"Book renewal requested. Librarian will
confirm within 24 hours."* Book status `Available | Borrowed | Reserved`;
borrow status `Active | Returned | Overdue`.

**Events** — categories `Technical | Cultural | Sports | Workshop | Seminar |
Other`. Seats are capped and claimed atomically → "Event is full." / "Already
registered."

**Notices** — categories `exam | fee | general | urgent | holiday`; lifecycle
`draft | published | archived`; `pinned` sorts first; AI summary, `keyDates`,
`actionItems` and `aiPriority` are produced by the summarizer.

**Contact desks** — exactly: Admin Office, Examination Cell, Accounts Office,
Student Welfare, Library, HOD – IT Department, HOD – CSE Department. Stated SLA
on the page: **response within 1–2 working days**.

**Auth** — self-registration creates a **student** with
`approvalStatus: 'pending'`; no token, no auto-login, until an admin approves.
`mustChangePassword` forces a change on first login. Login lockout after 10
failures for 15 minutes. **There is no forgot-password endpoint** — both login
pages instruct the user to contact the admin office. A logged-in user can change
their password from Settings.

**Placement** — a fixed 10-company catalog (TCS, Wipro, Capgemini, Infosys,
Cognizant, Accenture, Zoho, Freshworks, Amazon, Microsoft) with `minCgpa`,
`minAtt`, `maxBacklogs` and screened skills. Readiness is weighted
Academics 40 / Skills 25 / Attendance 20 / Projects 15.

**Departments** — data-driven (`Department` collection), seeded from IT, CSE,
AIML, AIDS, Bioinformatics, ECE, EEE, MECH, CIVIL, General + Administration.

## 4. Present as knowledge-base categories ONLY

`KnowledgeDocument.CATEGORIES` includes **Hostel, Transport, Scholarships,
Admissions**. There is no hostel allocation module, no bus-pass module, no
scholarship application module and no admissions module. These intents are
answerable **only** from uploaded knowledge documents, and the expected
responses say so explicitly rather than promising a feature.

## 5. Explicitly out of scope for the chatbot

The Campus HelpDesk assistant is not a software assistant. Backend, frontend,
React, Express, MongoDB, APIs, source code, schema, auth implementation, AI
models and system architecture are **developer-only** topics. The dataset
carries a dedicated `out_of_scope_technical` intent so the classifier learns to
decline these rather than hallucinate an answer.
