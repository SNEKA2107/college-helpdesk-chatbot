# React Migration Status (working notes)

Vite + React 18 + react-router 6 app in `frontend/`. Old static frontend remains at repo root (untouched).

**STATUS: COMPLETE.** All 20 pages ported, build passes, E2E verified (see below). See `README.md` for run + APK instructions.

## Conventions
- Pages port legacy HTML 1:1 (markup → JSX, inline scripts → hooks/state). Visual design unchanged.
- `src/styles/global.css` = copy of root `style.css`, imported in main.jsx along with `components.css` (shared req-card + modal styles).
- Per-page legacy `<style>` blocks → `src/styles/<page>.css` (side-effect import, unique class names) or `*.module.css` for auth pages (Login/Register) because their styles collide with global.css. Landing styles are scoped under a `.landing` wrapper class (its CSS variables differ from global.css `:root`).
- Layout (`components/Layout.jsx`) = sidebar + topbar + bottom nav + GSAP page animations; used by all student pages. Title prop = legacy `.page-title`. Admin has its own shell in `pages/Admin.jsx` (tab-based sidebar, no Layout).
- API: `services/api.js` (`apiCall`, API_BASE resolves: VITE_API_URL → Capacitor native → localhost:5000 → '/api'). Auth: `services/auth.js`.
- Login error case must use raw fetch (apiCall's 401 handling would redirect).
- Routes in `routes/AppRoutes.jsx` (lazy pages, RequireAuth/RequireAdmin/RedirectIfAuthed guards in `routes/guards.jsx`).
- Admin credentials for testing: ADMIN01 / admin@123; student: 192221001 / student123.

## Pages — all done
- [x] Login, Register, Dashboard, Requests, Chat, Notices, Attendance, Exam, Fees, Timetable
- [x] Status, Cgpa, Leave, Od, Events, Library, Contact
- [x] Profile (photo upload w/ canvas resize, parent details, change password)
- [x] Landing (styles/landing.css scoped under .landing; loader + GSAP ScrollTrigger animations)
- [x] Admin (pages/Admin.jsx shell + pages/admin/*Tab.jsx — 10 tabs: overview/requests/leaves/notices/messages/students/exams/attendance/events/timetable; shared badge maps in pages/admin/shared.js)

## Post-page checklist — done
1. [x] `npm run build` passes clean.
2. [x] E2E: `node test-react-e2e.js` (repo root) against `npx vite preview` (4173) + local backend (5000). Verifies landing, student login → dashboard → profile, admin login + all tabs. Zero console/network errors.
3. [x] Capacitor: @capacitor/core+cli+android installed, `capacitor.config.json` (appId com.campusassist.app, webDir dist, androidScheme https). Backend `server.js` allowedOrigins now includes localhost:5173/4173, https://localhost, capacitor://localhost.
4. [x] `frontend/README.md` with run + APK steps. Render still serves the legacy static files; switching the deploy to the React build is optional/documented separately.
