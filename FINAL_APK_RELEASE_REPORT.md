# FINAL APK RELEASE REPORT — RC1 (v1.0-submission)

**Date:** 2026-06-14 · **Type:** Release-candidate build & verification (no feature changes).

## Build pipeline
| Step | Command | Result |
|------|---------|--------|
| Production web build | `npm run build` (vite) | ✅ built (~1.9s), 40 asset chunks → `frontend/dist` |
| Capacitor sync | `npx cap sync android` | ✅ web assets copied to Android project |
| APK assembly | `./gradlew :app:assembleDebug` | ✅ **BUILD SUCCESSFUL** |

## Artifact
| Property | Value |
|----------|-------|
| Path | `frontend/android/app/build/outputs/apk/debug/app-debug.apk` |
| Size | **6.9 MB** (7,145,489 bytes) |
| Variant | debug (unsigned) |
| appId | `com.campusassist.app` |
| API target (native) | `https://college-helpdesk-chatbot-l4bk.onrender.com/api` (no localhost) |

## Toolchain
Node 22.17 · Capacitor Android 8.4.0 · AGP 8.13.0 · Gradle 8.14.3 · JDK 25 (builds OK; **pin JDK 21** for store) · Android SDK platform-35.

## Verification
| Check | Result |
|-------|--------|
| APK builds | ✅ |
| APK installs (emulator API 35) | ✅ `Success` (streamed install) |
| APK launches | ✅ WebView renders the React app — `screenshots-phase1/rc1-apk-launch.png` |
| Targets hosted API (no localhost) | ✅ verified in bundle + `api.js` native resolution |

## Notes / known build-env caveats
- Build from outside OneDrive or with daemons stopped (OneDrive can lock `build/` dirs — handled here by `gradlew --stop` + clearing intermediates).
- This is a **debug** APK suitable for demo/submission. A **signed `assembleRelease`** is required for Play Store distribution.

**Verdict:** ✅ APK builds, installs, and launches — ready for demonstration.
