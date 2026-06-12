# APK Build Report

**Date:** 2026-06-13 · **Result: ✅ APK GENERATED (verified on disk)**

## Artifact

| Field | Value |
|---|---|
| **APK path** | `frontend/android/app/build/outputs/apk/debug/app-debug.apk` |
| **APK size** | 4.2 MB (4,328,808 bytes) |
| **Package name** | `com.campusassist.app` |
| **Version name** | `1.0` |
| **Version code** | `1` |
| **App label** | CampusAssist |
| **minSdkVersion** | 24 (Android 7.0) |
| **targetSdkVersion / compileSdk** | 36 |
| **Permissions** | `android.permission.INTERNET` (required for the hosted API) |
| **Signing** | Debug keystore (auto-generated). **Release APK not built — no signing configuration exists** (see `ANDROID_DEPLOYMENT_GUIDE.md` for keystore setup). |

Metadata read directly from the artifact with `aapt2 dump badging`.

## Build pipeline (all steps actually run)

| Phase | Command | Result |
|---|---|---|
| Web build | `npm install` + `npm run build` | ✅ clean, 1.67s, zero errors |
| Capacitor sync | `npx cap sync android` | ✅ assets → `android/app/src/main/assets/public/`, plugins updated. **Existing Capacitor setup reused — nothing reinitialized, android/ not recreated** |
| Gradle build | `gradlew.bat assembleDebug --no-daemon` | ✅ **BUILD SUCCESSFUL in 2m 50s**, 93/93 tasks, zero warnings-as-errors |

## Toolchain assembled for this build (machine had none of it)

| Component | Version | Installed to |
|---|---|---|
| Temurin JDK (for Gradle; system JDK 25 is unsupported by Gradle 8.14) | 21.0.11 | `%LOCALAPPDATA%\Java\jdk-21.0.11+10` |
| Android cmdline-tools | latest (13114758) | `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest` |
| Android SDK Platform | 36 | `%LOCALAPPDATA%\Android\Sdk\platforms\android-36` |
| Build-tools | 36.0.0 | `%LOCALAPPDATA%\Android\Sdk\build-tools\36.0.0` |
| Platform-tools (adb) | r37 | `%LOCALAPPDATA%\Android\Sdk\platform-tools` |
| Gradle (via wrapper) | 8.14.3 | downloaded on first build |
| AGP | 8.13.0 | from project config |

`frontend/android/local.properties` created pointing at the SDK (machine-specific; keep out of git).

## Gradle verification (Android Studio not installed — equivalent checks done via CLI)

- Gradle sync: implicit in the successful build (dependency resolution completed).
- SDK versions: compileSdk 36 / build-tools 36.0.0 resolved and used.
- Dependencies: Capacitor android 8.4.0 + AndroidX artifacts resolved from Maven; `:capacitor-android` and `:capacitor-cordova-android-plugins` modules built.
- All SDK licenses accepted.

## Reproduce

```powershell
cd frontend; npm run build; npx cap sync android; cd android
$env:JAVA_HOME = "$env:LOCALAPPDATA\Java\jdk-21.0.11+10"
.\gradlew.bat assembleDebug
```
