/**
 * Security regression suite.
 *
 * Every test here pins a control that closed a specific finding from the July
 * 2026 backend security assessment. They are written as attacks: each one
 * performs the action the finding described and asserts it is now refused.
 *
 *   cd backend && node --test tests/security.test.js
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'security-test-secret-value';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../models/User');
const Department = require('../models/Department');
const Book = require('../models/Book');
const Fee = require('../models/Fee');
const Event = require('../models/Event');
const Notice = require('../models/Notice');
const { bootstrapDepartments } = require('../services/departments');
const AuditLog = require('../models/AuditLog');
const QueryLog = require('../models/QueryLog');
const { coerceQuery, searchRegex, pick, escapeHtml } = require('../utils/sanitize');
const { validateUpload, DOCUMENT_TYPES, IMAGE_TYPES, ATTACHMENT_TYPES } = require('../utils/upload');
const { logAudit, auditFailures } = require('../utils/audit');
const { redactText } = require('../utils/redact');
const loginAttempts = require('../utils/loginAttempts');

let mongod, server, base;
let stuToken, admToken, stuId, admId;

const PDF_B64 = 'JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZz4+ZW5kb2JqCnRyYWlsZXI8PC9Sb290IDEgMCBSPj4KJSVFT0YK';
const PDF = `data:application/pdf;base64,${PDF_B64}`;
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ';

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

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Department.init();
  await bootstrapDepartments();

  const stu = await User.create({
    name: 'Test Student', studentId: 'SEC001', email: 'sec.student@college.edu',
    password: 'Str0ngStudent!26', department: 'IT', semester: '5th', section: 'A',
    role: 'student', approvalStatus: 'approved',
  });
  const adm = await User.create({
    name: 'Test Admin', studentId: 'SECADM', email: 'sec.admin@college.edu',
    password: 'Str0ngAdmin!26', department: 'Admin', role: 'admin', semester: '',
    approvalStatus: 'approved',
  });
  stuId = String(stu._id); admId = String(adm._id);

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/auth', require('../routes/auth'));
  app.use('/api/students', require('../routes/students'));
  app.use('/api/library', require('../routes/library'));
  app.use('/api/fees', require('../routes/fees'));
  app.use('/api/events', require('../routes/events'));
  app.use('/api/notices', require('../routes/notices'));
  app.use('/api/requests', require('../routes/requests'));
  app.use('/api/contact', require('../routes/contact'));
  app.use('/api/leave', require('../routes/leave'));
  server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;

  stuToken = (await api('POST', '/api/auth/login', { identifier: 'SEC001', password: 'Str0ngStudent!26' })).body.token;
  admToken = (await api('POST', '/api/auth/login', { identifier: 'SECADM', password: 'Str0ngAdmin!26' })).body.token;
  assert.ok(stuToken && admToken, 'fixtures must authenticate');
});

test.after(async () => {
  if (server) server.close();
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

// ── F-04 · ReDoS ────────────────────────────────────────────────────────────
test('F-04: a catastrophic regex in ?search= is neutralised and returns promptly', async () => {
  const started = Date.now();
  const res = await api('GET', '/api/library?search=' + encodeURIComponent('(a+)+$'), undefined, stuToken);
  const elapsed = Date.now() - started;
  assert.strictEqual(res.status, 200);
  assert.ok(elapsed < 2000, `expected a prompt response, took ${elapsed}ms`);
});

test('F-04: regex metacharacters are matched literally, not compiled', async () => {
  await Book.create({ title: 'Plain Title', author: 'Someone', isbn: 'SEC-1', category: 'CS' });
  await Book.create({ title: 'a+b Algebra', author: 'Other', isbn: 'SEC-2', category: 'CS' });
  const res = await api('GET', '/api/library?search=' + encodeURIComponent('a+b'), undefined, stuToken);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.books.length, 1);
  assert.strictEqual(res.body.books[0].isbn, 'SEC-2');
});

test('F-04: search input is length-capped', () => {
  const rx = searchRegex('x'.repeat(500));
  assert.ok(rx.source.length <= 128, 'pattern must be bounded');
});

// ── F-05 · NoSQL operator injection ─────────────────────────────────────────
test('F-05: coerceQuery rejects operator objects and arrays', () => {
  assert.strictEqual(coerceQuery({ $ne: 'x' }), undefined);
  assert.strictEqual(coerceQuery(['a', 'b']), undefined);
  assert.strictEqual(coerceQuery('CSE'), 'CSE');
  assert.strictEqual(coerceQuery(''), undefined);
});

test('F-05: ?status[$ne]= cannot widen the student filter', async () => {
  const clean = await api('GET', '/api/students?status=approved', undefined, admToken);
  const attack = await api('GET', '/api/students?status[$ne]=approved', undefined, admToken);
  assert.strictEqual(attack.status, 200);
  // The operator is discarded, so the attack returns the UNFILTERED list rather
  // than the inverse set the attacker asked for.
  assert.ok(attack.body.students.every(s => s.role === 'student'));
  assert.ok(clean.body.students.length >= 1);
});

test('F-05: ?category[$ne]= is ignored on the library filter', async () => {
  const res = await api('GET', '/api/library?category[$ne]=nothing', undefined, stuToken);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.books.length >= 2, 'operator discarded, not applied');
});

// ── F-06 · Mass assignment ──────────────────────────────────────────────────
test('F-06: pick() drops unlisted and prototype-polluting keys', () => {
  const out = pick({ title: 'ok', __proto__: 'x', 'a.b': 1, $set: {}, secret: 'no' }, ['title', 'seats']);
  assert.deepStrictEqual(Object.keys(out), ['title']);
  assert.strictEqual({}.polluted, undefined);
});

test('F-06: event creation ignores a client-supplied registrations array', async () => {
  const res = await api('POST', '/api/events', {
    title: 'Sec Test', category: 'Technical', date: '2026-12-01', venue: 'Hall',
    organizer: 'Dept', seats: 2, registrations: [stuId, admId],
  }, admToken);
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.event.registrations.length, 0, 'registrations must not be settable');
});

test('F-06: notice update cannot overwrite server-owned fields', async () => {
  const created = await api('POST', '/api/notices', { title: 'N1', content: 'Body' }, admToken);
  const id = created.body.notice._id;
  const before = created.body.notice.postedBy;
  const res = await api('PUT', `/api/notices/${id}`, {
    title: 'N1 edited', postedBy: 'Impersonated', createdBy: stuId,
  }, admToken);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.notice.title, 'N1 edited');
  assert.strictEqual(res.body.notice.postedBy, before, 'postedBy is server-owned');
});

// ── F-08 · File upload ──────────────────────────────────────────────────────
test('F-08: an HTML payload is rejected by every upload allowlist', () => {
  const evil = 'data:text/html;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64');
  for (const [name, allowed] of [['documents', DOCUMENT_TYPES], ['images', IMAGE_TYPES], ['attachments', ATTACHMENT_TYPES]]) {
    const r = validateUpload(evil, 'x.html', 'text/html', { allowed, maxBytes: 1e6 });
    assert.strictEqual(r.ok, false, `${name} must reject text/html`);
  }
});

test('F-08: an SVG is rejected as a profile image', () => {
  const svg = 'data:image/svg+xml;base64,' + Buffer.from('<svg onload=alert(1)/>').toString('base64');
  assert.strictEqual(validateUpload(svg, 'a.svg', 'image/svg+xml', { allowed: IMAGE_TYPES }).ok, false);
});

test('F-08: a declared type that disagrees with the data URL is rejected', () => {
  const r = validateUpload(PDF, 'notes.pdf', 'image/png', { allowed: DOCUMENT_TYPES });
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /mismatch/i);
});

test('F-08: content whose magic bytes do not match the declared MIME is rejected', () => {
  const fake = 'data:application/pdf;base64,' + Buffer.from('this is not a pdf at all').toString('base64');
  const r = validateUpload(fake, 'fake.pdf', 'application/pdf', { allowed: DOCUMENT_TYPES });
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /do not match/i);
});

test('F-08: a genuine PDF and PNG are accepted', () => {
  assert.strictEqual(validateUpload(PDF, 'ok.pdf', 'application/pdf', { allowed: DOCUMENT_TYPES }).ok, true);
  assert.strictEqual(validateUpload(PNG, 'ok.png', 'image/png', { allowed: IMAGE_TYPES }).ok, true);
});

test('F-08: a traversal filename is sanitised', () => {
  const r = validateUpload(PDF, '../../../etc/passwd.pdf', 'application/pdf', { allowed: DOCUMENT_TYPES });
  assert.strictEqual(r.ok, true);
  assert.ok(!r.fields.name.includes('/'), 'path separators removed');
  assert.ok(!r.fields.name.includes('..'), 'traversal sequences removed');
});

test('F-08: the decoded-size cap is enforced', () => {
  const big = 'data:application/pdf;base64,' + Buffer.concat([
    Buffer.from('%PDF-1.4\n'), Buffer.alloc(200 * 1024, 0x41),
  ]).toString('base64');
  const r = validateUpload(big, 'big.pdf', 'application/pdf', { allowed: DOCUMENT_TYPES, maxBytes: 50 * 1024 });
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /too large/i);
});

test('F-08: profile photo route rejects a non-image payload', async () => {
  const evil = 'data:text/html;base64,' + Buffer.from('<script>x</script>').toString('base64');
  const res = await api('PUT', '/api/auth/profile', { name: 'Test Student', photo: evil }, stuToken);
  assert.strictEqual(res.status, 400);
});

test('F-08: profile photo route accepts a real PNG', async () => {
  const res = await api('PUT', '/api/auth/profile', { name: 'Test Student', photo: PNG }, stuToken);
  assert.strictEqual(res.status, 200);
});

// ── F-09 · Cohort escalation ────────────────────────────────────────────────
test('F-09: a student cannot change their own semester', async () => {
  const res = await api('PUT', `/api/students/${stuId}`, { semester: '8th' }, stuToken);
  assert.strictEqual(res.status, 400);
  assert.match(res.body.message, /cannot change/i);
  const fresh = await User.findById(stuId);
  assert.strictEqual(fresh.semester, '5th', 'cohort unchanged');
});

test('F-09: a student cannot change year or section via the profile route', async () => {
  await api('PUT', '/api/auth/profile', { name: 'Test Student', year: '4th', section: 'Z' }, stuToken);
  const fresh = await User.findById(stuId);
  assert.strictEqual(fresh.section, 'A', 'section unchanged');
  assert.notStrictEqual(fresh.year, '4th');
});

test('F-09: an admin can still set a student cohort', async () => {
  const res = await api('PUT', `/api/students/${stuId}`, { semester: '6th' }, admToken);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.student.semester, '6th');
  await User.findByIdAndUpdate(stuId, { semester: '5th' });   // restore
});

// ── F-11 · Stored XSS ───────────────────────────────────────────────────────
test('F-11: contact messages are stripped of HTML on write', async () => {
  const res = await api('POST', '/api/contact', {
    department: 'IT', subject: '<b>Hi</b>', message: '<img src=x onerror=alert(1)>Hello',
  }, stuToken);
  assert.strictEqual(res.status, 201);
  assert.ok(!res.body.contact.subject.includes('<b>'));
  assert.ok(!res.body.contact.message.includes('<img'));
  assert.ok(res.body.contact.message.includes('Hello'), 'text content preserved');
});

// ── F-10 · Email HTML injection ─────────────────────────────────────────────
test('F-10: escapeHtml neutralises markup used in notification emails', () => {
  const out = escapeHtml('<a href="https://evil.test">Click</a>');
  assert.ok(!out.includes('<a '));
  assert.ok(out.includes('&lt;a'));
  assert.ok(out.includes('&quot;'));
});

// ── F-12 · Race conditions ──────────────────────────────────────────────────
test('F-12: concurrent fee payments cannot exceed the balance', async () => {
  const fee = await Fee.create({
    student: stuId, studentId: 'SEC001', semester: '5th', academicYear: '2026-27',
    components: [{ name: 'Tuition', amount: 1000 }], total: 1000, dueDate: '2026-12-01', history: [],
  });
  // Ten simultaneous attempts, each for the FULL balance.
  const results = await Promise.all(
    Array.from({ length: 10 }, () => api('POST', '/api/fees/payment', { amount: 1000, mode: 'Online' }, stuToken))
  );
  const accepted = results.filter(r => r.status === 201).length;
  assert.strictEqual(accepted, 1, `exactly one payment must succeed, got ${accepted}`);
  const after = await Fee.findById(fee._id);
  const paid = after.history.reduce((s, p) => s + p.amount, 0);
  assert.ok(paid <= 1000, `recorded ₹${paid} against a ₹1000 balance`);
});

test('F-12: concurrent event registrations cannot exceed the seat cap', async () => {
  const ev = await Event.create({
    title: 'Race', category: 'Technical', date: new Date('2026-12-01'),
    venue: 'Hall', organizer: 'Dept', seats: 1,
  });
  const results = await Promise.all(
    Array.from({ length: 8 }, () => api('POST', `/api/events/${ev._id}/register`, {}, stuToken))
  );
  assert.strictEqual(results.filter(r => r.status === 200).length, 1);
  const after = await Event.findById(ev._id);
  assert.strictEqual(after.registrations.length, 1);
});

// ── F-13 · Workflow bypass ──────────────────────────────────────────────────
test('F-13: an out-of-enum request status is rejected', async () => {
  const created = await api('POST', '/api/requests', { type: 'Bonafide Certificate', purpose: 'Bank' }, stuToken);
  const id = created.body.request._id;
  const res = await api('PUT', `/api/requests/${id}/status`, { status: 'PWNED' }, admToken);
  assert.strictEqual(res.status, 400);
  assert.match(res.body.message, /Status must be one of/);
});

test('F-13: a valid request status is still accepted', async () => {
  const created = await api('POST', '/api/requests', { type: 'Marksheet', purpose: 'Apply' }, stuToken);
  const res = await api('PUT', `/api/requests/${created.body.request._id}/status`,
    { status: 'Processing' }, admToken);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.request.status, 'Processing');
});

// ── F-14 · Type confusion ───────────────────────────────────────────────────
test('F-14: a repeated ?studentId does not produce a 500', async () => {
  const res = await api('GET', '/api/students?search=a&search=b', undefined, admToken);
  assert.notStrictEqual(res.status, 500);
});

// ── F-17 / F-18 · Session security ──────────────────────────────────────────
test('F-17: an issued token carries a revocation claim and a bounded lifetime', () => {
  const decoded = jwt.decode(stuToken);
  assert.ok(typeof decoded.v === 'number', 'tokenVersion claim present');
  const lifetimeHours = (decoded.exp - decoded.iat) / 3600;
  assert.ok(lifetimeHours <= 24, `lifetime ${lifetimeHours}h must be <= 24h`);
});

test('F-18: logout revokes the token server-side', async () => {
  const fresh = (await api('POST', '/api/auth/login', { identifier: 'SEC001', password: 'Str0ngStudent!26' })).body.token;
  assert.strictEqual((await api('GET', '/api/auth/me', undefined, fresh)).status, 200);
  assert.strictEqual((await api('POST', '/api/auth/logout', {}, fresh)).status, 200);
  const after = await api('GET', '/api/auth/me', undefined, fresh);
  assert.strictEqual(after.status, 401, 'the token must stop working after logout');
});

test('F-18: a password change signs out other sessions', async () => {
  const sessionA = (await api('POST', '/api/auth/login', { identifier: 'SECADM', password: 'Str0ngAdmin!26' })).body.token;
  const sessionB = (await api('POST', '/api/auth/login', { identifier: 'SECADM', password: 'Str0ngAdmin!26' })).body.token;
  const changed = await api('PUT', '/api/auth/change-password',
    { currentPassword: 'Str0ngAdmin!26', newPassword: 'Rotated!Adm26' }, sessionA);
  assert.strictEqual(changed.status, 200);
  assert.strictEqual((await api('GET', '/api/auth/me', undefined, sessionB)).status, 401, 'other session revoked');
  assert.strictEqual((await api('GET', '/api/auth/me', undefined, changed.body.token)).status, 200, 'caller stays in');
  admToken = changed.body.token;
});

// ── F-22 · Password policy ──────────────────────────────────────────────────
test('F-22: a common password is rejected at registration', async () => {
  const res = await api('POST', '/api/auth/register', {
    name: 'Weak', studentId: 'WEAK01', email: 'weak@college.edu',
    password: 'admin@123', department: 'IT',
  });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.message, /too common/i);
});

test('F-22: a password beyond bcrypt\'s 72-byte limit is rejected, not truncated', async () => {
  const res = await api('POST', '/api/auth/register', {
    name: 'Long', studentId: 'LONG01', email: 'long@college.edu',
    password: 'A1!' + 'x'.repeat(90), department: 'IT',
  });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.message, /72 bytes/i);
});

test('F-22: change-password enforces the registration policy', async () => {
  // Re-login first: the F-18 logout test above revoked every token issued to
  // this account, which is exactly the behaviour it asserts.
  stuToken = (await api('POST', '/api/auth/login',
    { identifier: 'SEC001', password: 'Str0ngStudent!26' })).body.token;
  const res = await api('PUT', '/api/auth/change-password',
    { currentPassword: 'Str0ngStudent!26', newPassword: 'password123' }, stuToken);
  assert.strictEqual(res.status, 400);
});

test('F-22: a strong password is accepted', async () => {
  const res = await api('POST', '/api/auth/register', {
    name: 'Strong', studentId: 'STRONG1', email: 'strong@college.edu',
    password: 'V3ry-Str0ng!Pass', department: 'IT',
  });
  assert.strictEqual(res.status, 201);
});

// ── F-24 · Username enumeration ─────────────────────────────────────────────
test('F-24: unknown user and wrong password are indistinguishable in body and timing', async () => {
  const sample = async (id, pw) => {
    const t0 = process.hrtime.bigint();
    const r = await api('POST', '/api/auth/login', { identifier: id, password: pw });
    return { ms: Number(process.hrtime.bigint() - t0) / 1e6, r };
  };
  const unknown = [], wrong = [];
  for (let i = 0; i < 5; i++) {
    unknown.push((await sample('NOSUCHUSER', 'Whatever!123')).ms);
    wrong.push((await sample('SEC001', 'Whatever!123')).ms);
  }
  const a = await sample('NOSUCHUSER', 'Whatever!123');
  const b = await sample('SEC001', 'Whatever!123');
  assert.strictEqual(a.r.status, b.r.status);
  assert.strictEqual(a.r.body.message, b.r.body.message, 'identical message');

  const med = xs => xs.sort((p, q) => p - q)[Math.floor(xs.length / 2)];
  const ratio = med(unknown) / med(wrong);
  assert.ok(ratio > 0.4 && ratio < 2.5, `timing ratio ${ratio.toFixed(2)} indicates an enumeration channel`);
});

// ── F-26 · Excessive data exposure ──────────────────────────────────────────
test('F-26: login and /me return a view model, not the raw document', async () => {
  const login = await api('POST', '/api/auth/login', { identifier: 'SEC001', password: 'Str0ngStudent!26' });
  for (const u of [login.body.user, (await api('GET', '/api/auth/me', undefined, login.body.token)).body.user]) {
    assert.strictEqual(u.password, undefined);
    assert.strictEqual(u.tokenVersion, undefined, 'session counter must not leak');
    assert.strictEqual(u.approvedBy, undefined);
    assert.strictEqual(u.rejectionReason, undefined);
    assert.ok(u.name && u.role, 'the fields the UI needs are present');
  }
  stuToken = login.body.token;
});

// ── Regression guards on controls that already existed ──────────────────────
test('REGRESSION: self-registration still cannot choose its own role', async () => {
  const res = await api('POST', '/api/auth/register', {
    name: 'Escalate', studentId: 'ESC001', email: 'esc@college.edu',
    password: 'V3ry-Str0ng!Pass', department: 'IT', role: 'admin', approvalStatus: 'approved',
  });
  assert.strictEqual(res.status, 201);
  const created = await User.findOne({ studentId: 'ESC001' });
  assert.strictEqual(created.role, 'student');
  assert.strictEqual(created.approvalStatus, 'pending');
});

test('REGRESSION: a student token is still refused on admin routes', async () => {
  assert.strictEqual((await api('GET', '/api/students', undefined, stuToken)).status, 403);
});

test('REGRESSION: an unauthenticated request is still refused', async () => {
  assert.strictEqual((await api('GET', '/api/students')).status, 401);
});

test('REGRESSION: a token signed with the wrong secret is refused', async () => {
  const forged = jwt.sign({ id: admId, v: 0 }, 'not-the-real-secret', { expiresIn: '1h' });
  assert.strictEqual((await api('GET', '/api/auth/me', undefined, forged)).status, 401);
});

test('REGRESSION: an alg:none token is refused', async () => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ id: admId, v: 0 })).toString('base64url');
  assert.strictEqual((await api('GET', '/api/auth/me', undefined, `${header}.${payload}.`)).status, 401);
});

// ── F-19 · Per-account lockout ──────────────────────────────────────────────
test('F-19: repeated failures lock the ACCOUNT, not just the source IP', async () => {
  loginAttempts.reset();
  const id = 'SEC001';
  let locked = null;
  for (let i = 0; i < loginAttempts.LOCK_THRESHOLD + 1; i++) {
    const r = await api('POST', '/api/auth/login', { identifier: id, password: 'WrongPass!' + i });
    if (r.status === 429) { locked = r; break; }
  }
  assert.ok(locked, 'the account must lock within the threshold');
  assert.strictEqual(locked.status, 429);
  assert.match(locked.body.message, /Too many failed attempts/i);
});

test('F-19: the lock holds even against the correct password', async () => {
  // The account is still locked from the previous test.
  const r = await api('POST', '/api/auth/login', { identifier: 'SEC001', password: 'Str0ngStudent!26' });
  assert.strictEqual(r.status, 429, 'a locked account must not authenticate');
  loginAttempts.reset();
});

test('F-19: a successful login clears the failure counter', async () => {
  loginAttempts.reset();
  for (let i = 0; i < 3; i++) {
    await api('POST', '/api/auth/login', { identifier: 'SEC001', password: 'Wrong!' + i });
  }
  assert.ok(loginAttempts.check('SEC001').failures >= 3, 'failures recorded');
  const ok = await api('POST', '/api/auth/login', { identifier: 'SEC001', password: 'Str0ngStudent!26' });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(loginAttempts.check('SEC001').failures, 0, 'counter cleared on success');
  stuToken = ok.body.token;
});

test('F-19: the lockout is keyed per account, not globally', async () => {
  loginAttempts.reset();
  for (let i = 0; i < loginAttempts.LOCK_THRESHOLD + 1; i++) {
    await api('POST', '/api/auth/login', { identifier: 'SEC001', password: 'Wrong!' + i });
  }
  assert.strictEqual(loginAttempts.check('SEC001').locked, true, 'target account locked');
  // A different account from the same source must be unaffected.
  const other = await api('POST', '/api/auth/login', { identifier: 'SECADM', password: 'Rotated!Adm26' });
  assert.strictEqual(other.status, 200, 'an unrelated account must not be collateral damage');
  loginAttempts.reset();
});

test('F-19: a lockout response carries Retry-After', async () => {
  loginAttempts.reset();
  for (let i = 0; i < loginAttempts.LOCK_THRESHOLD + 1; i++) {
    await api('POST', '/api/auth/login', { identifier: 'SEC001', password: 'Wrong!' + i });
  }
  const state = loginAttempts.check('SEC001');
  assert.ok(state.retryAfterSec > 0, 'a retry window is advertised');
  loginAttempts.reset();
  stuToken = (await api('POST', '/api/auth/login',
    { identifier: 'SEC001', password: 'Str0ngStudent!26' })).body.token;
});

// ── F-29 · Audit trail integrity ────────────────────────────────────────────
test('F-29: audit entries form a verifiable hash chain', async () => {
  await AuditLog.deleteMany({});
  const req = { user: { _id: admId, name: 'Test Admin', studentId: 'SECADM' } };
  for (let i = 0; i < 5; i++) {
    await logAudit(req, 'test.action', 'Test', String(i), { i });
  }
  const rows = await AuditLog.find().sort({ seq: 1 }).lean();
  assert.strictEqual(rows.length, 5);
  assert.strictEqual(rows[0].prevHash, '', 'the first entry anchors the chain');
  for (let i = 1; i < rows.length; i++) {
    assert.strictEqual(rows[i].prevHash, rows[i - 1].hash, `entry ${i} links to its predecessor`);
  }
  const result = await AuditLog.verifyChain();
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.checked, 5);
});

test('F-29: tampering with an audit entry is detected', async () => {
  const rows = await AuditLog.find().sort({ seq: 1 }).lean();
  const target = rows[2];
  // Rewrite the recorded action without recomputing the hash — what someone with
  // database access would do to cover a track.
  await AuditLog.updateOne({ _id: target._id }, { $set: { action: 'innocent.action' } });
  const result = await AuditLog.verifyChain();
  assert.strictEqual(result.ok, false, 'the tampered entry must be detected');
  assert.strictEqual(result.brokenAt, target.seq);
  assert.match(result.reason, /do not match/i);
});

test('F-29: deleting an audit entry is detected', async () => {
  await AuditLog.deleteMany({});
  const req = { user: { _id: admId, name: 'Test Admin', studentId: 'SECADM' } };
  for (let i = 0; i < 4; i++) await logAudit(req, 'test.action', 'Test', String(i), { i });
  const rows = await AuditLog.find().sort({ seq: 1 }).lean();
  await AuditLog.deleteOne({ _id: rows[1]._id });
  const result = await AuditLog.verifyChain();
  assert.strictEqual(result.ok, false, 'a gap in the chain must be detected');
  await AuditLog.deleteMany({});
});

test('F-29: an audit-write failure increments the inspectable counter', async () => {
  const before = auditFailures.count;
  // entity is required by the schema, so omitting it forces a validation failure.
  await logAudit({ user: { _id: admId } }, 'broken.action', undefined, 'x', {});
  assert.strictEqual(auditFailures.count, before + 1, 'failure counted, not swallowed');
  assert.ok(auditFailures.lastError, 'the reason is retained for an operator');
});

// ── F-23 · Analytics redaction ──────────────────────────────────────────────
test('F-23: identifiers are masked in analytics labels', () => {
  assert.strictEqual(redactText('my marks for 192320001'), 'my marks for [id]');
  assert.strictEqual(redactText('call me on 9876543210'), 'call me on [phone]');
  assert.strictEqual(redactText('email asha.r@college.edu'), 'email [email]');
  assert.strictEqual(redactText('who is FAC0101'), 'who is [staff-id]');
});

test('F-23: redaction preserves the non-identifying text that makes grouping useful', () => {
  const out = redactText('when is the fee deadline for 192320001');
  assert.ok(out.includes('fee deadline'), 'topic survives');
  assert.ok(!out.includes('192320001'), 'identifier does not');
});

test('F-23: analytics labels are length-capped', () => {
  assert.ok(redactText('x'.repeat(500)).length <= 121);
});

test('F-23: QueryLog carries a retention TTL index', () => {
  const idx = QueryLog.schema.indexes().find(([, opts]) => opts && opts.expireAfterSeconds);
  assert.ok(idx, 'a TTL index must be declared');
  assert.ok(idx[1].expireAfterSeconds > 0);
});

test('REGRESSION: a deactivated account is cut off immediately', async () => {
  const u = await User.create({
    name: 'Temp', studentId: 'TMP001', email: 'tmp@college.edu',
    password: 'V3ry-Str0ng!Pass', department: 'IT', role: 'student', approvalStatus: 'approved',
  });
  const tok = (await api('POST', '/api/auth/login', { identifier: 'TMP001', password: 'V3ry-Str0ng!Pass' })).body.token;
  assert.strictEqual((await api('GET', '/api/auth/me', undefined, tok)).status, 200);
  await User.findByIdAndUpdate(u._id, { isActive: false });
  assert.strictEqual((await api('GET', '/api/auth/me', undefined, tok)).status, 401);
});
