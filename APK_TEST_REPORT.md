# APK Device Test Report

**Date:** 2026-06-13 · **Result: ✅ ALL DEVICE TESTS PASSED**

## Test environment — a real installed APK, not a browser simulation

- **Device:** Android emulator `campus_test` — Pixel 5, Android 15 (google_apis x86_64), booted headless
- **App under test:** the actual built artifact `app-debug.apk` (4.2 MB), installed via `adb install` (`Performing Streamed Install … Success`)
- **Backend:** the **live production API** (`https://college-helpdesk-chatbot-l4bk.onrender.com/api`) — real network, real database
- **Test driver:** Chrome DevTools Protocol into the Capacitor WebView (`adb forward` → puppeteer-core), driving the app exactly as a user would. Scripts: `audit-device-test.js`, `audit-device-retest.js`. Screenshots: `device-screenshots/`.

## Results

| Check | Result | Evidence |
|---|---|---|
| App installs & launches | ✅ | `MainActivity` resumed; Capacitor serving local assets at `https://localhost/` |
| Landing page | ✅ | Hero, CTA buttons, styling render correctly (`01-landing` + adb screencap) |
| **Login** (live API) | ✅ | `192221001` → redirected to `/dashboard` (`03-dashboard`) |
| **Registration** (live API write) | ✅ | Disposable account `TEST7341` created — "Account Created! 🎉" success screen shown (`09-after-register`); account verified in DB via admin search, then **deactivated** (cleanup) |
| **Navigation** | ✅ | Bottom nav → `/requests`; chat FAB → `/chat`; client-side routing works in the WebView |
| **Dashboard** | ✅ | 4+ stat cards populated from the live API |
| **Requests** | ✅ | "My Requests" list renders; "+ New Request" modal opens with form (`04-requests-modal`). (No test request written to production data) |
| **Chatbot** (live API) | ✅ | Sent "library timings" → bot replied "Library hours: Mon–Fri 8 AM–6 PM…" (`05-chat`) |
| **Admin features** | ✅ | ADMIN01 login → `/admin`; overview stats render; hamburger sidebar → Students tab with **1,011 live rows** (`06`/`07`) |
| **API communication** | ✅ | All requests from WebView origin `https://localhost` → hosted HTTPS API; CORS clean; zero failed calls |
| **Database operations** | ✅ | Reads (dashboard/requests/students/notices) + write (registration) against the production MongoDB |
| Console errors on device | ✅ none | Zero `pageerror`/`console.error` across every flow (only harmless emulator font-lookup noise in logcat) |

## Notes

1. One initial test "failure" was a **test-script expectation error**, not an app bug: registration shows an in-place "Account Created!" success screen rather than navigating away. Confirmed working by screenshot + the account existing in the database.
2. Production data hygiene: the only write was the clearly-labeled `TEST7341` ("APKTest DeleteMe"), deactivated immediately via the admin API. No requests/notices/leaves were created.
3. Render free tier: the backend cold-starts (~22 s) after idle; the test pre-warmed it. Real users may see a slow first login after idle periods — known platform behavior, not an app defect.

## Final verdict

| | |
|---|---|
| ✓ APK Generated | `frontend/android/app/build/outputs/apk/debug/app-debug.apk` (4.2 MB) |
| ✓ APK Tested | installed + all functional flows passed on Android 15 emulator against the live backend |
| ✓ Android Ready | yes — toolchain installed, emulator AVD `campus_test` available for future testing |
| ✓ Production Ready | yes for testing/distribution of the debug build; **create a release keystore before public distribution** (`ANDROID_DEPLOYMENT_GUIDE.md`) |
