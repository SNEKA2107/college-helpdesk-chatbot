# CampusAssist — Android Deployment Guide

How to build, install, and ship the Android app. The app is the React build (`frontend/dist`) wrapped by Capacitor 8; it talks to the hosted backend at `https://college-helpdesk-chatbot-l4bk.onrender.com/api`.

## Toolchain (installed on this machine 2026-06-13)

| Tool | Location | Notes |
|---|---|---|
| JDK 21 (Temurin 21.0.11) | `%LOCALAPPDATA%\Java\jdk-21.0.11+10` | Use for Gradle. The system JDK 25 is too new for Gradle 8.14 — set `JAVA_HOME` to JDK 21 when building. |
| Android SDK | `%LOCALAPPDATA%\Android\Sdk` | cmdline-tools, platform-tools (adb), platform 36, build-tools 36.0.0, emulator, Android 35 system image |
| AVD `campus_test` | Pixel 5, Android 35 (google_apis, x86_64) | For testing without a physical device |

`frontend/android/local.properties` already points at the SDK (`sdk.dir=C:/Users/LENOVO/AppData/Local/Android/Sdk`). This file is machine-specific — do not commit it.

## Build an APK

```powershell
# 1. Build the web app and sync it into the Android project
cd frontend
npm run build
npx cap sync android

# 2. Build the APK (PowerShell)
cd android
$env:JAVA_HOME = "$env:LOCALAPPDATA\Java\jdk-21.0.11+10"
.\gradlew.bat assembleDebug          # debug APK
# .\gradlew.bat assembleRelease      # release APK (unsigned unless signing is configured)
```

Output: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`
(release: `.../apk/release/app-release-unsigned.apk`)

**Always re-run `npm run build` + `npx cap sync android` after frontend changes** — the APK bundles a snapshot of `dist/`, it does not load the website.

## Install on a device

- **Physical phone:** enable Developer Options → USB debugging, plug in, then
  `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe install -r app-debug.apk`
  — or just copy the APK to the phone and open it (allow "install unknown apps").
- **Emulator:**
  ```powershell
  %LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe -avd campus_test
  adb install -r frontend\android\app\build\outputs\apk\debug\app-debug.apk
  ```

## App identity

- Package: `com.campusassist.app` · App name: CampusAssist
- Version: `versionName`/`versionCode` in `frontend/android/app/build.gradle` — bump `versionCode` for every release.

## Release signing (required before distributing)

The project has no keystore yet; debug builds are signed with the auto-generated debug key (fine for testing, not for distribution).

```powershell
# one-time keystore creation (keep it + the passwords safe; losing it means losing update rights)
keytool -genkeypair -v -keystore campusassist.keystore -alias campusassist -keyalg RSA -keysize 2048 -validity 10000
```

Then in `frontend/android/app/build.gradle` add inside `android { }`:

```groovy
signingConfigs {
    release {
        storeFile file('../../campusassist.keystore')   // keep OUT of git
        storePassword System.getenv('KEYSTORE_PASSWORD')
        keyAlias 'campusassist'
        keyPassword System.getenv('KEY_PASSWORD')
    }
}
buildTypes { release { signingConfig signingConfigs.release } }
```

For Play Store, build an AAB instead: `.\gradlew.bat bundleRelease`.

## How networking works on device (verified live)

- WebView origin is `https://localhost`; `frontend/src/services/api.js` resolves the API to the hosted Render URL on any native/`https://localhost` origin (hardened 2026-06-13 — never falls back to `http://localhost:5000` on device).
- Backend CORS already allows `https://localhost` and `capacitor://localhost` (verified against the live API: preflight with `authorization` header and a real login POST both succeed).
- All traffic is HTTPS; `allowMixedContent: false`.
- **Render free-tier note:** the backend sleeps when idle; the first request after a while can take ~30-60s. The app shows connection errors until it wakes — retry once.

## Updating the app

1. Make frontend changes → `npm run build` → `npx cap sync android`.
2. Bump `versionCode` (and `versionName`) in `app/build.gradle`.
3. `.\gradlew.bat assembleRelease` (or `bundleRelease` for Play).
4. Test on emulator: install, log in, spot-check dashboard + requests + chat.

## Troubleshooting

- **"SDK location not found"** — recreate `android/local.properties` with `sdk.dir=`.
- **"Unsupported class file major version" / Gradle JVM errors** — `JAVA_HOME` is pointing at JDK 25; point it at the JDK 21 path above.
- **App opens but every API call fails** — check the Render backend is awake (`curl https://college-helpdesk-chatbot-l4bk.onrender.com/api/health`); if you changed the backend URL, update `PROD_API` in `frontend/src/services/api.js`, rebuild, resync.
- **Stale UI in the APK** — you forgot `npx cap sync android` after rebuilding.
