# CampusAssist — Smart College Helpdesk

[![Selenium E2E Audit](https://github.com/SNEKA2107/college-helpdesk-chatbot/actions/workflows/selenium-audit.yml/badge.svg?branch=demo-branch)](https://github.com/SNEKA2107/college-helpdesk-chatbot/actions/workflows/selenium-audit.yml)
[![Project Summary](https://github.com/SNEKA2107/college-helpdesk-chatbot/actions/workflows/project-summary.yml/badge.svg)](https://github.com/SNEKA2107/college-helpdesk-chatbot/actions/workflows/project-summary.yml)

A full-stack college helpdesk application: students log in to access attendance,
exams, fees, timetable, leave/OD requests, notices, library, an AI chatbot and
more, while administrators manage every module from a single console.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, React Router, GSAP |
| Backend | Node.js + Express, JWT auth, Helmet, rate limiting |
| Database | MongoDB (Mongoose); in-memory MongoDB for local/CI runs |
| Mobile | Capacitor (Android APK) |
| QA | Selenium WebDriver + Pytest (Page Object Model) |

## Quick start (local)

```bash
# 1. Backend with a seeded in-memory database (no Atlas needed)
node backend/dev-local.js          # serves the app on http://localhost:5000

# 2. (or) Frontend dev server against the local backend
npm install --prefix frontend && npm run dev --prefix frontend
```

Demo logins: **Student** `22IT101` / `student123` · **Admin** `ADMIN01` / `admin@123`

## Automated QA — Selenium E2E Audit (337 tests)

The [`selenium_model/`](selenium_model/) suite runs a complete end-to-end audit:
authentication, RBAC, navigation, forms, CRUD, search/filter, accessibility,
performance, broken-link, API and security-header checks, plus full user journeys.
It generates a 16-sheet master report (`MASTER_TEST_AUDIT_REPORT.xlsx`).

```bash
node backend/dev-local.js                      # start the app first
pip install -r selenium_model/requirements.txt
python selenium_model/run.py                   # discover → audit → test → report
```

**CI:** every push runs all 337 tests headless via the
[Selenium E2E Audit workflow](.github/workflows/selenium-audit.yml). The Excel
report, HTML report, screenshots and logs are uploaded as a downloadable
**`selenium-audit-report`** artifact on each run (see the **Actions** tab).

## Repository layout

| Path | Purpose |
|---|---|
| [`frontend/`](frontend/) | React + Vite single-page app (the deployed UI) |
| [`backend/`](backend/) | Express API, models, routes, seed scripts |
| [`selenium_model/`](selenium_model/) | Selenium + Pytest audit suite & reports |
| [`.github/workflows/`](.github/workflows/) | CI workflows |
