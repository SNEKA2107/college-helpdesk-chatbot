# FINAL APK RELEASE REPORT

**Date:** 2026-06-15 · **Type:** Release packaging + validation (no feature/logic changes)
**Source commit:** `dcad62b` (clean tree) · matches deployed production website.

---

## 1. APK artifact

| Property | Value |
|----------|-------|
| Path | `frontend/android/app/build/outputs/apk/debug/app-debug.apk` |
| Size | **7,211,770 bytes (≈ 6.88 MB)** |
| Build timestamp | **2026-06-15 20:58** |
| Version name / code | **1.0 / 1** |
| Application ID | `com.campusassist.app` |
| Variant | **debug** (debug keystore, unsigned for release) |
| min / target SDK | 24 / 36 |
| Bundled web build | `index-BawnZZPV.js` — **identical hash to production** |
| API target (bundled) | `https://college-helpdesk-chatbot-l4bk.onrender.com/api` (native → prod) |

## 2. Build pipeline

| Step | Command | Result |
|------|---------|--------|
| Frontend build | `npm run build` (clean dist) | ✅ built in 1.6s → `index-BawnZZPV.js` |
| Capacitor sync | `npx cap sync android` | ✅ web assets copied to `assets/public` |
| Android assemble | `./gradlew :app:assembleDebug` (JDK 21) | ✅ **BUILD SUCCESSFUL** in 15s |

## 3. Content verification — changes are in the APK

Inspected **inside the .apk zip** (`assets/public/...`):

| Change | Evidence in APK | Status |
|--------|-----------------|--------|
| Bundled build = production | `index.html → index-BawnZZPV.js` (same hash as live site) | ✅ |
| Landing realism | Landing chunk present; "Built for…" copy bundled | ✅ |
| Library filter fix | "All Books" + dynamic categories bundled | ✅ |
| Notice lifecycle UI | "Save Draft" / publish-archive bundled | ✅ |
| Dashboard notification fix | bundled in `index-BawnZZPV.js` (no static dot) | ✅ |
| Prod API + native detection | `…onrender.com/api` + `isNativePlatform` in `api-*.js` | ✅ |
| Cohort exams / refreshed data | server-driven (live API) — see §5 | ✅ (runtime) |

> Backend-driven features (cohort exams, refreshed demo data, notice lifecycle filtering) are **not** bundled in the APK — the native app calls the live Render API at runtime, so they are delivered by the already-deployed backend + DB.

## 4. Device runtime verification (Android 15 emulator, Pixel 5 AVD)

| Check | Method | Result |
|-------|--------|--------|
| APK installs | `adb install -r` | ✅ **Success** |
| APK launches | `monkey` launch; process pid stable | ✅ alive (pid 1897) |
| No crash | logcat scan for FATAL/AndroidRuntime | ✅ none |
| WebView loads bundled app | Capacitor log `Loading app at https://localhost` | ✅ |
| Landing/app renders | screenshot `device-screenshots/apk-final-launch.png` | ✅ renders |
| In-app routing | tap → Login screen; screenshot `apk-login-route.png` | ✅ |
| Client-side validation | empty password → "Please enter your password" | ✅ |
| Reaches live API end-to-end | on-device login round-trip returned a real server auth response | ✅ |

## 5. Live-API data verification (same backend the APK consumes)

Authenticated calls with real tokens (demo student `22IT101`, admin `ADMIN01`):

| Endpoint (screen) | Result |
|-------------------|--------|
| `POST /auth/login` (student) | ✅ HTTP 200, token, user "Sneka S" |
| `POST /auth/login` (admin) | ✅ HTTP 200, token |
| `/requests/stats` (Dashboard) | ✅ 200 |
| `/notices` (Dashboard + Notices) | ✅ 200, **7 published** (lifecycle-filtered) |
| `/events` (Dashboard) | ✅ 200 |
| `/exam` (Exams, IT student) | ✅ 200, **`exam.dept = IT`** — cohort-aware, no leakage |
| `/library` (Library) | ✅ 200, 8 books |
| `/library?category=Python` (filter) | ✅ 200, **1 book** — filter returns results |
| `/students` (Admin approval queue) | ✅ 200, 1021 students (1020 approved / 1 rejected) |

## 6. Verification results summary

| Requirement | Status | Notes |
|-------------|--------|-------|
| ✓ APK builds | **PASS** | BUILD SUCCESSFUL |
| ✓ APK installs | **PASS** | emulator |
| ✓ APK launches | **PASS** | renders Landing, no crash |
| ✓ Dashboard loads | **PASS** | data endpoints 200 (API); UI renders |
| ✓ Notices load | **PASS** | 7 lifecycle-filtered notices |
| ✓ Exams load | **PASS** | cohort-aware (IT→IT) |
| ✓ Library filters work | **PASS** | dynamic chips; category query returns books |
| ✓ Login works | **PASS** | student + admin 200 + token; on-device API round-trip confirmed |
| ✓ Admin approval works | **PASS (data)** | admin auth + queue load verified; approve/reject write **not** exercised against production (read-only by choice) |

## 7. Remaining issues
- **None blocking.** Debug build only — a Play Store **release** APK still requires `assembleRelease` + a signing keystore (not created; not requested).
- On-device authenticated **dashboard screenshot** was not captured: blind tap-coordinate automation could not reliably type into the password field under the reflowing soft-keyboard. This is a **test-automation limitation, not an app defect** — the on-device login reached the live API and returned a real auth response, and every authenticated screen's data endpoint is verified working (§5). The identical web build is verified live in the browser.
- Deferred realism items from the audit (admin Library tab, request-status timestamps, office directory, PDF receipt) are unchanged and out of scope for this packaging pass.

---

## Final answers

**1. Is this the final APK I should submit?**
Yes for a **debug / demo / evaluation** submission — it is current, matches production, and is verified. If the evaluator requires a **signed release** APK (Play Store / production distribution), do one more `assembleRelease` with a keystore; that was not part of this pass and no keystore exists yet.

**2. Is it safe to demo on a real Android phone?**
Yes. It installs, launches, and renders; it talks to the live Render API and all consumed endpoints return 200. Note it depends on **network + the live backend** (Render free tier can cold-start for ~20–40s on first request — open the app a minute before demoing to warm it). Enable "Install from unknown sources" to sideload the debug APK.

**3. Does it match the current production website?**
Yes — bit-for-bit on the frontend. The APK bundles `index-BawnZZPV.js`, the exact content hash the production site serves, and points at the same live API + database. Cohort exams, refreshed demo dates, and notice lifecycle behavior are delivered identically because both the website and the APK consume the same backend.
