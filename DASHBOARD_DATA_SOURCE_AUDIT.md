# CampusAssist — Dashboard Data-Source Audit

**Scope:** Where every dashboard element gets its data — static vs. dynamic, endpoint, collection.
**Date:** 2026-06-13
**Mode:** Analysis only. No code was modified.

**Files audited:**
- Student dashboard: `frontend/src/pages/Dashboard.jsx`
- Admin overview: `frontend/src/pages/admin/OverviewTab.jsx`, `frontend/src/pages/Admin.jsx`
- Backend: `backend/routes/requests.js`, `routes/notices.js`, `routes/students.js`, `routes/events.js`
- Models: `backend/models/Request.js`, `Notice.js`, `User.js`, `Event.js`

> **Key takeaway up front:** the dashboard's *counts and notices are fully dynamic* (live
> from MongoDB). But two visible panels — **"Upcoming Events"** and **"Marksheet Status"** —
> are **hardcoded in JSX**, even though a real `Event` collection + `/api/events` endpoint
> already exist. Those are the only elements that should be moved to MongoDB.

---

## At-a-Glance Summary

### Student Dashboard (`Dashboard.jsx`)

| Element | Static / Dynamic | Data source | API endpoint | MongoDB collection |
|---|---|---|---|---|
| Welcome banner (name) | **Dynamic** (cached) | `getUser()` from `localStorage` (set at login) | `POST /api/auth/login` (origin) | `users` |
| Stat: **My Requests** (`total`) | **Dynamic** | live count | `GET /api/requests/stats` | `requests` |
| Stat: **Completed** | **Dynamic** | live count | `GET /api/requests/stats` | `requests` |
| Stat: **In Progress** | **Dynamic** | live count | `GET /api/requests/stats` | `requests` |
| Stat: **Notices** (count) | **Dynamic** | `notices.length` | `GET /api/notices` | `notices` |
| **Recent Notifications** list | **Dynamic** | first 3 notices | `GET /api/notices` | `notices` |
| Mobile recent-notices panel | **Dynamic** | first 3 notices | `GET /api/notices` | `notices` |
| **Quick Access** grid (12 tiles) | **Static** | hardcoded `QUICK_ACCESS` array | — | — *(navigation links — correctly static)* |
| Mobile Quick Actions (9 tiles) | **Static** | hardcoded `MOBILE_ACTIONS` array | — | — *(navigation links — correctly static)* |
| **🎉 Upcoming Events** card | **STATIC (hardcoded)** ⚠️ | literal JSX (Tech Symposium 15 Jun, Cultural Fest 20 Jun, Placement Training 25 Jun) | *none used* | *none used* (an `Event` collection exists but is **not** read here) |
| **📄 Marksheet Status** stepper | **STATIC (hardcoded)** ⚠️ | literal JSX (4 fixed steps) | *none used* | *none used* (real status lives in `requests`) |

### Admin Overview (`OverviewTab.jsx`, data loaded in `Admin.jsx`)

| Element | Static / Dynamic | Data source | API endpoint | MongoDB collection |
|---|---|---|---|---|
| Stat: **Total Students** | **Dynamic** | `data.students.length` | `GET /api/students` | `users` (filtered `role: 'student'`) |
| Stat: **Pending Requests** | **Dynamic** | filtered from `data.requests` | `GET /api/requests` | `requests` |
| Stat: **Pending Leaves** | **Dynamic** | filtered from `data.leaves` | `GET /api/leave` | `leaves` |
| Stat: **Active Notices** | **Dynamic** | `data.notices.length` | `GET /api/notices` | `notices` |
| **Recent Requests** list | **Dynamic** | first 5 of `data.requests` | `GET /api/requests` | `requests` |
| **Recent Leave Applications** | **Dynamic** | first 5 of `data.leaves` | `GET /api/leave` | `leaves` |

---

## Per-Element Detail (the six requested areas)

### 1. Notices
- **Static or dynamic?** **Dynamic.**
- **Where does the data come from?** The `Notice` collection in MongoDB. `Dashboard.jsx`
  fetches in a `useEffect`: `apiCall('/notices').then(... setNotices(res.data.notices))`.
- **API endpoint:** `GET /api/notices` (`backend/routes/notices.js`). For students it returns
  `Notice.find({ isActive: true }).sort({ pinned: -1, createdAt: -1 })`.
- **MongoDB collection:** `notices`.
- **On the dashboard it appears twice:** the **"Notices" stat card** (just `notices.length`)
  and the **"Recent Notifications"** panel (`notices.slice(0, 3)` with `timeAgo`).

### 2. Announcements
- **Static or dynamic?** **Dynamic** — "Announcements" and "Notices" are the **same data**
  in this app. There is no separate announcements feature; the `Notice` model carries a
  `category` field (e.g. `general`), so announcements are simply notices.
- **Where / endpoint / collection:** identical to Notices above — `GET /api/notices` →
  `notices` collection. (Filterable by `?category=` on the backend, though the dashboard
  doesn't pass one.)

### 3. Statistics (the stat cards)
- **Static or dynamic?** **Dynamic** (all four cards).
- **Where does the data come from?**
  - Cards 1–3 (My Requests / Completed / In Progress) come from the `requests` collection via
    server-side `countDocuments`.
  - Card 4 (Notices) comes from `notices.length`.
- **API endpoint:** `GET /api/requests/stats` for cards 1–3; `GET /api/notices` for card 4.
- **MongoDB collection:** `requests` (cards 1–3), `notices` (card 4).
- **Note:** before the fetch resolves, the cards render the placeholder `—` (`statVal` returns
  `—` while `stats` is `null`), so the UI is never blank — it just isn't hardcoded data.

### 4. Request counts
- **Static or dynamic?** **Dynamic.**
- **Where does the data come from?** The `requests` collection, counted server-side.
- **API endpoint:** `GET /api/requests/stats` (`backend/routes/requests.js`):
  ```js
  const filter = req.user.role === 'admin' ? {} : { student: req.user._id };
  Request.countDocuments(filter)                                   // total
  Request.countDocuments({ ...filter, status: 'Completed' })       // completed
  Request.countDocuments({ ...filter, status: {$in:['Under Review','Processing','Ready for Collection']} }) // inProgress
  Request.countDocuments({ ...filter, status: 'Submitted' })       // pending
  ```
- **MongoDB collection:** `requests`.
- **Per-user scoping:** a **student** sees only their own counts (`student: req.user._id`); an
  **admin** sees all. Correct and secure — the count is derived from the JWT identity, not from
  anything the client sends.

### 5. User counts
- **Static or dynamic?** **Dynamic** (admin only — there is no user count on the *student* dashboard).
- **Where does the data come from?** The `users` collection. The admin **"Total Students"**
  card uses `data.students.length`.
- **API endpoint:** `GET /api/students` (`backend/routes/students.js`, `adminOnly`), which
  returns `User.find({ role: 'student' }).select('-password')` plus a `count`.
- **MongoDB collection:** `users` (filtered to `role: 'student'`, so admins aren't counted).

### 6. Recent activity
- **Static or dynamic?** **Mixed — mostly dynamic, with two hardcoded panels.**
- **Dynamic recent activity:**
  - **Recent Notifications** (student dashboard) → `notices.slice(0,3)` from `GET /api/notices` → `notices`.
  - **Recent Requests** and **Recent Leave Applications** (admin overview) → first 5 of the
    live arrays from `GET /api/requests` (`requests`) and `GET /api/leave` (`leaves`).
- **Hardcoded "activity" (⚠️ findings):**
  - **🎉 Upcoming Events** (student dashboard) — three events are written directly into the
    JSX (`Tech Symposium 2026 · 15 JUN`, `Cultural Fest · 20 JUN`, `Placement Training · 25
    JUN`). **No** API call is made for them, even though `GET /api/events` and the `Event`
    collection exist and are already used by the Events page and admin Events tab.
  - **📄 Marksheet Status** (student dashboard) — the four-step progress (Application Received
    → Under Verification → Processing → Ready for Collection) is fixed JSX. It does **not**
    reflect the logged-in student's real request status, which lives in the `requests`
    collection.

---

## What happens when a new user registers?

**Flow:** `POST /api/auth/register` validates the input, bcrypt-hashes the password (pre-save
hook), and creates a document in the **`users`** collection with `role: 'student'` and
`isActive: true`, then returns a JWT.

**Effect on each dashboard element:**

| Element | Does it change for the new user / admin? |
|---|---|
| **Welcome banner** | Shows the new user's name immediately (from the login/register response cached in `localStorage`). |
| **My Requests / Completed / In Progress** | All show **0** — a brand-new student has no documents in `requests` yet. Counts are live, so they update the moment the student raises a request. |
| **Notices count + Recent Notifications** | Show the **global active notices** right away (notices aren't per-user). |
| **Admin → Total Students** | **Increments by 1** on the admin's next load, because `GET /api/students` now returns one more `role: 'student'` document. ✅ Fully dynamic. |
| **Admin → Recent Requests / Leaves** | Unchanged by registration alone (the new student has none yet); they appear once the student submits something. |
| **Upcoming Events (hardcoded)** | **No change ever** — not data-driven. |
| **Marksheet Status (hardcoded)** | **No change ever** — not data-driven; identical for every user. |

**Conclusion:** registration correctly and automatically flows into every *dynamic* element
(especially the admin **Total Students** count). It has **no** effect on the two hardcoded
panels — which is precisely why they're flagged below.

---

## What should be moved to MongoDB?

Only **two** elements are hardcoded and genuinely *should* be data-driven. (The Quick
Access / Mobile Action tiles are also hardcoded, but those are **navigation links**, not
data — leaving them static is correct and they are **not** recommended for migration.)

### Priority 1 — "Upcoming Events" card (`Dashboard.jsx` lines ~143–166)
- **Current:** three events hardcoded in JSX (dates, titles, venues, badges).
- **Why move it:** an `Event` model **and** `GET /api/events` endpoint **already exist** and
  are already consumed elsewhere (Events page, admin Events tab). The dashboard is the only
  place still showing fake events, so they can drift out of date and contradict the real
  Events page.
- **How (low effort):** fetch in the existing `useEffect`
  (`apiCall('/events').then(res => setEvents(res.data.events))`), then render the soonest 2–3
  upcoming events instead of the literal markup. **No backend work required.**
- **Collection:** `events`.

### Priority 2 — "Marksheet Status" stepper (`Dashboard.jsx` lines ~184–190)
- **Current:** a fixed 4-step progress bar identical for every user.
- **Why move it:** it implies a personalised request status but is static, so it's misleading —
  it can show "Processing" to a student who has no marksheet request at all. The real,
  per-user status already exists in the `requests` collection (with a richer 6-stage `status`
  enum).
- **How:** fetch the student's latest marksheet/document request (e.g. reuse
  `GET /api/requests`, take the most recent of `type: 'Marksheet'`) and drive the stepper from
  its `status` field; hide the card when the student has no such request.
- **Collection:** `requests` (already has the data and the endpoint).

### Not recommended for migration (intentionally static)
- **Quick Access grid** and **Mobile Quick Actions** — static arrays of route links/icons.
  These are UI navigation, not data; keeping them in code is the right call.

---

## Overall Assessment

The CampusAssist dashboard is **predominantly dynamic and correctly wired to MongoDB**:
request counts, user counts, notices, announcements, and the admin recent-activity feeds all
read live data through proper authenticated endpoints, with sensible per-user scoping and
loading placeholders. The data layer is sound.

The **only** gaps are two **presentation-layer placeholders** on the student dashboard —
**Upcoming Events** and **Marksheet Status** — that were left as static JSX even though the
backing collections (`events`, `requests`) and endpoints already exist. Both are
**frontend-only** fixes (no new models or routes needed) and are the recommended migrations.

**Dynamic coverage of data elements:** ~10 of 12 (the two exceptions are the hardcoded panels;
the static Quick-Access tiles are navigation, not data).
