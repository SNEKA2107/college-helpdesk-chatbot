# Settings Feature — Fix Report

**Date:** 2026-07-23 · **Scope:** Settings functionality only · **Build:** v1.0-rc1 branch

## Flow traced (Task 1)
| Layer | Finding |
|-------|---------|
| **Frontend route** | `/student/settings` was mapped to `['settings', Profile]` in `AppRoutes.jsx` — an **alias to the Profile component**. |
| **Component rendering** | It rendered the exact `Profile` page: topbar title **"My Profile"**, same 8 cards (Account Details, Parent Details, Activity, Edit Profile, Edit Parent, Change Password, Password Requirements, Quick Links). Confirmed byte-identical to `/student/profile` via browser inspection. |
| **API calls** | Same as Profile: `GET /auth/me`, `GET /requests/stats`, `PUT /auth/profile`, `PUT /auth/change-password` — all returned 200. |
| **Backend route** | `PUT /api/auth/profile` and `PUT /api/auth/change-password` work correctly (no backend defect). |
| **Database** | Persistence works; no DB defect. |

## Root cause (Task 2)
**There was no real Settings feature.** `/student/settings` was a placeholder alias that rendered the `Profile` component verbatim (the route table even carried the comment *"settings reuses the Profile/account page — no separate settings screen exists yet"*). Clicking **Settings** in the sidebar took the user to a page titled **"My Profile"** with the profile UI — so Settings appeared broken/non-functional even though nothing crashed.

**Secondary risk discovered:** `PUT /auth/profile` is an **overwrite** endpoint — it rewrites `name`, `phone`, `semester`, and all parent fields, defaulting any omitted field to `''`. Any Settings save had to send the preserved fields back or it would silently wipe the student's semester/parent data.

## Fix applied (Task 3)
Created a dedicated, distinct **Settings** page that reuses existing functionality and design language — no new module, no redesign, no business-logic change:
- **Account Settings** — edit Full Name + Phone (Register No. and Email shown read-only). Save sends the **full preserved profile payload** (semester + all parent fields) so nothing is wiped.
- **Change Password** — reuses `PUT /auth/change-password` with client-side validation.
- **Appearance** — theme selector (Dark / Light / Night) via the existing `useTheme` hook.

Reuses `Layout`, `apiCall`, `getUser`, `useToast`, `useTheme`, and existing CSS classes. `Profile.jsx` was **not touched** (Profile remains the "My Profile" view).

## Files modified (Task 4)
| File | Change |
|------|--------|
| `frontend/src/pages/Settings.jsx` | **New** — dedicated Settings page (account settings, password, appearance) |
| `frontend/src/routes/AppRoutes.jsx` | Import `Settings`; changed `['settings', Profile]` → `['settings', Settings]`; removed the stale "reuses Profile" comment |

No other files changed. No unrelated code modified.

## Verification results (Task 5 & 6)
Browser E2E (Playwright) + DB checks + tests/build — **all green**:

| Check | Result |
|-------|--------|
| Settings page loads (`/student/settings`) | ✅ |
| Distinct title **"Settings"** (not "My Profile") | ✅ topbar = "Settings" |
| Distinct content (Account Settings + Appearance cards) | ✅ |
| **Save works** (Account Settings) | ✅ "Settings saved successfully" |
| **Data persists** after reload | ✅ phone retained |
| **No data loss** — semester/parent fields preserved | ✅ semester "5th" intact after save |
| Theme/appearance setting applies | ✅ `data-theme` switches |
| Password mismatch validated | ✅ inline error shown |
| **No console errors** | ✅ 0 |
| **No API errors** | ✅ 0 (no 4xx/5xx) |
| Profile page unchanged (still "My Profile") | ✅ regression-safe |
| Backend test suite | ✅ **9/9 passing** |
| Production build | ✅ clean (Settings chunk 5.05 KB / 1.61 KB gz) |

**Cleanup:** the demo student's phone (changed during testing) was restored to its original value; no test residue.

## Outcome
Settings is now a **genuine, distinct, working feature**: it loads its own page, saves account changes, persists to the database without wiping other data, lets students change their password and theme, and produces no console or API errors — while the Profile page is untouched.
