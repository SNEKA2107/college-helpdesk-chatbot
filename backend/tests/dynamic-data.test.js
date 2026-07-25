/**
 * Integration tests for the "dynamic data" audit findings:
 *
 *   C-1  first-run administrator setup (and its permanent lockout afterwards)
 *   C-2  admin-created faculty get a real login account + temporary password
 *   C-3  faculty class/subject assignments actually persist (incl. year & batch)
 *   H-1  departments are data, validated against the Department collection
 *   M-1  an approved student gets the fee record their portal needs
 *   L-1  deleting a missing record is a 404, not a silent success
 *   L-2  a bad payload never returns raw Mongoose text
 *
 * Boots the real routers over an in-memory MongoDB with genuine JWT auth.
 *
 *   cd backend && node --test tests/dynamic-data.test.js
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dynamic-data-test-secret';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../models/User');
const Fee = require('../models/Fee');
const Department = require('../models/Department');
const { bootstrapDepartments } = require('../services/departments');

let mongod, server, base, adminToken, studentToken;

function api(token, method, path, body) {
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

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/auth', require('../routes/auth'));
  app.use('/api/departments', require('../routes/departments'));
  app.use('/api/faculty', require('../routes/faculty'));
  app.use('/api/faculty-portal', require('../routes/facultyPortal'));
  app.use('/api/students', require('../routes/students'));
  app.use('/api/fees', require('../routes/fees'));
  app.use('/api/timetable', require('../routes/timetable'));
  app.use('/api/events', require('../routes/events'));
  app.use('/api/attendance', require('../routes/attendance'));
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  server.close();
  await mongoose.disconnect();
  await mongod.stop();
});

// ── C-1: first-run setup ────────────────────────────────────────────────────

test('C-1: a fresh system reports that setup is required', async () => {
  const res = await api(null, 'GET', '/api/auth/setup-status');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.needsSetup, true);
});

test('C-1: setup rejects a weak password before creating anything', async () => {
  const res = await api(null, 'POST', '/api/auth/setup', {
    name: 'Registrar', studentId: 'ADMIN1', email: 'weak@college.edu', password: 'short',
  });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(await User.countDocuments({ role: 'admin' }), 0);
});

test('C-1: setup creates the first administrator and returns a usable token', async () => {
  const res = await api(null, 'POST', '/api/auth/setup', {
    name: 'Registrar', studentId: 'ADMIN1', email: 'registrar@college.edu', password: 'Setup1234',
  });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.user.role, 'admin');
  assert.strictEqual(res.body.user.approvalStatus, 'approved');
  assert.ok(res.body.token, 'a token is issued so the admin lands straight in the portal');
  adminToken = res.body.token;

  // The setup route bootstraps departments on demand, so the app is usable at once.
  await bootstrapDepartments();
  assert.ok(await Department.countDocuments() > 0);
});

test('C-1: setup is permanently closed once an administrator exists', async () => {
  const status = await api(null, 'GET', '/api/auth/setup-status');
  assert.strictEqual(status.body.needsSetup, false);

  const res = await api(null, 'POST', '/api/auth/setup', {
    name: 'Impostor', studentId: 'ADMIN2', email: 'impostor@college.edu', password: 'Setup1234',
  });
  assert.strictEqual(res.status, 410, 'a second setup attempt must be Gone, not another admin');
  assert.strictEqual(await User.countDocuments({ role: 'admin' }), 1);
});

// ── H-1: departments are data ───────────────────────────────────────────────

test('H-1: the department list is readable without a token (the registration page needs it)', async () => {
  const res = await api(null, 'GET', '/api/departments');
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.departments.length > 0);
  assert.ok(res.body.departments.every(d => d.isActive !== false));
});

test('H-1: an admin can add a department that was never in the old hardcoded enum', async () => {
  const res = await api(adminToken, 'POST', '/api/departments', {
    code: 'ROBOTICS', name: 'Robotics and Automation',
  });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.department.code, 'ROBOTICS');
});

test('H-1: department codes are unique case-insensitively', async () => {
  const res = await api(adminToken, 'POST', '/api/departments', { code: 'robotics', name: 'Dupe' });
  assert.strictEqual(res.status, 409);
});

test('H-1: a student can register into a newly created department', async () => {
  const res = await api(null, 'POST', '/api/auth/register', {
    name: 'Nila', studentId: 'RB001', email: 'nila@college.edu',
    password: 'Student123', department: 'ROBOTICS', semester: '3rd',
  });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.user.approvalStatus, 'pending', 'self-registration still awaits approval');

  const created = await User.findOne({ studentId: 'RB001' });
  assert.strictEqual(created.role, 'student', 'self-registration can never create a non-student');
});

test('H-1/L-2: an unknown department is a 400 listing the valid options, not a 500', async () => {
  const res = await api(null, 'POST', '/api/auth/register', {
    name: 'Ghost', studentId: 'XX001', email: 'ghost@college.edu',
    password: 'Student123', department: 'NOPE', semester: '1st',
  });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.message, /not a recognised department/i);
  assert.doesNotMatch(res.body.message, /enum value|validation failed/i, 'no raw Mongoose text');
});

test('H-1: a department still referenced by an account cannot be deleted', async () => {
  const dept = await Department.findOne({ code: 'ROBOTICS' });
  const res = await api(adminToken, 'DELETE', `/api/departments/${dept._id}`);
  assert.strictEqual(res.status, 409);
  assert.match(res.body.message, /Disable the department/i);
});

// ── M-1: approval provisions what the portal needs ──────────────────────────

test('M-1: approving a student creates the fee record their Fees page reads', async () => {
  const student = await User.findOne({ studentId: 'RB001' });
  const res = await api(adminToken, 'PUT', `/api/students/${student._id}/approve`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.student.approvalStatus, 'approved');
  assert.strictEqual(res.body.initialised.fee, true);

  const fee = await Fee.findOne({ student: student._id });
  assert.ok(fee, 'a fee record now exists');
  assert.ok(fee.total > 0, 'with a non-zero total from the component template');

  studentToken = jwt.sign({ id: student._id }, process.env.JWT_SECRET);
  const feesRes = await api(studentToken, 'GET', '/api/fees');
  assert.strictEqual(feesRes.status, 200, 'the Fees page is no longer a 404');
});

test('M-1: a student approved before the change gets a record on first read', async () => {
  // Simulates legacy data: approved, but never passed through initialiseStudent().
  const legacy = await User.create({
    name: 'Old Student', studentId: 'LG001', email: 'legacy@college.edu',
    password: 'Student123', department: 'CSE', semester: '5th',
    role: 'student', approvalStatus: 'approved',
  });
  assert.strictEqual(await Fee.countDocuments({ student: legacy._id }), 0);

  const token = jwt.sign({ id: legacy._id }, process.env.JWT_SECRET);
  const res = await api(token, 'GET', '/api/fees');
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.fees.total > 0);
  assert.strictEqual(await Fee.countDocuments({ student: legacy._id }), 1, 'provisioned exactly once');

  // Idempotent: a second read must not create a duplicate.
  await api(token, 'GET', '/api/fees');
  assert.strictEqual(await Fee.countDocuments({ student: legacy._id }), 1);
});

// ── C-2 / C-3: faculty accounts and assignments ─────────────────────────────

let facultyId, facultyStaffId, facultyTempPassword;

test('C-2: adding a faculty member creates a login account with a temporary password', async () => {
  const res = await api(adminToken, 'POST', '/api/faculty', {
    name: 'Dr. Meera', email: 'meera@college.edu', department: 'ROBOTICS',
    designation: 'Associate Professor', subjects: 'Control Systems',
  });
  assert.strictEqual(res.status, 201);
  assert.ok(res.body.account.temporaryPassword, 'the admin is handed a one-time password');
  assert.ok(/^FAC\d{4}$/.test(res.body.account.staffId));

  facultyId = res.body.faculty._id;
  facultyStaffId = res.body.account.staffId;
  facultyTempPassword = res.body.account.temporaryPassword;

  const user = await User.findOne({ email: 'meera@college.edu' });
  assert.strictEqual(user.role, 'faculty');
  assert.strictEqual(user.mustChangePassword, true, 'flagged so the UI prompts for a real password');
  assert.strictEqual(user.approvalStatus, 'approved', 'staff bypass the student approval queue');
});

test('C-2: the new faculty can actually log in — by email and by staff ID', async () => {
  const byEmail = await api(null, 'POST', '/api/auth/faculty-login', {
    email: 'meera@college.edu', password: facultyTempPassword,
  });
  assert.strictEqual(byEmail.status, 200);
  assert.strictEqual(byEmail.body.user.role, 'faculty');

  const byId = await api(null, 'POST', '/api/auth/login', {
    studentId: facultyStaffId, password: facultyTempPassword,
  });
  assert.strictEqual(byId.status, 200, 'the unified login accepts the staff ID too');
});

test('C-2: a duplicate faculty email is a 409 and leaves no orphaned directory row', async () => {
  const Faculty = require('../models/Faculty');
  const before = await Faculty.countDocuments();
  const res = await api(adminToken, 'POST', '/api/faculty', {
    name: 'Clone', email: 'meera@college.edu', department: 'ROBOTICS',
  });
  assert.strictEqual(res.status, 409);
  assert.strictEqual(await Faculty.countDocuments(), before, 'no half-created faculty');
});

test('C-2: changing the password clears the must-change flag', async () => {
  const user = await User.findOne({ email: 'meera@college.edu' });
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
  const res = await api(token, 'PUT', '/api/auth/change-password', {
    currentPassword: facultyTempPassword, newPassword: 'MyOwnPass123',
  });
  assert.strictEqual(res.status, 200);
  const after = await User.findById(user._id);
  assert.strictEqual(after.mustChangePassword, false);
  facultyTempPassword = 'MyOwnPass123';
});

test('C-3: assignments persist every field — including year and batch', async () => {
  const res = await api(adminToken, 'PUT', `/api/faculty/${facultyId}/assignments`, {
    assignments: [
      { code: 'RB3401', name: 'Control Systems', department: 'ROBOTICS', semester: '3rd', section: 'A', year: '2nd', batch: '2029' },
      { code: 'RB3402', name: 'Kinematics', department: 'ROBOTICS', semester: '3rd', section: 'A', year: '2nd', batch: '2029' },
    ],
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.assignments.length, 2);

  const stored = await User.findOne({ email: 'meera@college.edu' });
  const first = stored.assignedSubjects[0];
  assert.strictEqual(first.name, 'Control Systems');
  assert.strictEqual(first.section, 'A');
  // These two were silently dropped by the sub-schema before the fix.
  assert.strictEqual(first.year, '2nd', 'academic year must survive the round trip');
  assert.strictEqual(first.batch, '2029', 'batch must survive the round trip');
});

test('C-3: the assignments show up in the faculty portal the faculty actually sees', async () => {
  const login = await api(null, 'POST', '/api/auth/faculty-login', {
    email: 'meera@college.edu', password: facultyTempPassword,
  });
  const token = login.body.token;

  const subjects = await api(token, 'GET', '/api/faculty-portal/subjects');
  assert.strictEqual(subjects.status, 200);
  assert.strictEqual(subjects.body.subjects.length, 2);
  assert.strictEqual(subjects.body.classes.length, 1, 'both subjects are the same class');
  assert.strictEqual(subjects.body.classes[0].year, '2nd');

  const dash = await api(token, 'GET', '/api/faculty-portal/dashboard');
  assert.strictEqual(dash.status, 200);
  assert.strictEqual(dash.body.dashboard.assignedSubjectCount, 2);
});

test('C-3: an unknown department in an assignment row is rejected with a 400', async () => {
  const res = await api(adminToken, 'PUT', `/api/faculty/${facultyId}/assignments`, {
    assignments: [{ name: 'Ghost Subject', department: 'NOWHERE' }],
  });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.message, /not a recognised department/i);
});

// ── RBAC / authorization ────────────────────────────────────────────────────

test('RBAC: a student cannot reach admin-only faculty management', async () => {
  const res = await api(studentToken, 'POST', '/api/faculty', {
    name: 'Sneaky', email: 'sneaky@college.edu', department: 'ROBOTICS',
  });
  assert.strictEqual(res.status, 403);
});

test('RBAC: a student cannot create a department', async () => {
  const res = await api(studentToken, 'POST', '/api/departments', { code: 'HACK', name: 'Hack' });
  assert.strictEqual(res.status, 403);
});

test('RBAC: an unauthenticated caller cannot approve a registration', async () => {
  const student = await User.findOne({ studentId: 'RB001' });
  const res = await api(null, 'PUT', `/api/students/${student._id}/approve`);
  assert.strictEqual(res.status, 401);
});

test('RBAC: a student cannot promote themselves to admin via the profile route', async () => {
  const student = await User.findOne({ studentId: 'RB001' });
  const res = await api(studentToken, 'PUT', `/api/students/${student._id}`, { role: 'admin' });
  assert.strictEqual(res.status, 400, 'the disallowed field is rejected, not silently ignored');
  const after = await User.findById(student._id);
  assert.strictEqual(after.role, 'student');
});

// ── L-1 / L-2: honest status codes and clean messages ───────────────────────

test('L-1: deleting a record that does not exist is a 404, not a silent success', async () => {
  const ghost = new mongoose.Types.ObjectId();
  const event = await api(adminToken, 'DELETE', `/api/events/${ghost}`);
  assert.strictEqual(event.status, 404);

  const faculty = await api(adminToken, 'DELETE', `/api/faculty/${ghost}`);
  assert.strictEqual(faculty.status, 404);
});

test('L-2: an empty timetable body is a 400 with a readable message', async () => {
  const res = await api(adminToken, 'POST', '/api/timetable', {});
  assert.strictEqual(res.status, 400);
  assert.match(res.body.message, /Department is required/i);
  assert.doesNotMatch(res.body.message, /validation failed|Cast to|enum value/i);
});

test('L-2: a malformed record id is a 400, never a 500 with internals', async () => {
  const res = await api(adminToken, 'DELETE', '/api/events/not-a-real-id');
  assert.strictEqual(res.status, 400);
  assert.doesNotMatch(res.body.message, /Cast to ObjectId|mongoose/i);
});

// ── Authentication edge cases ───────────────────────────────────────────────

test('AUTH: a pending student cannot log in', async () => {
  await api(null, 'POST', '/api/auth/register', {
    name: 'Waiting', studentId: 'RB002', email: 'waiting@college.edu',
    password: 'Student123', department: 'ROBOTICS', semester: '1st',
  });
  const res = await api(null, 'POST', '/api/auth/login', { studentId: 'RB002', password: 'Student123' });
  assert.strictEqual(res.status, 403);
  assert.match(res.body.message, /pending admin approval/i);
});

test('AUTH: a deactivated faculty login is refused', async () => {
  await User.updateOne({ email: 'meera@college.edu' }, { isActive: false });
  const res = await api(null, 'POST', '/api/auth/faculty-login', {
    email: 'meera@college.edu', password: facultyTempPassword,
  });
  assert.strictEqual(res.status, 403);
  await User.updateOne({ email: 'meera@college.edu' }, { isActive: true });
});

// ── Idempotent upsert reporting ─────────────────────────────────────────────
// Mongoose 8 dropped `rawResult` and ignores it silently, so `result.value` and
// `updatedExisting` were both undefined: every re-mark reported "created" with
// no record attached. These lock in the `includeResultMetadata` behaviour.

test('UPSERT: re-marking attendance returns 200 + the saved record, not a second 201', async () => {
  const Attendance = require('../models/Attendance');
  await Attendance.init();
  const student = await User.findOne({ studentId: 'RB001' });

  const first = await api(adminToken, 'POST', '/api/attendance', {
    studentId: student.studentId, subject: 'Kinematics', date: '2026-07-20', status: 'Absent',
  });
  assert.strictEqual(first.status, 201);
  assert.ok(first.body.record, 'the created record is returned');

  const second = await api(adminToken, 'POST', '/api/attendance', {
    studentId: student.studentId, subject: 'Kinematics', date: '2026-07-20', status: 'Present',
  });
  assert.strictEqual(second.status, 200, 'an update must not report 201 Created');
  assert.strictEqual(second.body.record.status, 'Present');
  assert.strictEqual(
    await Attendance.countDocuments({ student: student._id, subject: 'Kinematics' }), 1,
    're-marking never duplicates',
  );
});

test('C-2: removing a faculty member deactivates the login rather than deleting it', async () => {
  const res = await api(adminToken, 'DELETE', `/api/faculty/${facultyId}`);
  assert.strictEqual(res.status, 200);
  const user = await User.findOne({ email: 'meera@college.edu' });
  assert.ok(user, 'the account survives so historical records keep a valid author');
  assert.strictEqual(user.isActive, false);
});
