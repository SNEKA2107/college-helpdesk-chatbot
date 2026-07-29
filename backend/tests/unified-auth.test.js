/**
 * Unified credential-based authentication.
 *
 * One endpoint, POST /api/auth/login, resolves a student register number, a
 * faculty staff ID, an admin ID or an email — case-insensitively — and the ROLE
 * comes from the stored account, never from the request. These tests pin that
 * contract, the account-state rules, and backward compatibility with the older
 * request shapes.
 *
 *   cd backend && node --test tests/unified-auth.test.js
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unified-auth-test-secret';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../models/User');
const Department = require('../models/Department');
const { bootstrapDepartments } = require('../services/departments');

let mongod, server, base;

function api(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const req = http.request(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, res => {
      let raw = '';
      res.on('data', c => (raw += c));
      res.on('end', () => resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : null }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const login = (identifier, password) => api('POST', '/api/auth/login', { identifier, password });

// Mirrors frontend services/auth.js homePath(): the role decides the landing page.
const homePathFor = role =>
  role === 'admin' ? '/admin/dashboard' : role === 'faculty' ? '/faculty/dashboard' : '/student/dashboard';

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Department.init();
  await bootstrapDepartments();

  await User.create({
    name: 'Asha R', studentId: '192320001', email: 'Asha.R@college.edu',
    password: 'student123', department: 'IT', semester: '6th',
    role: 'student', approvalStatus: 'approved',
  });
  await User.create({
    name: 'Dr. Meera', studentId: 'FAC0101', email: 'meera.fac0101@college.edu',
    password: 'Faculty@2026', department: 'CSE', role: 'faculty', semester: '',
    designation: 'HOD', approvalStatus: 'approved',
    assignedSubjects: [{ code: 'CS3401', name: 'Data Structures', department: 'CSE', semester: '6th', section: '', year: '', batch: '2023' }],
  });
  await User.create({
    name: 'Exam Officer', studentId: 'ADM001', email: 'exam.adm001@college.edu',
    password: 'Admin@2026', department: 'Admin', role: 'admin', semester: '',
    designation: 'Exam Admin', approvalStatus: 'approved',
  });

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/auth', require('../routes/auth'));
  app.use('/api/faculty-portal', require('../routes/facultyPortal'));
  app.use('/api/students', require('../routes/students'));
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  server.close();
  await mongoose.disconnect();
  await mongod.stop();
});

// ── The six credential forms ────────────────────────────────────────────────

const CASES = [
  ['student register number', '192320001', 'student123', 'student'],
  ['student email', 'asha.r@college.edu', 'student123', 'student'],
  ['faculty staff ID', 'FAC0101', 'Faculty@2026', 'faculty'],
  ['faculty email', 'meera.fac0101@college.edu', 'Faculty@2026', 'faculty'],
  ['admin ID', 'ADM001', 'Admin@2026', 'admin'],
  ['admin email', 'exam.adm001@college.edu', 'Admin@2026', 'admin'],
];

for (const [label, identifier, password, role] of CASES) {
  test(`login by ${label} → ${role} dashboard`, async () => {
    const res = await login(identifier, password);
    assert.strictEqual(res.status, 200, res.body && res.body.message);
    assert.strictEqual(res.body.user.role, role, 'the backend decides the role');
    assert.ok(res.body.token, 'a JWT is issued');
    assert.strictEqual(homePathFor(res.body.user.role), homePathFor(role));
  });
}

// ── Case-insensitivity ──────────────────────────────────────────────────────

test('email login is case-insensitive', async () => {
  for (const form of ['ASHA.R@COLLEGE.EDU', 'Asha.R@College.Edu', 'asha.r@college.edu']) {
    const res = await login(form, 'student123');
    assert.strictEqual(res.status, 200, `failed for ${form}`);
    assert.strictEqual(res.body.user.studentId, '192320001');
  }
});

test('ID login is case-insensitive', async () => {
  for (const form of ['fac0101', 'FAC0101', 'FaC0101']) {
    const res = await login(form, 'Faculty@2026');
    assert.strictEqual(res.status, 200, `failed for ${form}`);
    assert.strictEqual(res.body.user.role, 'faculty');
  }
});

// ── The client can never choose a role ──────────────────────────────────────

test('a role supplied by the client is ignored', async () => {
  const res = await api('POST', '/api/auth/login', {
    identifier: '192320001', password: 'student123', role: 'admin',
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.user.role, 'student', 'privilege cannot be requested');
});

// ── Backward compatibility ──────────────────────────────────────────────────

test('the legacy { studentId } request shape still works', async () => {
  const res = await api('POST', '/api/auth/login', { studentId: '192320001', password: 'student123' });
  assert.strictEqual(res.status, 200);
});

test('the legacy { email } request shape still works', async () => {
  const res = await api('POST', '/api/auth/login', { email: 'exam.adm001@college.edu', password: 'Admin@2026' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.user.role, 'admin');
});

test('/auth/faculty-login still works and stays faculty-only', async () => {
  const ok = await api('POST', '/api/auth/faculty-login', { email: 'meera.fac0101@college.edu', password: 'Faculty@2026' });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.body.user.role, 'faculty');

  const wrongRole = await api('POST', '/api/auth/faculty-login', { email: 'exam.adm001@college.edu', password: 'Admin@2026' });
  assert.strictEqual(wrongRole.status, 401, 'an admin must not authenticate through the faculty endpoint');
});

// ── Rejections ──────────────────────────────────────────────────────────────

test('a wrong password is rejected', async () => {
  assert.strictEqual((await login('FAC0101', 'not-the-password')).status, 401);
});

test('an unknown identifier is rejected', async () => {
  assert.strictEqual((await login('NOSUCHPERSON', 'whatever')).status, 401);
});

test('unknown account and wrong password are indistinguishable', async () => {
  // Otherwise the endpoint becomes a register-number enumeration oracle.
  const missing = await login('192399999', 'whatever');
  const wrongPw = await login('192320001', 'whatever');
  assert.strictEqual(missing.status, wrongPw.status);
  assert.strictEqual(missing.body.message, wrongPw.body.message);
});

test('a missing identifier is a 400 naming what is accepted', async () => {
  const res = await api('POST', '/api/auth/login', { password: 'student123' });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.message, /register number|staff ID|admin ID|email/i);
});

test('a deactivated account cannot log in', async () => {
  await User.updateOne({ studentId: 'ADM001' }, { isActive: false });
  const res = await login('ADM001', 'Admin@2026');
  assert.strictEqual(res.status, 403);
  assert.match(res.body.message, /deactivated/i);
  await User.updateOne({ studentId: 'ADM001' }, { isActive: true });
});

test('a pending student still cannot log in through the unified endpoint', async () => {
  await User.create({
    name: 'Pending P', studentId: '192320999', email: 'pending@college.edu',
    password: 'student123', department: 'IT', semester: '1st',
    role: 'student', approvalStatus: 'pending',
  });
  const res = await login('192320999', 'student123');
  assert.strictEqual(res.status, 403);
  assert.match(res.body.message, /pending admin approval/i);
});

// ── RBAC is unchanged by the new login path ─────────────────────────────────

test('RBAC still holds for tokens issued by the unified login', async () => {
  const student = (await login('192320001', 'student123')).body.token;
  const faculty = (await login('FAC0101', 'Faculty@2026')).body.token;
  const admin = (await login('ADM001', 'Admin@2026')).body.token;

  assert.strictEqual((await api('GET', '/api/faculty-portal/subjects', undefined, faculty)).status, 200);
  assert.strictEqual((await api('GET', '/api/faculty-portal/subjects', undefined, student)).status, 403);
  assert.strictEqual((await api('GET', '/api/faculty-portal/subjects', undefined, admin)).status, 403);
  assert.strictEqual((await api('GET', '/api/students/pending', undefined, admin)).status, 200);
  assert.strictEqual((await api('GET', '/api/students/pending', undefined, faculty)).status, 403);
  assert.strictEqual((await api('GET', '/api/students/pending')).status, 401);
});

test('a seeded faculty resolves a real class roster on first login', async () => {
  const token = (await login('FAC0101', 'Faculty@2026')).body.token;
  const subjects = await api('GET', '/api/faculty-portal/subjects', undefined, token);
  assert.strictEqual(subjects.status, 200);
  assert.ok(subjects.body.subjects.length > 0, 'assignedSubjects are populated');
  // Blank section/year widen the class so the roster is not empty.
  assert.strictEqual(subjects.body.classes[0].section, '');
  assert.strictEqual(subjects.body.classes[0].year, '');
});
