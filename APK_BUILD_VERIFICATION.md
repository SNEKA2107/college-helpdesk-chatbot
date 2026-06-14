# APK BUILD VERIFICATION — Phase 1

**Date:** 2026-06-14 · **Type:** Build/packaging verification (no code or business-logic changes)

---

## 1. Working tree verified
- Branch: `main`. Not committed/pushed (per instruction).
- All 16 Phase-1 files present in the tree and therefore in the build:

| Backend (modified) | Frontend (modified) | New |
|---|---|---|
| models/Leave.js, models/Timetable.js, models/User.js | pages/Events.jsx, Dashboard.jsx, Leave.jsx, Od.jsx, Register.jsx, Timetable.jsx | **frontend/src/utils/file.js** |
| routes/auth.js, leave.js, students.js, timetable.js | pages/admin/LeavesTab.jsx, TimetableTab.jsx | |

## 2. Build pipeline (as requested)
| Step | Command | Result |
|------|---------|--------|
| Install | `npm install` | ✅ completed (audit warnings only) |
| Web build | `npm run build` (vite) | ✅ built in ~2.5s, 40 asset chunks → `frontend/dist` |
| Native sync | `npx cap sync android` | ✅ "Sync finished" — web assets copied to `android/app/src/main/assets/public` |
| APK assembly | `./gradlew :app:assembleDebug` | ✅ **BUILD SUCCESSFUL** (after clearing a OneDrive lock — see risks) |

## 3. APK artifact
| Property | Value |
|----------|-------|
| Path | `frontend/android/app/build/outputs/apk/debug/app-debug.apk` |
| Size | **6.9 MB** (7,143,173 bytes) |
| Variant | **debug** (unsigned debug keystore) |
| Built | 2026-06-14 20:30 |
| appId | `com.campusassist.app` |

## 4. Toolchain
| Component | Version | Note |
|-----------|---------|------|
| Node / npm | 22.17.0 / 10.9.2 | ok |
| Capacitor Android | 8.4.0 | ok |
| Android Gradle Plugin | 8.13.0 | ok |
| Gradle | 8.14.3 | ok |
| JDK | **25.0.2** | ⚠️ newer than AGP 8.13's officially supported JDK (17–21); the build **succeeded** but this is unsupported and a risk (see below) |
| Android SDK / target | platform-35 | ok |

## 5. Build-environment risks (must note for release)
1. **OneDrive file locking.** The project lives under `OneDrive\Desktop\…`. The first two `assembleDebug` runs failed (`mergeDebugResources` / "Unable to delete directory … process has files open") because OneDrive virtualizes/locks `build/` and `node_modules/**/build` artifacts. A clean rebuild after `./gradlew --stop` + killing stray `java` processes + clearing `intermediates` succeeded. **Recommendation:** build from a path outside OneDrive (e.g. `C:\dev\…`) or pause OneDrive during builds for reliable CI.
2. **JDK 25 unsupported by AGP 8.13.** It worked here but is officially unsupported; a future Gradle/AGP run could fail. **Recommendation:** install and pin **JDK 21** (Temurin) for the Android build.
3. **Debug, not release.** This is a debug APK. A production release requires `assembleRelease` with a real signing keystore — not performed this phase.

## 6. Verdict
✅ **Build verified.** A fresh debug APK containing all Phase-1 changes assembles and is produced at the path above. Two environmental risks (OneDrive, JDK 25) are documented; neither is a code defect.

*Verification only — DO NOT COMMIT.*
