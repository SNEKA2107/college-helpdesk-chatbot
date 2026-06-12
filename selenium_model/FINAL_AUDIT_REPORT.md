# CampusAssist - QA Audit & E2E Testing Report

## Executive Summary

- **Project Name:** CampusAssist Smart College Helpdesk
- **Scan Date:** 2026-06-11 13:25:12
- **Total Files:** 9 subdirectories, 75 files
- **Total Pages:** 24 HTML pages
- **Total Functionalities:** 18 mapped workflows
- **Total Tests Executed:** 14
- **Passed:** 6
- **Failed:** 8
- **Coverage Percentage:** 42.86%
- **Total Bugs Found:** 47

---

## 1. Code Audit Details

### Unused Files Identified
The following files are present in the project but are never referenced by any active route or HTML view:
- **index.html.txt** (./index.html.txt): Text backup file. Contains duplicate or obsolete HTML draft. (Severity: **Low**)
- **open-admin.js** (./open-admin.js): Orphan utility script file. Never imported or run in any HTML page. (Severity: **Low**)
- **open-login.js** (./open-login.js): Orphan utility script file. Never imported or run in any HTML page. (Severity: **Low**)
- **screenshot-laptop.js** (./screenshot-laptop.js): Orphan utility script file. Never imported or run in any HTML page. (Severity: **Low**)
- **screenshot-live.js** (./screenshot-live.js): Orphan utility script file. Never imported or run in any HTML page. (Severity: **Low**)
- **screenshot-mobile.js** (./screenshot-mobile.js): Orphan utility script file. Never imported or run in any HTML page. (Severity: **Low**)
- **sw.js** (./sw.js): Orphan utility script file. Never imported or run in any HTML page. (Severity: **Low**)
- **test-app.js** (./test-app.js): Orphan utility script file. Never imported or run in any HTML page. (Severity: **Low**)
- **test-login.js** (./test-login.js): Orphan utility script file. Never imported or run in any HTML page. (Severity: **Low**)
- **test-pages.js** (./test-pages.js): Orphan utility script file. Never imported or run in any HTML page. (Severity: **Low**)
- **test-phase3-debug.js** (./test-phase3-debug.js): Orphan utility script file. Never imported or run in any HTML page. (Severity: **Low**)
- **test-phase3.js** (./test-phase3.js): Orphan utility script file. Never imported or run in any HTML page. (Severity: **Low**)
- **test-phase5.js** (./test-phase5.js): Orphan utility script file. Never imported or run in any HTML page. (Severity: **Low**)
- **verify-css-local.js** (./verify-css-local.js): Orphan utility script file. Never imported or run in any HTML page. (Severity: **Low**)
- **verify-css.js** (./verify-css.js): Orphan utility script file. Never imported or run in any HTML page. (Severity: **Low**)
- **verify-dashboard.js** (./verify-dashboard.js): Orphan utility script file. Never imported or run in any HTML page. (Severity: **Low**)
- **verify-mobile.js** (./verify-mobile.js): Orphan utility script file. Never imported or run in any HTML page. (Severity: **Low**)
- **verify-profile-mobile.js** (./verify-profile-mobile.js): Orphan utility script file. Never imported or run in any HTML page. (Severity: **Low**)

### Dead Code / Technical Debt
- **backend/dev-local.js vs e2e_test_report.py**: Line 49 - Synchronize credential seeds. Backend uses 'ADMIN01' / 'admin@123' while e2e_test_report uses 'ADMIN001' / 'Admin@1234'.

---

## 2. Accessibility & Validation Scans

### Accessibility Issues
Missing attributes or raw emoji usages found:
- **admin-dashboard.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **admin-leaves.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **admin-notices.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **admin-requests.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **admin.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **attendance.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **cgpa.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **chat.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **contact.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **dashboard.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **events.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **exam.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **fees.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **index.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **leave.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **library.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **login.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **notices.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **od.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **profile.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **register.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **requests.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **status.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **student-search.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)
- **timetable.html**: Raw emoji icons utilized in body text without accessible spans -> *Recommendation: Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis.* (Severity: **Low**)

### Performance Timings
Page load observations under offline local server:
- **index.html**: load time: **0.016s** - Good Load Speed (33118 bytes)
- **login.html**: load time: **0.016s** - Good Load Speed (13795 bytes)
- **register.html**: load time: **0.015s** - Good Load Speed (18791 bytes)
- **dashboard.html**: load time: **0.017s** - Good Load Speed (21690 bytes)
- **admin.html**: load time: **0.031s** - Good Load Speed (24672 bytes)

---

## 3. Security Findings
- **Authentication Tokens** (Severity: **Medium**): JWT expiration set to 30 days. Compromised tokens remain valid for excessive duration. -> *Reduce expiration to 1 hour and implement refresh token rotation.*
- **Network Headers** (Severity: **High**): Helmet content security policy is disabled (set to false) to ease font/script CDN imports. -> *Enable CSP and whitelist reliable CDN origins for fonts, GSAP scripts, and backend calls.*
- **Rate Limiting** (Severity: **Low (Info)**): Rate limiting is configured to 20 request limit on auth logins. Excellent prevention of brute force attacks. -> *Maintain standard security headers to block IP spoofing.*

---

## 4. Key Recommendations

1. **Helmet Content Security Policy (CSP):** Whitelist font and script CDN origins rather than disabling CSP entirely.
2. **Synchronize Local Database Seeds:** Fix the mismatch between `dev-local.js` seeded credentials and automated configurations.
3. **Archive/Delete Superseded Code:** Clean up the 5+ orphan HTML views and debug JS utilities in the root directory.

*Report compiled by Antigravity Technical Reporting Specialist.*
