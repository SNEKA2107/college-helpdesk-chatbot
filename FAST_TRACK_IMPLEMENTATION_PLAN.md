# FAST TRACK IMPLEMENTATION PLAN — Top 20% (80% of visible value)

**Date:** 2026-06-14 · The 5 items below are the entire planned change set. All sit inside the approved focus list; everything else is deferred/excluded. Total est. ~70 min + verify/build.

| # | Item | Files | Approach | Preserves |
|---|------|-------|----------|-----------|
| **FT1** | Exam instructions dynamic | `frontend/src/pages/Exam.jsx` | Render `exam.instructions` from DB (split into two columns); keep a small default only if empty | API, UI structure |
| **FT2** | Event registration server-driven | `frontend/src/pages/Events.jsx` | Derive registered state from `event.registrations` (server) keyed on `getUser()._id`; refetch after toggle; drop `localStorage` | `/events` API, auth |
| **FT3** | Chatbot dynamic facts | `backend/routes/chat.js` | Build a live `facts` block from latest **published** Exam, the user's Fee, and recent Notices; feed it to the AI system prompt AND the keyword fallback; remove hardcoded sem-V dates/fees | route signature, auth |
| **FT4** | Landing fake content | `frontend/src/pages/Landing.jsx` | Replace fabricated `TESTIMONIALS`/`STATS` with honest, non-numeric feature copy (no invented metrics or quotes) | UI structure |
| **FT5** | Real print workflows | `frontend/src/pages/Exam.jsx`, `Fees.jsx` | Hall-ticket & receipt buttons call `window.print()` (real, browser-native) instead of fake toasts | UI |

## Guardrails
- No new collections, no auth/permission/role changes, no API removal.
- New users still see clean empty states (already true from Phase 1).
- Admin-created data (exam instructions, events, notices) flows to students.
- Each item independently revertible; verify after.

## Out of scope (explicit)
Pagination, CSP, security hardening, refactors, perf, fee/student CRUD, JWT, structured OD, Config-model for contact/library — all DEFERRED/EXCLUDED.

*Treating the user's focus list as approval; proceeding to implement.*
