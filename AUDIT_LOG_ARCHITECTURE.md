# AUDIT LOG ARCHITECTURE — Phase 2 (H5)

**Date:** 2026-06-14 · **Status:** Implemented & verified.

## Model (`backend/models/AuditLog.js`)
```js
{
  actor:     ObjectId(ref User),   // the admin who acted
  actorName: String,               // readable name
  actorId:   String,               // admin's studentId (e.g. ADMIN01)
  action:    String,               // 'timetable.publish', 'registration.approve', …
  entity:    String,               // 'Timetable' | 'Exam' | 'User' | 'Leave' | 'Notice' | 'Event'
  entityId:  String,               // affected document id
  details:   Mixed,                // small contextual snapshot
  timestamp: Date (default now),
}  // indexes: { timestamp:-1 }, { entity:1, timestamp:-1 }
```
Stored fields satisfy the requirement: **Admin ID, Action, Timestamp, Entity affected** (plus actor name and a details snapshot).

## Helper (`backend/utils/audit.js`)
`logAudit(req, action, entity, entityId, details)` — reads `req.user` for the actor and writes the entry. **Fire-and-forget**: wrapped in try/catch so an audit failure can never break the underlying business action.

## Logged actions (coverage requested)
| Area | Actions |
|------|---------|
| Timetable changes | `timetable.create`, `timetable.update`, `timetable.publish`, `timetable.archive` |
| Exam changes | `exam.create`, `exam.update`, `exam.publish`, `exam.archive` |
| Registration approvals | `registration.approve`, `registration.reject` |
| Leave approvals | `leave.decision` (status in details) |
| OD approvals | `od.decision` (OD distinguished from leave) |
| Notice creation | `notice.create` |
| Announcement/Event creation | `event.create` |

## Access (`GET /api/audit`)
Admin-only. Returns newest-first, optional `?entity=` filter and `?limit=` (max 500). Surfaced in a new **read-only Audit Log** admin tab (`AuditTab.jsx`) with an entity filter and refresh; columns: When · Admin · Action · Entity · Details.

## Security / integrity
- Write path is server-side only (no client can forge entries); `GET /api/audit` is `protect + adminOnly` (verified: student → 403).
- Entries are append-only (no update/delete endpoints exposed).

## Verification (live API)
- ✅ After exercising the workflows, `/api/audit` contained `timetable.create/publish/archive`, `exam.create/publish`, `registration.approve/reject`.
- ✅ A sampled entry carried actor (`ADMIN01`), timestamp, entity, and entityId.
- ✅ Non-admin blocked from `/api/audit` (403).

*Verification only — DO NOT COMMIT.*
