# CampusAssist — Feature Value Report

**Date:** 2026-06-12 · **Nothing removed — analysis only.**

Rating: ★★★★★ Essential · ★★★★☆ Valuable · ★★★☆☆ Optional · ★★☆☆☆ Low Value · ★☆☆☆☆ Remove Candidate

---

## Feature inventory

| Feature | Rating | Evidence / Notes |
|---|---|---|
| Authentication (login/register/JWT) | ★★★★★ | Core gate for everything; 1001 seeded users |
| Role-based access (student/admin) | ★★★★★ | `adminOnly` enforced; verified at runtime |
| Document requests (bonafide, marksheet…) | ★★★★★ | Real helpdesk core; full CRUD + status workflow + email |
| Leave application + admin approval | ★★★★★ | Complete workflow with email notification |
| Notices board (+ admin manage) | ★★★★☆ | Pinning, categories, XSS-safe; drives the notification bell |
| Fees view | ★★★★☆ | Components, history, balance computed server-side |
| Fee self-payment | ★★☆☆☆ | Simulated payment with no gateway; security concern (see SECURITY_REVIEW FIN-01). Valuable *as a demo*, low value as real money handling |
| Attendance (summary + admin marking + bulk) | ★★★★☆ | Subject-wise %; bulk marking is a nice admin touch |
| Timetable (weekly + today) | ★★★★☆ | Dept/semester aware; `/today` is a clean extra |
| Exam schedule | ★★★★☆ | Theory/practical/instructions |
| Library (catalog, borrowed, renew) | ★★★☆☆ | Catalog + borrow tracking solid; "renew" is a stub that just returns a message (no state change) |
| Contact office | ★★★★☆ | Student→admin messaging with resolve |
| Events (register/unregister, seats) | ★★★☆☆ | Seat limits + dedupe; good but peripheral to a helpdesk |
| Chatbot (Claude + keyword fallback) | ★★★★☆ | Graceful AI-optional design; impressive for a demo |
| CGPA calculator (cgpa.html) | ★★★☆☆ | Client-side utility; no backend |
| PWA (manifest + service worker) | ★★★★☆ | Installable, offline-cache shell; strong polish signal |
| Theming (dark/light/night) | ★★★☆☆ | Nice UX polish |
| Toasts / sound / GSAP animations | ★★★☆☆ | Presentation polish; impresses evaluators |
| Mobile bottom-nav + responsive | ★★★★☆ | Real mobile UX, injected by `app.js` |

---

## Dead / redundant / over-engineered (do not remove — flagged only)

| Item | Class | Evidence |
|---|---|---|
| `GET /api/exam/schedule`, `/api/exam/practicals` | Dead endpoint | Frontend fetches full `/api/exam`; sub-routes unused (`INTEGRATION_REVIEW INT-3`) |
| Client-side `botReplies` in `app.js:383` | Duplicate logic | Server `knowledgeBase` (`chat.js`) already covers this |
| `POST /api/library/renew/:id` | Stub | Returns a message, performs no DB change (`library.js:49`) |
| `generate-icons.js`, `screenshot-*.js`, `verify-*.js`, `test-*.js`, `open-*.js` | One-off dev tooling | Root-level scripts, not part of the app runtime |
| Duplicate profile-update paths | Redundant | `auth/profile` vs `students/:id` (`INT-2`) |
| `reset-admin.js`, `create-admin.js`, `seed.js`, `seed-students.js` | Ops scripts | Fine to keep, not app features |

---

## Over-engineering vs business value

The **core helpdesk loop** (requests, leave, notices, fees, attendance) is genuinely valuable and complete. The **polish layer** (PWA, theming, sound, GSAP, AI chat) is over-spec for a college assignment but is exactly what impresses evaluators — keep it. The only feature whose *value is negative* without a fix is **fee self-payment**, because it models money movement with no authorization (treat as labelled simulation).

**No removals recommended.** Optionally tidy: wire or delete the `renew` stub, drop unused `/exam/schedule|practicals`, and pick one profile-update endpoint.
