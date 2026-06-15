# DASHBOARD REALISM REPORT — Phase 4

**Date:** 2026-06-15 · **Scope:** Notification indicator

## Problem
`Topbar.jsx` rendered a permanent red dot (`<span className="notif-dot">`) next to the bell — shown **always**, even with zero unread notices. A correct numeric unread badge already sat beside it, so the UI showed "dot present, count 0": a fake "always notifying" indicator.

## Fix
- **Removed the permanent dot.** The bell now shows **only** the numeric unread badge, and only when `unread > 0`.
- Added a contextual `title` ("N unread notices" / "Notices") for accessibility.
- Removed the leftover static dot in the hidden mobile header (`Dashboard.jsx`) for consistency.

The unread count is **MongoDB-driven**: `useUnreadNotices` fetches notices from `GET /api/notices` (server already filters to published, non-expired, audience-matched) and subtracts locally read IDs. No fabricated/urgency indicators remain.

```jsx
// before:  🔔<span className="notif-dot"></span> {unread>0 && <badge/>}
// after:   🔔 {unread > 0 && <badge>{unread>9?'9+':unread}</badge>}
```

## Verification
| State | Before | After |
|-------|--------|-------|
| 0 unread | red dot always visible | clean bell, no indicator ✅ |
| 1–9 unread | dot + count (redundant) | count badge only ✅ |
| >9 unread | dot + "9+" | "9+" badge only ✅ |
| Source of truth | static markup | MongoDB notices − read state ✅ |

- `npm run build` ✅.

## Files changed
- `frontend/src/components/Topbar.jsx` · `frontend/src/pages/Dashboard.jsx`

## Collections / APIs
No change. Reads `GET /api/notices`. Collection: `notices`.
