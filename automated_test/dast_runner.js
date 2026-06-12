/**
 * CampusAssist DAST Runner
 * Reads tokens from ../input.json at runtime.
 * Tokens are never printed in full or written into the report.
 *
 * Categories:
 *   1. AuthN Bypass          – protected endpoints with no/bad/expired token
 *   2. AuthZ / PrivEsc       – lower-privilege role calling admin endpoints
 *   3. IDOR                  – vary ID params to reach another principal's object
 *   4. RBAC Matrix           – every role × every role-restricted endpoint
 *   5. Token Tampering       – flip JWT claims without re-signing
 *   6. Injection Probe       – SQLi / NoSQLi detection payloads
 *   7. Rate Limiting         – 30-req burst on auth endpoint
 *   8. Hardcoded Creds Scan  – static scan of source files
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const https  = require('https');
const http   = require('http');
const crypto = require('crypto');

// ── Config ────────────────────────────────────────────────────────────────────
const INPUT    = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'input.json')));
const BASE     = INPUT.baseUrl.replace(/\/$/, '');           // e.g. http://localhost:5000
const STUDENT  = INPUT.student;
const ADMIN    = INPUT.admin;

// Decode JWT payload without verifying (structural read only)
function jwtPayload(tok) {
  try {
    const seg = tok.split('.')[1];
    const pad = seg + '='.repeat((4 - seg.length % 4) % 4);
    return JSON.parse(Buffer.from(pad, 'base64url').toString());
  } catch { return {}; }
}
const STUDENT_ID = jwtPayload(STUDENT).id;   // MongoDB ObjectId
const ADMIN_ID   = jwtPayload(ADMIN).id;

// Build a deliberately tampered token (flip role claim, invalid sig)
function tamperedToken(original, claimOverrides) {
  const parts = original.split('.');
  const payload = jwtPayload(original);
  Object.assign(payload, claimOverrides);
  const newPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  // Corrupt the signature to ensure it is invalid
  return `${parts[0]}.${newPayload}.INVALIDSIGNATURE_tampered`;
}
// An expired-looking token (exp in the past)
const EXPIRED_TOKEN = tamperedToken(STUDENT, { exp: 1000000000 });
// A role-escalated token signed with wrong key
const ESCALATED_TOKEN = tamperedToken(STUDENT, { role: 'admin' });

// ── HTTP helper ───────────────────────────────────────────────────────────────
function request(method, urlPath, { token, body, extraHeaders = {} } = {}) {
  return new Promise((resolve) => {
    const url    = new URL(BASE + urlPath);
    const isHTTPS = url.protocol === 'https:';
    const lib    = isHTTPS ? https : http;
    const bodyStr = body ? JSON.stringify(body) : undefined;

    const headers = {
      'Content-Type':  'application/json',
      'Content-Length': bodyStr ? Buffer.byteLength(bodyStr) : 0,
      ...extraHeaders,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const start = Date.now();
    const req = lib.request({
      hostname: url.hostname,
      port:     url.port || (isHTTPS ? 443 : 80),
      path:     url.pathname + url.search,
      method,
      headers,
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const ms = Date.now() - start;
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, body: json, raw: data, ms });
      });
    });

    req.on('error', (e) => resolve({ status: 0, body: null, raw: e.message, ms: Date.now() - start }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: null, raw: 'TIMEOUT', ms: 10000 }); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Result store ──────────────────────────────────────────────────────────────
const RESULTS = [];
let testCount = 0;

function record({ endpoint, method, role, status, expected_status, finding,
                  severity, response_time_ms, test_category, note }) {
  RESULTS.push({
    id:               ++testCount,
    endpoint,
    method,
    role,
    status,
    expected_status,
    finding:          !!finding,
    severity:         finding ? severity : 'none',
    response_time_ms,
    test_category,
    note,
    timestamp:        new Date().toISOString(),
  });
  const icon = finding ? '✗' : '✓';
  const sev  = finding ? ` [${severity}]` : '';
  console.log(`  ${icon} [${test_category}] ${method} ${endpoint} (${role}) → ${status} (exp ${expected_status})${sev}  ${note}`);
}

// ── Endpoint catalogue ────────────────────────────────────────────────────────
// [method, path, access]  access: 'public'|'auth'|'admin'
// Parameterised paths use placeholder IDs resolved at runtime after discovery.
const ENDPOINTS = [
  // Auth
  ['POST', '/api/auth/register',        'public'],
  ['POST', '/api/auth/login',           'public'],
  ['GET',  '/api/auth/me',              'auth'],
  ['PUT',  '/api/auth/change-password', 'auth'],
  ['PUT',  '/api/auth/profile',         'auth'],
  // Students
  ['GET',  '/api/students',             'admin'],
  ['GET',  '/api/students/search/test', 'admin'],
  ['GET',  `/api/students/${STUDENT_ID}`, 'admin'],
  ['PUT',  `/api/students/${STUDENT_ID}`, 'auth-own-or-admin'],
  // Requests
  ['GET',  '/api/requests/stats',       'auth'],
  ['GET',  '/api/requests',             'auth'],
  ['POST', '/api/requests',             'auth'],
  ['PUT',  '/api/requests/PLACEHOLDER_REQ/status', 'admin'],
  ['DELETE','/api/requests/PLACEHOLDER_REQ',       'auth-own'],
  // Leave
  ['GET',  '/api/leave',                'auth'],
  ['POST', '/api/leave',                'auth'],
  ['PUT',  '/api/leave/PLACEHOLDER_LEAVE/status', 'admin'],
  ['DELETE','/api/leave/PLACEHOLDER_LEAVE',       'auth-own'],
  // Notices
  ['GET',  '/api/notices',              'auth'],
  ['POST', '/api/notices',              'admin'],
  ['PUT',  '/api/notices/PLACEHOLDER_NOTICE',   'admin'],
  ['DELETE','/api/notices/PLACEHOLDER_NOTICE',  'admin'],
  // Chat
  ['POST', '/api/chat',                 'auth'],
  // Exam
  ['GET',  '/api/exam',                 'auth'],
  ['GET',  '/api/exam/schedule',        'auth'],
  ['GET',  '/api/exam/practicals',      'auth'],
  ['POST', '/api/exam',                 'admin'],
  ['PUT',  '/api/exam/PLACEHOLDER_EXAM', 'admin'],
  // Fees
  ['GET',  '/api/fees',                 'auth'],
  ['POST', '/api/fees/payment',         'auth'],
  ['GET',  '/api/fees/all',             'admin'],
  // Library
  ['GET',  '/api/library',              'auth'],
  ['GET',  '/api/library/borrowed',     'auth'],
  ['GET',  '/api/library/hours',        'auth'],
  ['POST', '/api/library/renew/PLACEHOLDER_BORROW', 'auth-own'],
  ['POST', '/api/library',              'admin'],
  ['PUT',  '/api/library/PLACEHOLDER_BOOK', 'admin'],
  // Timetable
  ['GET',  '/api/timetable',            'auth'],
  ['GET',  '/api/timetable/today',      'auth'],
  ['POST', '/api/timetable',            'admin'],
  ['PUT',  '/api/timetable/PLACEHOLDER_TT', 'admin'],
  // Contact
  ['POST', '/api/contact',              'auth'],
  ['GET',  '/api/contact',              'admin'],
  ['PUT',  '/api/contact/PLACEHOLDER_CONTACT/resolve', 'admin'],
  // Attendance
  ['GET',  '/api/attendance/summary',   'auth'],
  ['GET',  '/api/attendance',           'auth'],
  ['POST', '/api/attendance',           'admin'],
  ['POST', '/api/attendance/bulk',      'admin'],
  // Events
  ['GET',  '/api/events',               'auth'],
  ['POST', '/api/events/PLACEHOLDER_EVENT/register',   'auth'],
  ['DELETE','/api/events/PLACEHOLDER_EVENT/register',  'auth'],
  ['POST', '/api/events',               'admin'],
  ['PUT',  '/api/events/PLACEHOLDER_EVENT', 'admin'],
  ['DELETE','/api/events/PLACEHOLDER_EVENT', 'admin'],
];

// ── Placeholder discovery ─────────────────────────────────────────────────────
async function discoverPlaceholders() {
  const ids = { req: null, leave: null, notice: null, exam: null,
                book: null, tt: null, contact: null, event: null, borrow: null };

  // Create a leave application (student)
  const lv = await request('POST', '/api/leave', {
    token: STUDENT,
    body: { leaveType: 'Medical', fromDate: '2026-07-01', toDate: '2026-07-02', reason: 'DAST probe' },
  });
  if (lv.body?.leave?._id) ids.leave = lv.body.leave._id;

  // Create a document request (student)
  const rq = await request('POST', '/api/requests', {
    token: STUDENT,
    body: { type: 'Bonafide Certificate', purpose: 'DAST probe' },
  });
  if (rq.body?.request?._id) ids.req = rq.body.request._id;

  // Create a contact message (student)
  const ct = await request('POST', '/api/contact', {
    token: STUDENT,
    body: { department: 'IT', subject: 'DAST probe', message: 'automated test message' },
  });
  if (ct.body?.contact?._id) ids.contact = ct.body.contact._id;

  // Admin: create a notice
  const nt = await request('POST', '/api/notices', {
    token: ADMIN,
    body: { title: 'DAST probe notice', content: 'automated test', category: 'general' },
  });
  if (nt.body?.notice?._id) ids.notice = nt.body.notice._id;

  // Admin: create an event
  const ev = await request('POST', '/api/events', {
    token: ADMIN,
    body: { title: 'DAST probe event', description: 'test', date: '2026-08-01', seats: 50, isActive: true },
  });
  if (ev.body?.event?._id) ids.event = ev.body.event._id;

  // Fetch existing exam / book / timetable IDs
  const examR = await request('GET', '/api/exam', { token: ADMIN });
  if (examR.body?.exam?._id) ids.exam = examR.body.exam._id;

  const bookR = await request('GET', '/api/library', { token: ADMIN });
  if (bookR.body?.books?.[0]?._id) ids.book = bookR.body.books[0]._id;

  const ttR = await request('GET', '/api/timetable', { token: ADMIN });
  if (ttR.body?.timetable?._id) ids.tt = ttR.body.timetable._id;

  // Fetch a borrowed book record for the student (if any)
  const borR = await request('GET', '/api/library/borrowed', { token: STUDENT });
  if (borR.body?.borrowed?.[0]?._id) ids.borrow = borR.body.borrowed[0]._id;

  console.log('\n[Discovery] Placeholder IDs resolved:');
  for (const [k, v] of Object.entries(ids)) {
    console.log(`  ${k.padEnd(8)}: ${v || '(none — will use dummy ObjectId)'}`);
  }

  // Fallback: use a syntactically valid but non-existent ObjectId
  const dummy = '000000000000000000000000';
  for (const k of Object.keys(ids)) {
    if (!ids[k]) ids[k] = dummy;
  }

  return ids;
}

function resolveEndpoints(ids) {
  return ENDPOINTS.map(([m, p, a]) => [
    m,
    p.replace('PLACEHOLDER_REQ',     ids.req)
     .replace('PLACEHOLDER_LEAVE',   ids.leave)
     .replace('PLACEHOLDER_NOTICE',  ids.notice)
     .replace('PLACEHOLDER_EXAM',    ids.exam)
     .replace('PLACEHOLDER_BOOK',    ids.book)
     .replace('PLACEHOLDER_TT',      ids.tt)
     .replace('PLACEHOLDER_CONTACT', ids.contact)
     .replace('PLACEHOLDER_EVENT',   ids.event)
     .replace('PLACEHOLDER_BORROW',  ids.borrow),
    a,
  ]);
}

// Minimal safe body payloads for POST/PUT probes
function safeBody(method, path) {
  if (method !== 'POST' && method !== 'PUT') return undefined;
  if (path.includes('/auth/login'))           return { studentId: 'PROBE', password: 'probe1234' };
  if (path.includes('/auth/register'))        return { name:'Probe', studentId:'PROBE99', email:'probe@test.com', password:'probe1234', department:'IT' };
  if (path.includes('/auth/change-password')) return { currentPassword:'x', newPassword:'probe1234' };
  if (path.includes('/auth/profile'))         return { name: 'Probe User' };
  if (path.includes('/requests') && path.endsWith('/status')) return { status: 'Under Review' };
  if (path.includes('/requests'))             return { type: 'Bonafide Certificate', purpose: 'probe' };
  if (path.includes('/leave') && path.endsWith('/status'))    return { status: 'Approved' };
  if (path.includes('/leave'))                return { leaveType: 'Medical', fromDate:'2026-07-01', toDate:'2026-07-02', reason:'probe' };
  if (path.includes('/notices') && !path.endsWith('/notices')) return { title:'probe', content:'probe' };
  if (path.includes('/notices'))              return { title:'probe', content:'probe', category:'general' };
  if (path.includes('/chat'))                 return { message: 'hello' };
  if (path.includes('/exam') && !path.match(/\/exam\/[a-f0-9]{24}/)) return { semester:'V', schedule:[] };
  if (path.includes('/exam'))                 return { semester:'V' };
  if (path.includes('/fees/payment'))         return { amount: 100, mode: 'Online' };
  if (path.includes('/library/renew'))        return {};
  if (path.includes('/library') && method==='POST') return { title:'probe', author:'probe', isbn:'0000', category:'CS', status:'Available', copies:1 };
  if (path.includes('/library'))              return { title:'probe' };
  if (path.includes('/timetable') && !path.match(/\/timetable\/[a-f0-9]{24}/)) return { department:'IT', semester:'5th', slots:[], schedule:{} };
  if (path.includes('/timetable'))            return { department:'IT' };
  if (path.includes('/contact') && path.endsWith('/resolve')) return {};
  if (path.includes('/contact'))              return { department:'IT', subject:'probe', message:'probe' };
  if (path.includes('/attendance/bulk'))      return { records: [] };
  if (path.includes('/attendance'))           return { studentId:'PROBE', subject:'Math', date:'2026-07-01' };
  if (path.includes('/events') && path.endsWith('/register')) return {};
  if (path.includes('/events') && method==='POST') return { title:'probe', description:'probe', date:'2026-08-01', seats:10, isActive:true };
  if (path.includes('/events'))               return { title:'probe' };
  if (path.includes('/students'))             return { name: 'Probe' };
  return {};
}

// ═══════════════════════════════════════════════════════════════════════════
// CAT 1 — AuthN Bypass
// ═══════════════════════════════════════════════════════════════════════════
async function cat1_authn(endpoints) {
  console.log('\n══ CAT 1 — AuthN Bypass (no/malformed/expired token) ══');
  const protected_ = endpoints.filter(([,, a]) => a !== 'public');

  for (const [method, ep, access] of protected_) {
    await sleep(80);
    // No token
    const r1 = await request(method, ep, { body: safeBody(method, ep) });
    record({
      endpoint: ep, method, role: 'none', status: r1.status,
      expected_status: 401, finding: r1.status === 200 || r1.status === 201,
      severity: 'CRITICAL', response_time_ms: r1.ms,
      test_category: 'AuthN-Bypass-NoToken',
      note: r1.status === 200 || r1.status === 201 ? 'UNPROTECTED — returns 2xx with no token' : 'correctly rejected',
    });

    await sleep(80);
    // Malformed token
    const r2 = await request(method, ep, { token: 'not.a.validtoken', body: safeBody(method, ep) });
    record({
      endpoint: ep, method, role: 'malformed-token', status: r2.status,
      expected_status: 401, finding: r2.status === 200 || r2.status === 201,
      severity: 'CRITICAL', response_time_ms: r2.ms,
      test_category: 'AuthN-Bypass-BadToken',
      note: r2.status === 200 || r2.status === 201 ? 'ACCEPTS MALFORMED TOKEN' : 'correctly rejected',
    });

    await sleep(80);
    // Expired token
    const r3 = await request(method, ep, { token: EXPIRED_TOKEN, body: safeBody(method, ep) });
    record({
      endpoint: ep, method, role: 'expired-token', status: r3.status,
      expected_status: 401, finding: r3.status === 200 || r3.status === 201,
      severity: 'HIGH', response_time_ms: r3.ms,
      test_category: 'AuthN-Bypass-ExpiredToken',
      note: r3.status === 200 || r3.status === 201 ? 'ACCEPTS EXPIRED TOKEN' : 'correctly rejected',
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CAT 2 — AuthZ / PrivEsc  (student token → admin endpoints)
// ═══════════════════════════════════════════════════════════════════════════
async function cat2_authz(endpoints) {
  console.log('\n══ CAT 2 — AuthZ / PrivEsc (student token on admin endpoints) ══');
  const adminEps = endpoints.filter(([,, a]) => a === 'admin');

  for (const [method, ep] of adminEps) {
    await sleep(80);
    const r = await request(method, ep, { token: STUDENT, body: safeBody(method, ep) });
    record({
      endpoint: ep, method, role: 'student', status: r.status,
      expected_status: 403, finding: r.status === 200 || r.status === 201,
      severity: 'CRITICAL', response_time_ms: r.ms,
      test_category: 'AuthZ-PrivEsc',
      note: r.status === 200 || r.status === 201
        ? 'PRIVILEGE ESCALATION — student reached admin endpoint'
        : `correctly rejected (${r.status})`,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CAT 3 — IDOR  (student accesses another student's objects)
// ═══════════════════════════════════════════════════════════════════════════
async function cat3_idor(ids) {
  console.log('\n══ CAT 3 — IDOR (cross-principal object access) ══');
  const otherStudentId = ADMIN_ID;  // Use admin's user-ID as "another principal"

  const checks = [
    // Try to read admin user as student via /api/students/:id
    ['GET',  `/api/students/${otherStudentId}`,           STUDENT, 'student-reads-other-user-profile', 403],
    // Try to read admin's requests
    ['GET',  `/api/requests?studentId=${otherStudentId}`, STUDENT, 'student-filters-other-requests',  200],  // no direct IDOR filter
    // Access admin's attendance
    ['GET',  `/api/attendance?studentId=${otherStudentId}`, STUDENT, 'student-reads-other-attendance', 403],
    // Try accessing a student record via admin token — checks population leak
    [`GET`,  `/api/students/${STUDENT_ID}`, ADMIN, 'admin-reads-student-record', 200],
  ];

  for (const [method, ep, tok, label, exp] of checks) {
    await sleep(100);
    const r = await request(method, ep, { token: tok });
    // IDOR finding: student gets 200 on another user's object, OR data leaks another user's sensitive fields
    const isStudentReachingOther = (tok === STUDENT && ep.includes(otherStudentId));
    const finding = isStudentReachingOther && r.status === 200;
    record({
      endpoint: ep, method, role: tok === STUDENT ? 'student' : 'admin',
      status: r.status, expected_status: exp,
      finding, severity: 'HIGH', response_time_ms: r.ms,
      test_category: 'IDOR',
      note: finding
        ? `IDOR — student received 200 accessing another principal's resource (${label})`
        : `${label}: status ${r.status}`,
    });
  }

  // IDOR: student updates another student's profile
  await sleep(100);
  const r2 = await request('PUT', `/api/students/${ADMIN_ID}`, {
    token: STUDENT, body: { name: 'IDOR probe' },
  });
  record({
    endpoint: `/api/students/${ADMIN_ID}`, method: 'PUT', role: 'student',
    status: r2.status, expected_status: 403,
    finding: r2.status === 200, severity: 'CRITICAL', response_time_ms: r2.ms,
    test_category: 'IDOR',
    note: r2.status === 200
      ? 'CRITICAL IDOR — student can update another user record'
      : `correctly rejected (${r2.status})`,
  });

  // IDOR: student deletes another student's leave
  if (ids.leave && ids.leave !== '000000000000000000000000') {
    // first create a second leave as admin (simulating another student's object)
    const lv2 = await request('POST', '/api/leave', {
      token: ADMIN,
      body: { leaveType: 'Medical', fromDate: '2026-07-03', toDate: '2026-07-04', reason: 'IDOR test' },
    });
    if (lv2.body?.leave?._id) {
      await sleep(100);
      const r3 = await request('DELETE', `/api/leave/${lv2.body.leave._id}`, { token: STUDENT });
      record({
        endpoint: `/api/leave/${lv2.body.leave._id}`, method: 'DELETE', role: 'student',
        status: r3.status, expected_status: 403,
        finding: r3.status === 200, severity: 'HIGH', response_time_ms: r3.ms,
        test_category: 'IDOR',
        note: r3.status === 200
          ? 'IDOR — student deleted another user\'s leave application'
          : `correctly rejected (${r3.status})`,
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CAT 4 — RBAC Matrix (role × endpoint)
// ═══════════════════════════════════════════════════════════════════════════
async function cat4_rbac(endpoints) {
  console.log('\n══ CAT 4 — RBAC Matrix (role × all endpoints) ══');
  const roles = [
    { name: 'student', token: STUDENT },
    { name: 'admin',   token: ADMIN   },
    { name: 'none',    token: null    },
  ];

  for (const [method, ep, access] of endpoints) {
    for (const { name, token } of roles) {
      // Skip obvious repeats already covered by cat1/cat2
      if (name === 'none' && access !== 'public') continue;   // covered in cat1
      if (name === 'student' && access === 'admin') continue; // covered in cat2

      await sleep(60);
      const r = await request(method, ep, { token, body: safeBody(method, ep) });

      // Determine expectation
      let expected;
      if (access === 'public')           expected = [200, 201, 400, 401, 409]; // various valid
      else if (access === 'admin' && name === 'admin') expected = [200, 201, 400, 404];
      else if (access === 'admin' && name === 'student') expected = [403];
      else if (access === 'auth' && name !== 'none')     expected = [200, 201, 400, 404];
      else if (access === 'auth-own' && name === 'student') expected = [200, 201, 400, 403, 404];
      else if (access === 'auth-own-or-admin')              expected = [200, 201, 400, 404];
      else expected = [401, 403];

      const finding = !expected.includes(r.status) && (r.status === 200 || r.status === 201);
      if (!finding && expected.includes(r.status)) {
        // Only record unexpected results to keep noise down
        continue;
      }
      record({
        endpoint: ep, method, role: name, status: r.status,
        expected_status: expected[0],
        finding, severity: finding ? 'HIGH' : 'none',
        response_time_ms: r.ms,
        test_category: 'RBAC-Matrix',
        note: finding
          ? `RBAC violation: ${name} got ${r.status} on ${access} endpoint`
          : `unexpected non-2xx: ${r.status}`,
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CAT 5 — Token Tampering
// ═══════════════════════════════════════════════════════════════════════════
async function cat5_tamper(endpoints) {
  console.log('\n══ CAT 5 — Token Tampering (invalid signature / escalated claims) ══');
  const adminEps   = endpoints.filter(([,, a]) => a === 'admin').slice(0, 6);  // sample
  const allAuthEps = endpoints.filter(([,, a]) => a !== 'public').slice(0, 6); // sample

  // Tampered token claiming admin role (invalid signature)
  for (const [method, ep] of adminEps) {
    await sleep(80);
    const r = await request(method, ep, { token: ESCALATED_TOKEN, body: safeBody(method, ep) });
    record({
      endpoint: ep, method, role: 'escalated-tampered', status: r.status,
      expected_status: 401,
      finding: r.status === 200 || r.status === 201,
      severity: 'CRITICAL', response_time_ms: r.ms,
      test_category: 'Token-Tampering',
      note: r.status === 200 || r.status === 201
        ? 'CRITICAL — server accepted tampered token with escalated role claim'
        : `correctly rejected (${r.status})`,
    });
  }

  // Expired-claim tampered token on auth endpoints
  for (const [method, ep] of allAuthEps) {
    await sleep(80);
    const r = await request(method, ep, { token: EXPIRED_TOKEN, body: safeBody(method, ep) });
    record({
      endpoint: ep, method, role: 'expired-tampered', status: r.status,
      expected_status: 401,
      finding: r.status === 200 || r.status === 201,
      severity: 'HIGH', response_time_ms: r.ms,
      test_category: 'Token-Tampering-Expired',
      note: r.status === 200 || r.status === 201
        ? 'HIGH — server accepted token with past exp claim'
        : `correctly rejected (${r.status})`,
    });
  }

  // none-alg: header says alg=none
  const [hdr, pay] = STUDENT.split('.').slice(0, 2);
  const noneHdr = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const noneToken = `${noneHdr}.${pay}.`;   // no signature
  const ep0 = endpoints.find(([,, a]) => a === 'auth');
  if (ep0) {
    await sleep(80);
    const [method, ep] = ep0;
    const r = await request(method, ep, { token: noneToken, body: safeBody(method, ep) });
    record({
      endpoint: ep, method, role: 'alg-none', status: r.status,
      expected_status: 401,
      finding: r.status === 200 || r.status === 201,
      severity: 'CRITICAL', response_time_ms: r.ms,
      test_category: 'Token-Tampering-AlgNone',
      note: r.status === 200 || r.status === 201
        ? 'CRITICAL — server accepted alg:none token (CVE-2015-9235 class)'
        : `correctly rejected (${r.status})`,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CAT 6 — Injection Probes (detection only, no data extraction)
// ═══════════════════════════════════════════════════════════════════════════
async function cat6_injection() {
  console.log('\n══ CAT 6 — Injection Probes (detection only) ══');

  // NoSQL operator injection via query params
  const noSqlPayloads = [
    ['dept[$gt]', ''],
    ['dept[$ne]', 'IT'],
    ['search',    '{"$gt":""}'],
    ['semester[$exists]', 'true'],
  ];
  for (const [key, val] of noSqlPayloads) {
    await sleep(100);
    const r = await request('GET', `/api/students?${key}=${encodeURIComponent(val)}`, { token: ADMIN });
    const anomaly = r.status === 200 && r.body?.students?.length > 0 && key !== 'search';
    record({
      endpoint: `/api/students?${key}=${val}`, method: 'GET', role: 'admin',
      status: r.status, expected_status: 200,
      finding: anomaly, severity: 'HIGH', response_time_ms: r.ms,
      test_category: 'Injection-NoSQLi',
      note: anomaly
        ? `NoSQL operator injection: ${key}=${val} returned ${r.body?.students?.length} records — filter bypass`
        : `${key}=${val} → ${r.status}, count=${r.body?.students?.length ?? '?'}`,
    });
  }

  // ReDoS via search param
  const redosPayloads = [
    '(a+)+$',
    '([a-zA-Z]+)*',
    'a{1,30}b{1,30}c',
  ];
  for (const payload of redosPayloads) {
    await sleep(100);
    const start = Date.now();
    const r = await request('GET', `/api/students?search=${encodeURIComponent(payload)}`, { token: ADMIN });
    const ms = Date.now() - start;
    const slow = ms > 3000;
    record({
      endpoint: `/api/students?search=${payload}`, method: 'GET', role: 'admin',
      status: r.status, expected_status: 200,
      finding: slow, severity: slow ? 'HIGH' : 'none',
      response_time_ms: ms,
      test_category: 'Injection-ReDoS',
      note: slow
        ? `ReDoS: payload "${payload}" caused ${ms}ms response — event loop likely blocked`
        : `payload "${payload}" → ${ms}ms (within normal range)`,
    });
  }

  // Library search ReDoS
  for (const payload of redosPayloads.slice(0, 2)) {
    await sleep(100);
    const start = Date.now();
    const r = await request('GET', `/api/library?search=${encodeURIComponent(payload)}`, { token: STUDENT });
    const ms = Date.now() - start;
    const slow = ms > 3000;
    record({
      endpoint: `/api/library?search=${payload}`, method: 'GET', role: 'student',
      status: r.status, expected_status: 200,
      finding: slow, severity: slow ? 'HIGH' : 'none',
      response_time_ms: ms,
      test_category: 'Injection-ReDoS',
      note: slow
        ? `ReDoS: library search "${payload}" caused ${ms}ms`
        : `library search "${payload}" → ${ms}ms OK`,
    });
  }

  // Fees: negative amount (business logic injection)
  await sleep(100);
  const feeNeg = await request('POST', '/api/fees/payment', {
    token: STUDENT,
    body: { amount: -55000, mode: 'Online', txn: 'DAST-NEG' },
  });
  record({
    endpoint: '/api/fees/payment', method: 'POST', role: 'student',
    status: feeNeg.status, expected_status: 400,
    finding: feeNeg.status === 200, severity: 'HIGH',
    response_time_ms: feeNeg.ms,
    test_category: 'Injection-BusinessLogic',
    note: feeNeg.status === 200
      ? 'CRITICAL — negative fee amount accepted; balance manipulation confirmed'
      : `negative amount rejected (${feeNeg.status})`,
  });

  // Fees: zero amount
  await sleep(100);
  const feeZero = await request('POST', '/api/fees/payment', {
    token: STUDENT,
    body: { amount: 0, mode: 'Online', txn: 'DAST-ZERO' },
  });
  record({
    endpoint: '/api/fees/payment (zero)', method: 'POST', role: 'student',
    status: feeZero.status, expected_status: 400,
    finding: feeZero.status === 200, severity: 'MEDIUM',
    response_time_ms: feeZero.ms,
    test_category: 'Injection-BusinessLogic',
    note: feeZero.status === 200
      ? 'Zero-amount payment accepted'
      : `zero amount rejected (${feeZero.status})`,
  });

  // Fees: huge fake amount (exceeds total fee)
  await sleep(100);
  const feeBig = await request('POST', '/api/fees/payment', {
    token: STUDENT,
    body: { amount: 9999999, mode: 'Online', txn: 'DAST-FAKE' },
  });
  record({
    endpoint: '/api/fees/payment (huge)', method: 'POST', role: 'student',
    status: feeBig.status, expected_status: 400,
    finding: feeBig.status === 200, severity: 'CRITICAL',
    response_time_ms: feeBig.ms,
    test_category: 'Injection-BusinessLogic',
    note: feeBig.status === 200
      ? `CRITICAL — fake payment of ₹9,999,999 accepted; fee status may show Paid`
      : `oversized amount rejected (${feeBig.status})`,
  });

  // XSS in notice title/content via admin
  await sleep(100);
  const xssNotice = await request('POST', '/api/notices', {
    token: ADMIN,
    body: { title: '<script>alert(1)</script>', content: '<img src=x onerror=alert(1)>', category: 'general' },
  });
  // Check if the server strips or encodes the tags
  const noticeTitle = xssNotice.body?.notice?.title ?? '';
  const hasScript = noticeTitle.includes('<script>') || noticeTitle.includes('onerror');
  record({
    endpoint: '/api/notices (XSS probe)', method: 'POST', role: 'admin',
    status: xssNotice.status, expected_status: 201,
    finding: hasScript, severity: hasScript ? 'HIGH' : 'LOW',
    response_time_ms: xssNotice.ms,
    test_category: 'Injection-StoredXSS',
    note: hasScript
      ? `Stored XSS: HTML tags NOT stripped — title stored as: ${noticeTitle}`
      : `HTML tags stripped correctly: "${noticeTitle}"`,
  });

  // NoSQL injection via request status update (missing validator)
  await sleep(100);
  const requests_ = await request('GET', '/api/requests', { token: ADMIN });
  const reqId = requests_.body?.requests?.[0]?._id;
  if (reqId) {
    const badStatus = await request('PUT', `/api/requests/${reqId}/status`, {
      token: ADMIN,
      body: { status: '<INVALID_ENUM_VALUE>', remarks: 'probe' },
    });
    record({
      endpoint: `/api/requests/${reqId}/status`, method: 'PUT', role: 'admin',
      status: badStatus.status, expected_status: 400,
      finding: badStatus.status === 200, severity: 'MEDIUM',
      response_time_ms: badStatus.ms,
      test_category: 'Injection-InvalidEnum',
      note: badStatus.status === 200
        ? 'Missing validator: arbitrary status string accepted by findByIdAndUpdate'
        : `invalid enum rejected (${badStatus.status})`,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CAT 7 — Rate Limiting
// ═══════════════════════════════════════════════════════════════════════════
async function cat7_ratelimit() {
  console.log('\n══ CAT 7 — Rate Limiting (30-req burst on /api/auth/login) ══');
  const promises = [];
  for (let i = 0; i < 30; i++) {
    promises.push(request('POST', '/api/auth/login', {
      body: { studentId: `PROBE${i}`, password: 'wrongpassword' },
    }));
  }
  const results = await Promise.all(promises);
  const statuses = results.map(r => r.status);
  const limited  = statuses.filter(s => s === 429).length;
  const passed   = statuses.filter(s => s !== 429 && s !== 0).length;

  record({
    endpoint: '/api/auth/login', method: 'POST', role: 'none',
    status: limited > 0 ? 429 : statuses[statuses.length - 1],
    expected_status: 429,
    finding: limited === 0, severity: limited === 0 ? 'HIGH' : 'none',
    response_time_ms: Math.max(...results.map(r => r.ms)),
    test_category: 'Rate-Limiting',
    note: `30-req burst: ${limited} blocked (429), ${passed} passed. Rate limiting ${limited > 0 ? 'ACTIVE ✓' : 'NOT TRIGGERED ✗'}`,
  });

  // Also test global limiter
  console.log('  Testing global limiter on /api/auth/me (150 req/min threshold)...');
  const glPromises = [];
  for (let i = 0; i < 40; i++) {
    glPromises.push(request('GET', '/api/auth/me', { token: STUDENT }));
  }
  const glResults = await Promise.all(glPromises);
  const glLimited = glResults.filter(r => r.status === 429).length;
  record({
    endpoint: '/api/auth/me (global limiter probe)', method: 'GET', role: 'student',
    status: glLimited > 0 ? 429 : 200,
    expected_status: 200,
    finding: false, // 40 req < 150 threshold, should not trigger
    severity: 'none', response_time_ms: 0,
    test_category: 'Rate-Limiting-Global',
    note: `40-req burst on /me: ${glLimited} got 429 (threshold is 150/min — expected 0 blocks)`,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CAT 8 — Hardcoded Credentials Static Scan
// ═══════════════════════════════════════════════════════════════════════════
async function cat8_hardcoded() {
  console.log('\n══ CAT 8 — Hardcoded Credentials & Secrets Static Scan ══');

  const root   = path.join(__dirname, '..');
  const scanDirs = ['backend'];
  const patterns = [
    { re: /Admin@?1234/g,                                     label: 'hardcoded admin password "Admin@1234/Admin1234"' },
    { re: /student123/g,                                      label: 'hardcoded seed password "student123"' },
    { re: /password\s*[:=]\s*['"`][^'"`\n]{4,}/gi,          label: 'hardcoded password literal' },
    { re: /JWT_SECRET\s*=\s*['"`][^'"`\n]{4,}/g,            label: 'JWT_SECRET hardcoded in source' },
    { re: /sk-ant-[a-zA-Z0-9\-_]{20,}/g,                    label: 'Anthropic API key pattern' },
    { re: /mongodb\+srv:\/\/[^@\s]+@/gi,                     label: 'MongoDB connection string with credentials' },
    { re: /MONGO_URI\s*=\s*mongodb[^\s'"]+/g,               label: 'MONGO_URI inline value' },
    { re: /[a-zA-Z0-9_]+_(KEY|SECRET|PASSWORD|TOKEN|PASS)\s*=\s*[^\s'"$\n]{6,}/gi, label: 'env credential assignment' },
  ];

  const findings = [];

  function scanFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    // Skip node_modules, .git, .env files (those are expected), binary files
    if (filePath.includes('node_modules') || filePath.includes('.git')) return;
    let content;
    try { content = fs.readFileSync(filePath, 'utf8'); } catch { return; }

    for (const { re, label } of patterns) {
      re.lastIndex = 0;
      if (re.test(content)) {
        findings.push({ file: path.relative(root, filePath), pattern: label });
      }
    }
  }

  function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'automated_test'].includes(entry.name)) walkDir(full);
      } else if (entry.isFile() && /\.(js|ts|json|env|yml|yaml|md|sh)$/.test(entry.name)) {
        scanFile(full);
      }
    }
  }

  for (const d of scanDirs) walkDir(path.join(root, d));
  // Also scan root-level scripts
  for (const f of fs.readdirSync(root)) {
    if (/\.(js|ts|env|json)$/.test(f)) scanFile(path.join(root, f));
  }

  if (findings.length === 0) {
    record({
      endpoint: '(static scan)', method: 'SCAN', role: 'n/a',
      status: 0, expected_status: 0, finding: false, severity: 'none',
      response_time_ms: 0, test_category: 'Hardcoded-Creds',
      note: 'No hardcoded credentials found in scanned source files.',
    });
  } else {
    for (const { file, pattern } of findings) {
      record({
        endpoint: `(static: ${file})`, method: 'SCAN', role: 'n/a',
        status: 0, expected_status: 0, finding: true, severity: 'CRITICAL',
        response_time_ms: 0, test_category: 'Hardcoded-Creds',
        note: `Hardcoded secret in ${file}: ${pattern}`,
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log(' CampusAssist DAST Runner');
  console.log(`  Base URL  : ${BASE}`);
  console.log(`  Student ID: ${STUDENT_ID}`);
  console.log(`  Admin ID  : ${ADMIN_ID}`);
  console.log('═══════════════════════════════════════════════\n');

  console.log('[Setup] Discovering placeholder IDs...');
  const ids       = await discoverPlaceholders();
  const endpoints = resolveEndpoints(ids);

  // Save endpoint list
  fs.writeFileSync(
    path.join(__dirname, 'endpoints.json'),
    JSON.stringify(endpoints.map(([m, p, a]) => ({ method: m, path: p, access: a })), null, 2)
  );
  console.log(`\n[Setup] ${endpoints.length} endpoints registered.`);

  await cat1_authn(endpoints);
  await cat2_authz(endpoints);
  await cat3_idor(ids);
  await cat4_rbac(endpoints);
  await cat5_tamper(endpoints);
  await cat6_injection();
  await cat7_ratelimit();
  await cat8_hardcoded();

  // ── Write report.json ──────────────────────────────────────────────────
  const reportPath = path.join(__dirname, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(RESULTS, null, 2));

  // ── Print summary ──────────────────────────────────────────────────────
  const findings = RESULTS.filter(r => r.finding);
  const bySeverity = {};
  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  }
  const byCategory = {};
  for (const f of findings) {
    byCategory[f.test_category] = (byCategory[f.test_category] || 0) + 1;
  }

  console.log('\n\n═══════════════════════════════════════════════');
  console.log(' DAST SUMMARY');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Endpoints catalogued : ${endpoints.length}`);
  console.log(`  Total tests run      : ${RESULTS.length}`);
  console.log(`  FINDINGS             : ${findings.length}`);
  console.log(`  ├─ CRITICAL : ${bySeverity['CRITICAL'] || 0}`);
  console.log(`  ├─ HIGH     : ${bySeverity['HIGH']     || 0}`);
  console.log(`  ├─ MEDIUM   : ${bySeverity['MEDIUM']   || 0}`);
  console.log(`  └─ LOW      : ${bySeverity['LOW']      || 0}`);
  console.log('\n  Findings by category:');
  for (const [cat, cnt] of Object.entries(byCategory)) {
    console.log(`    ${cat.padEnd(38)}: ${cnt}`);
  }
  console.log('\n  Top issues:');
  const critHighFindings = findings.filter(f => ['CRITICAL','HIGH'].includes(f.severity));
  for (const f of critHighFindings.slice(0, 15)) {
    const icon = f.severity === 'CRITICAL' ? '✗✗' : '✗ ';
    console.log(`    ${icon} [${f.severity}] ${f.method} ${f.endpoint} — ${f.note}`);
  }
  if (critHighFindings.length > 15) {
    console.log(`    ... and ${critHighFindings.length - 15} more (see report.json)`);
  }

  console.log(`\n  Full report: ${reportPath}`);
  console.log('═══════════════════════════════════════════════');
}

main().catch(err => { console.error('Runner fatal error:', err); process.exit(1); });
