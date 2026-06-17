# CampusAssist — React Frontend

React 18 + Vite migration of the CampusAssist college helpdesk frontend. Same UI/UX, design system (Dark / Light / Night themes) and responsiveness as the legacy static site, rebuilt with functional components, hooks and React Router 6, and structured for Capacitor APK packaging.

## Project structure

```text
src/
├── components/   # Layout, Sidebar, Topbar, BottomNav, Modal, AuthThemeButton
├── pages/        # One component per page (20 pages); pages/admin/ = admin panel tabs
├── styles/       # global.css (design system) + per-page css / css-modules
├── hooks/        # useTheme, useToast, usePageAnimations, useUnreadNotices
├── utils/        # bot.js (chatbot brain), format.js, sound.js
├── services/     # api.js (apiCall + API base resolution), auth.js (session)
└── routes/       # AppRoutes.jsx (lazy routes), guards.jsx (auth/admin guards)
```

## Run locally

```bash
# 1. Start the backend (serves the API on port 5000)
cd backend
npm install
node server.js

# 2. Start the React app
cd frontend
npm install
npm start          # opens Vite dev server on http://localhost:5173
```

Production build:

```bash
npm run build      # outputs to frontend/dist
npm run preview    # serve the build locally on http://localhost:4173
```

The API base URL resolves automatically (`src/services/api.js`):
`VITE_API_URL` env var → Capacitor native (hosted Render API) → `http://localhost:5000/api` when running on a Vite port → same-origin `/api` otherwise.

## Build an Android APK (Capacitor)

Prerequisites: Android Studio (with Android SDK) installed. Capacitor packages and `capacitor.config.json` (appId `com.campusassist.app`, webDir `dist`) are already set up.

```bash
cd frontend

# 1. Build the web app
npm run build

# 2. Add the Android platform (first time only — creates frontend/android/)
npx cap add android

# 3. Copy the web build + plugins into the Android project (repeat after every build)
npx cap sync android

# 4. Open in Android Studio
npx cap open android
```

In Android Studio: **Build → Build App Bundles / APK(s) → Build APK(s)**.
The APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`.

Or build from the command line without opening Android Studio:

```bash
cd android
./gradlew assembleDebug        # gradlew.bat assembleDebug on Windows
```

For a signed release APK, create a keystore and use **Build → Generate Signed Bundle / APK** in Android Studio (or configure `signingConfigs` in `android/app/build.gradle` and run `gradlew assembleRelease`).

Notes for mobile builds:
- The native app talks to the hosted API on Render (no localhost backend needed on the phone).
- The backend CORS allowlist already includes the Capacitor WebView origins (`https://localhost`, `capacitor://localhost`).
- After changing web code, always run `npm run build && npx cap sync android` before rebuilding the APK.

## Test accounts

| Role    | ID        | Password   |
|---------|-----------|------------|
| Student | 192221001 | student123 |
| Admin   | ADMIN01   | admin@123  |


Updated documentation as part of Git/GitHub collaboration workflow exercise.