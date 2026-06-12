# APK Precheck Report

**Date:** 2026-06-13 · **Project:** CampusAssist (`frontend/` React app → Android via Capacitor)

## Existing setup (verified before any changes — nothing reinitialized)

| Check | Status | Evidence |
|---|---|---|
| Capacitor installed | ✅ Already present — **not reinstalled** | `@capacitor/core` 8.4.0, `@capacitor/android` 8.4.0, `@capacitor/cli` 8.4.0 (`npx cap --version` → 8.4.0) |
| Capacitor config | ✅ Already present — **not recreated** | `frontend/capacitor.config.json`: appId `com.campusassist.app`, appName `CampusAssist`, webDir `dist`, `androidScheme: https`, `allowMixedContent: false` |
| `android/` folder | ✅ Already present — **not recreated** | `frontend/android/` with `AndroidManifest.xml`, `gradlew.bat` (created 2026-06-13 via `npx cap add android`) |
| Android platform configured | ✅ | AGP 8.13.0, Gradle wrapper 8.14.3, compileSdk 36, targetSdk 36, minSdk 24 (`android/variables.gradle`) |
| React build | ✅ | `npm install` + `npm run build` clean, 1.67s, code-split chunks, zero errors |
| Web assets synced | ✅ | `npx cap sync android` — assets copied to `android/app/src/main/assets/public/`, plugins updated |
| API URLs | ✅ Device-safe | All 3 fetch sites use `API_BASE`; native + `https://localhost`/`capacitor://localhost` origins resolve to the hosted Render API (HTTPS). Live CORS verified from origin `https://localhost` (preflight with `authorization` + real login POST → 200). No hardcoded localhost URLs in the bundle. |
| Environment variables | ✅ None baked in | No `frontend/.env*` files; `VITE_API_URL` unset, so builds can't accidentally embed a dev URL |
| Mobile responsiveness | ✅ | Audited 2026-06-13 (`REACT_MIGRATION_AUDIT.md`): 0px horizontal overflow at 375px/768px, bottom nav + hamburger sidebar working |

## Gaps found on this machine (fixed during this run)

1. **No Android SDK** — no `ANDROID_HOME`, no `%LOCALAPPDATA%\Android\Sdk`, no Android Studio, no `adb`.
   → Fixed: installed Android command-line tools to `%LOCALAPPDATA%\Android\Sdk`, accepted licenses, installed `platform-tools`, `platforms;android-36`, `build-tools;36.0.0`.
2. **JDK mismatch** — only JDK 25 installed; Gradle 8.14.3 supports up to Java 24.
   → Fixed: installed Temurin **JDK 21.0.11** to `%LOCALAPPDATA%\Java\jdk-21.0.11+10`, used via `JAVA_HOME` for Gradle builds (system JDK 25 untouched).
3. **No signing keystore / release config** — `android/app/build.gradle` has no `signingConfigs`. Debug APK uses the auto-generated debug keystore; a release APK will be **unsigned** unless a keystore is created.
4. **No emulator or physical device attached** — device testing limited to what `adb devices` shows at build time.

## Verdict

Precheck **PASSED** — proceed to APK build with `JAVA_HOME` → JDK 21 and `ANDROID_HOME` → the new SDK.
