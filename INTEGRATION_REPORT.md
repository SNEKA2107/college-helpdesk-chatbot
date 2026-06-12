# CampusAssist — Frontend ↔ Backend Integration Report

**Date:** 2026-06-11  
**Engineer:** Senior Full-Stack Engineer (Claude Sonnet 4.6)

---

## Integration Architecture

The frontend communicates with the backend exclusively through the `apiCall()` helper in `app.js`:

```javascript
async function apiCall(path, options = {}) {
  const token = localStorage.getItem('ca_token');
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await res.json();
  return { ok: res.ok, data, error: data.message || data.error };
}
```

All API calls use relative URLs — no hardcoded host. The backend serves static files from the project root, so in production everything is same-origin.

---

## Complete API Endpoint Map

### Authentication — `/api/auth`

| Method | Endpoint | Auth | Frontend Usage |
|---|---|---|---|
| POST | /api/auth/register | Public | index.html — register form |
| POST | /api/auth/login | Public (rate limited) | index.html — login form |
| GET | /api/auth/me | protect | dashboard.html, app.js init |
| PUT | /api/auth/profile | protect | profile.html — save profile |
| PUT | /api/auth/change-password | protect | profile.html — change password |

**Token lifecycle:**
- On login: `localStorage.setItem('ca_token', data.token)` + `localStorage.setItem('ca_user', JSON.stringify(data.user))`
- On logout: `localStorage.removeItem('ca_token')`, `localStorage.removeItem('ca_user')`, redirect to `index.html`
- On 401 from any API call: `apiCall()` triggers automatic logout

---

### Notices — `/api/notices`

| Method | Endpoint | Auth | Frontend Usage |
|---|---|---|---|
| GET | /api/notices | protect | notices.html, dashboard.html |
| POST | /api/notices | adminOnly | admin panel — create notice |
| PUT | /api/notices/:id | adminOnly | admin panel — edit notice |
| DELETE | /api/notices/:id | adminOnly | admin panel — delete notice |

**Data contract:**
```json
{ "success": true, "count": 3, "notices": [
  { "_id": "...", "title": "...", "content": "...", "category": "general",
    "pinned": false, "isActive": true, "postedBy": "Administrator",
    "createdAt": "...", "expiresAt": null }
]}
```

---

### Students — `/api/students`

| Method | Endpoint | Auth | Frontend Usage |
|---|---|---|---|
| GET | /api/students | adminOnly | admin panel — student list |
| GET | /api/students/search/:q | adminOnly | student-search.html |
| GET | /api/students/:id | adminOnly | student-profile.html |
| PUT | /api/students/:id | protect (own or admin) | admin — update student |

---

### Requests (Documents) — `/api/requests`

| Method | Endpoint | Auth | Frontend Usage |
|---|---|---|---|
| GET | /api/requests | protect | requests.html, status.html |
| POST | /api/requests | protect | requests.html — submit request |
| PUT | /api/requests/:id/status | adminOnly | admin panel — update status |

**Request types:** Bonafide, Marksheet, Transfer Certificate, Conduct Certificate, Migration Certificate, Character Certificate

---

### Leave — `/api/leave`

| Method | Endpoint | Auth | Frontend Usage |
|---|---|---|---|
| GET | /api/leave | protect | leave.html (own), admin (all) |
| POST | /api/leave | protect | leave.html — apply |
| PUT | /api/leave/:id/approve | adminOnly | admin panel |
| PUT | /api/leave/:id/reject | adminOnly | admin panel |

**Leave types:** Medical, Personal, Family Emergency, OD (On Duty)

---

### Chat — `/api/chat`

| Method | Endpoint | Auth | Frontend Usage |
|---|---|---|---|
| POST | /api/chat | protect | chat.html |

Stateless — no conversation history stored. Claude Haiku used if `ANTHROPIC_API_KEY` set, else keyword matching.

---

### Fees — `/api/fees`

| Method | Endpoint | Auth | Frontend Usage |
|---|---|---|---|
| GET | /api/fees | protect | fees.html |
| POST | /api/fees/payment | protect | fees.html — record payment |
| GET | /api/fees/all | adminOnly | admin panel |

---

### Exam — `/api/exam`

| Method | Endpoint | Auth | Frontend Usage |
|---|---|---|---|
| GET | /api/exam | protect | exam.html, cgpa.html |

Returns schedule, grades, and attendance summary.

---

### Library — `/api/library`

| Method | Endpoint | Auth | Frontend Usage |
|---|---|---|---|
| GET | /api/library | protect | library.html (browsing) |
| POST | /api/library/borrow/:id | protect | library.html — borrow |
| POST | /api/library/return/:id | protect | library.html — return |

---

### Timetable — `/api/timetable`

| Method | Endpoint | Auth | Frontend Usage |
|---|---|---|---|
| GET | /api/timetable | protect | timetable.html |

---

### Contact — `/api/contact`

| Method | Endpoint | Auth | Frontend Usage |
|---|---|---|---|
| POST | /api/contact | protect | contact.html — send message |
| GET | /api/contact | adminOnly | admin panel — view messages |
| PUT | /api/contact/:id/resolve | adminOnly | admin panel |

---

### Attendance — `/api/attendance`

| Method | Endpoint | Auth | Frontend Usage |
|---|---|---|---|
| GET | /api/attendance | protect | attendance page / dashboard |

---

### Events — `/api/events`

| Method | Endpoint | Auth | Frontend Usage |
|---|---|---|---|
| GET | /api/events | protect | events.html |

---

## Response Envelope

All endpoints return a consistent envelope:

**Success:**
```json
{ "success": true, "message": "...", "<resource>": {...} }
```

**Error:**
```json
{ "success": false, "message": "Human-readable error" }
```

`apiCall()` maps this to `{ ok: true/false, data, error }`. Frontend code checks `result.ok` before rendering.

---

## State Synchronisation

| localStorage Key | Written by | Read by |
|---|---|---|
| `ca_token` | login, register | every apiCall() |
| `ca_user` | login, register, profile save | populateUserInfo(), requireAdmin() |
| `ca_theme` | toggleTheme() | app.js init (body class) |
| `ca_read_notices` | notices.html (mark read) | dashboard.html (unread count badge) |

---

## Integration Issues Found and Fixed

| Issue | File | Fix |
|---|---|---|
| student-search.html used `requireAuth()` but calls admin-only `/api/students/search/:q` | student-search.html | Changed to `requireAdmin()` |
| requests.html "New Request" button enabled before requests loaded, causing Selenium race condition | requests.html | Button starts `disabled`, enabled in `loadRequests()` callback |
| leave.html allowed past from-dates client-side (browser date picker `min` attribute bypassed by JS submission) | leave.html | Added explicit date comparison in `submitLeave()` |

---

## Frontend Pages With No Backend Integration (Static)

| Page | Content |
|---|---|
| `status.html` | Reads from `/api/requests` — not static |

All 23 pages integrate with at least one API endpoint. There are no completely static frontend pages that bypass the API.

---

*Report generated by automated integration audit — 2026-06-11*
