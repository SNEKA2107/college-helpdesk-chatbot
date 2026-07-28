#!/usr/bin/env node
/**
 * Production smoke test — verifies a deployed CampusAssist backend end to end.
 *
 * Checks the whole release checklist against a live URL: health, auth for all
 * three roles, protected-route enforcement, role isolation, CORS for the real
 * frontend origin, and one read per feature module.
 *
 * Uses only Node built-ins so it runs anywhere with no install step.
 *
 * Usage
 * -----
 *   node backend/scripts/smoke-production.js https://your-backend.vercel.app
 *
 *   # also verify CORS for the deployed frontend origin
 *   FRONTEND_ORIGIN=https://your-frontend.vercel.app \
 *     node backend/scripts/smoke-production.js https://your-backend.vercel.app
 *
 *   # non-default credentials
 *   STUDENT_ID=22IT101 STUDENT_PASSWORD=... node backend/scripts/smoke-production.js <url>
 *
 * Exit code is 0 only when every check passes, so it works as a CI gate.
 */
'use strict';

const BASE = (process.argv[2] || process.env.API_URL || '').replace(/\/+$/, '');
if (!BASE) {
  console.error('Usage: node backend/scripts/smoke-production.js https://your-backend.vercel.app');
  process.exit(2);
}
const API = `${BASE}/api`;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '';

const CREDS = {
  student: [process.env.STUDENT_ID || '22IT101', process.env.STUDENT_PASSWORD || 'student123'],
  admin: [process.env.ADMIN_ID || 'ADMIN01', process.env.ADMIN_PASSWORD || 'admin@123'],
  faculty: [process.env.FACULTY_ID || 'FAC01', process.env.FACULTY_PASSWORD || 'faculty123'],
};

const results = [];
const tokens = {};

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function call(path, { method = 'GET', token, body, origin } = {}) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (origin) headers.Origin = origin;
  const started = Date.now();
  try {
    const res = await fetch(API + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = {};
    try { json = JSON.parse(text); } catch { /* non-JSON body */ }
    return { status: res.status, json, text, headers: res.headers, ms: Date.now() - started };
  } catch (err) {
    return { status: 0, json: {}, text: '', headers: new Headers(), ms: Date.now() - started, error: err.message };
  }
}

function section(title) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
}

async function main() {
  console.log(`\nCampusAssist production smoke test`);
  console.log(`Target: ${BASE}`);
  if (FRONTEND_ORIGIN) console.log(`Frontend origin: ${FRONTEND_ORIGIN}`);

  // ── infrastructure ────────────────────────────────────────────────────────
  section('Infrastructure');
  const health = await call('/health');
  record('Health endpoint reachable', health.status === 200 || health.status === 503,
    health.error || `HTTP ${health.status} in ${health.ms}ms`);
  record('Database connected', health.json.database === 'connected',
    `database=${health.json.database || 'unknown'}`);
  if (Array.isArray(health.json.missingEnv) && health.json.missingEnv.length) {
    record('All required env vars set', false, `missing: ${health.json.missingEnv.join(', ')}`);
  } else {
    record('All required env vars set', true);
  }

  const setup = await call('/auth/setup-status');
  record('Public endpoint responds', setup.status === 200, `HTTP ${setup.status}`);

  // ── CORS ──────────────────────────────────────────────────────────────────
  if (FRONTEND_ORIGIN) {
    section('CORS');
    const cors = await call('/auth/setup-status', { origin: FRONTEND_ORIGIN });
    const allowed = cors.headers.get('access-control-allow-origin');
    record('Frontend origin is allowed by CORS', allowed === FRONTEND_ORIGIN,
      allowed ? `Access-Control-Allow-Origin: ${allowed}` : 'no Access-Control-Allow-Origin header — set FRONTEND_URL on the backend');

    const bad = await call('/auth/setup-status', { origin: 'https://not-your-app.example.com' });
    const badAllowed = bad.headers.get('access-control-allow-origin');
    record('Unknown origin is rejected', !badAllowed, badAllowed ? `unexpectedly allowed: ${badAllowed}` : 'no ACAO header, as expected');
  }

  // ── authentication ────────────────────────────────────────────────────────
  section('Authentication');
  for (const [role, [identifier, password]] of Object.entries(CREDS)) {
    const res = await call('/auth/login', { method: 'POST', body: { identifier, password } });
    const token = res.json.token;
    if (token) tokens[role] = token;
    record(`Login as ${role}`, Boolean(token), token ? `HTTP ${res.status}, JWT issued (${res.ms}ms)` : `HTTP ${res.status} — ${res.json.message || res.text.slice(0, 80)}`);
  }

  const bad = await call('/auth/login', { method: 'POST', body: { identifier: CREDS.student[0], password: 'definitely-wrong' } });
  record('Invalid password rejected', bad.status === 401, `HTTP ${bad.status}`);

  const anon = await call('/auth/me');
  record('Protected route blocks anonymous access', anon.status === 401, `HTTP ${anon.status}`);

  const tampered = await call('/auth/me', { token: (tokens.student || 'x.y.z') + 'tampered' });
  record('Tampered JWT rejected', tampered.status === 401, `HTTP ${tampered.status}`);

  if (tokens.student) {
    const me = await call('/auth/me', { token: tokens.student });
    record('Valid JWT accepted', me.status === 200 && Boolean(me.json.user), `HTTP ${me.status}`);
  }

  // ── role isolation ────────────────────────────────────────────────────────
  section('Role-based access control');
  if (tokens.student) {
    for (const path of ['/students', '/audit', '/analytics']) {
      const res = await call(path, { token: tokens.student });
      record(`Student is refused ${path}`, res.status === 403, `HTTP ${res.status}`);
    }
    const fac = await call('/faculty-portal/dashboard', { token: tokens.student });
    record('Student is refused the faculty portal', fac.status === 403, `HTTP ${fac.status}`);
  }

  // ── feature modules ───────────────────────────────────────────────────────
  section('Feature modules');
  const MODULES = [
    ['Student dashboard data', '/auth/me', 'student'],
    ['Attendance', '/attendance/summary', 'student'],
    ['Timetable', '/timetable/today', 'student'],
    ['Library', '/library', 'student'],
    ['Notices', '/notices', 'student'],
    ['Leave', '/leave', 'student'],
    ['Requests', '/requests', 'student'],
    ['Fees', '/fees', 'student'],
    ['Exam', '/exam/schedule', 'student'],
    ['Marks / CGPA', '/marks/cgpa', 'student'],
    ['Events', '/events', 'student'],
    ['Calendar', '/calendar', 'student'],
    ['AI Chat (conversations)', '/conversations', 'student'],
    ['Departments (public)', '/departments', null],
    ['Admin dashboard data', '/students', 'admin'],
    ['Admin audit log', '/audit', 'admin'],
    ['Admin analytics', '/analytics', 'admin'],
    ['Faculty dashboard', '/faculty-portal/dashboard', 'faculty'],
    ['Faculty students', '/faculty-portal/students', 'faculty'],
    ['Faculty timetable', '/faculty-portal/timetable', 'faculty'],
  ];
  for (const [label, path, role] of MODULES) {
    if (role && !tokens[role]) {
      record(label, false, `skipped — no ${role} token`);
      continue;
    }
    const res = await call(path, { token: role ? tokens[role] : undefined });
    record(label, res.status === 200, `HTTP ${res.status} in ${res.ms}ms`);
  }

  // ── summary ───────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;
  console.log('\n' + '='.repeat(60));
  console.log(`RESULT: ${passed}/${results.length} checks passed`);
  if (failed) {
    console.log(`\n${failed} failing check(s):`);
    for (const r of results.filter(r => !r.ok)) {
      console.log(`  - ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
    }
  }
  console.log('='.repeat(60) + '\n');
  process.exit(failed ? 1 : 0);
}

main().catch(err => {
  console.error('\nSmoke test crashed:', err);
  process.exit(2);
});
