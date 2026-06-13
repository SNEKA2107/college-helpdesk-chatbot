# Branding Update Report — CampusAssist Android

**Date:** 2026-06-13 · **Scope:** branding assets only — no backend, business logic, API, auth, routing, or database code touched. **Not committed — awaiting approval.**

## Logo note

No logo file arrived with the request (the repo's `icons/*.png` are flat blue placeholders). The branding was generated from the app's **existing in-app identity**: the 🎓 graduation-cap mark on the blue gradient used by `.logo-icon` in `global.css` (`#89AACC → #4E85BF → #2D6499`), so the launcher, splash, and in-app branding now match. If you have an official logo file, point me at it and I'll regenerate everything from it in one pass.

## What was done

1. **Source assets rendered** (`branding-render.js` → `frontend/assets/`): `icon-only.png` (1024², full-bleed), `icon-foreground.png` (1024², transparent RGBA, glyph in safe zone), `icon-background.png` (gradient), `splash.png`/`splash-dark.png` (2732², dark-blue #0b1320 background, centered logo tile, "CampusAssist" + "SMART CAMPUS MANAGEMENT SYSTEM").
2. **`npx @capacitor/assets generate --android`** — the only generation command run; Android project not recreated, Capacitor not reinitialized. 74 assets written.
3. **Two manual fixes** (both branding-only):
   - `mipmap-anydpi-v26/ic_launcher.xml` + `ic_launcher_round.xml`: removed the generator's `16.7%` inset from the **background** layer (an inset background never reaches the adaptive-icon mask edge → white/gray ring; foreground keeps its inset for the safe zone).
   - `values/styles.xml`: added `windowSplashScreenBackground = #0b1320` so the Android 12+ system splash sits on the brand dark blue.

## Files modified / generated

| Area | Files |
|---|---|
| New source assets | `frontend/assets/{icon-only,icon-foreground,icon-background,splash,splash-dark}.png` + `branding-render.js` |
| Launcher icons (all densities) | `mipmap-{ldpi,mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/{ic_launcher,ic_launcher_round,ic_launcher_foreground,ic_launcher_background}.png` |
| Adaptive icon XML | `mipmap-anydpi-v26/ic_launcher.xml`, `ic_launcher_round.xml` (full-bleed background) |
| Splash (all densities, portrait+landscape, light+dark) | `drawable-{port,land}-{…dpi}/splash.png`, `drawable-{port,land}-night-{…dpi}/splash.png`, `drawable/splash.png` |
| Splash theme | `values/styles.xml` (one item added) |

## Debugging worth knowing about

The first generation produced a **gray icon backplate** everywhere. Root cause found by extracting PNGs from the built APK: the rendered `icon-foreground.png` had an opaque gray background baked in (Playwright's `omitBackground` doesn't remove CSS-painted body backgrounds). Fixed the render script (`body{background:transparent}`), verified the new foreground is true RGBA, regenerated, and re-verified. Also hit OneDrive file locks on `app/build` intermediates during rebuild — cleared by deleting `app/build` (documented in case it recurs: stop Gradle daemons, `rm -rf app/build`, rebuild).

## Verification (Android 15 emulator, clean installs)

| Check | Result | Evidence (`device-screenshots/branding/`) |
|---|---|---|
| Launcher icon: cap on blue gradient, adaptive mask correct | ✅ | `app-drawer-5.png`, close-up `icon-crop.png` |
| Splash: brand dark-blue background, gradient logo circle centered | ✅ | `brand-splash-5.png` |
| App loads to landing page after splash | ✅ | `brand-landing-5.png` |
| APK builds | ✅ `BUILD SUCCESSFUL in 17s` | new size **7.1 MB** (was 4.2 MB; +2.86 MB = generated splash/icon set) |
| No Android build errors | ✅ | 93/93 tasks |
| Functionality unchanged | ✅ | login smoke on the branded APK → `/dashboard` against the live API; web bundle untouched (`assets/public` unchanged) |

Splash note: on Android 12+ the OS renders the system splash itself (icon on `windowSplashScreenBackground`) — arbitrary text isn't allowed there by the platform. The full "CampusAssist / Smart Campus Management System" artwork ships in the `drawable-*/splash.png` set, which Android <12 shows as the launch background (and is available if the `@capacitor/splash-screen` plugin is ever added).

## Status

✓ CampusAssist branding applied
✓ Android icon updated (all densities + adaptive)
✓ Splash screen updated (all densities, light/dark, port/land)
✓ APK still functional (rebuilt, installed, login-verified)

## ⚠️ For the commit (when you approve)

The root `.gitignore` has a blanket `*.png` rule, so **all launcher/splash PNGs are currently invisible to git** (the previous commit only captured the res XML files — a fresh clone today would build with broken icons). The commit needs either `git add -f` on the res PNGs or a `.gitignore` exception like `!frontend/android/app/src/main/res/**/*.png` and `!frontend/assets/*.png`. Say the word and I'll commit it that way.
