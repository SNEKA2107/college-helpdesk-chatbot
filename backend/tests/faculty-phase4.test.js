/**
 * Integration tests for Phase 4 Faculty modules: Assignments, Study Materials,
 * Analytics, Notifications and Profile — plus the student-facing coursework API.
 * Boots the real routers over an in-memory MongoDB with genuine JWT auth.
 *
 *   cd backend && node --test tests/faculty-phase4.test.js
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase4-test-secret';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../models/User');

let mongod, server, base, facToken, facBToken, stuToken, otherStuToken;

function api(token, method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
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

  const faculty = await User.create({
    name: 'Dr. Rao', studentId: 'FAC01', email: 'rao@college.edu', password: 'password123',
    department: 'CSE', role: 'faculty', designation: 'Assistant Professor',
    assignedSubjects: [{ code: 'CS3491', name: 'Artificial Intelligence', department: 'CSE', semester: '5', section: 'A' }],
  });
  const student = await User.create({
    name: 'Asha', studentId: 'CS001', email: 'asha@college.edu', password: 'password123',
    department: 'CSE', semester: '5', section: 'A', role: 'student',
  });
  const other = await User.create({
    name: 'Ravi', studentId: 'EC001', email: 'ravi@college.edu', password: 'password123',
    department: 'ECE', semester: '5', section: 'A', role: 'student',
  });
  // A SECOND faculty who teaches a different class — used to verify ownership guards.
  const facultyB = await User.create({
    name: 'Dr. Iyer', studentId: 'FAC02', email: 'iyer@college.edu', password: 'password123',
    department: 'CSE', role: 'faculty',
    assignedSubjects: [{ code: 'CS3492', name: 'Databases', department: 'CSE', semester: '5', section: 'B' }],
  });

  facToken = jwt.sign({ id: faculty._id }, process.env.JWT_SECRET);
  facBToken = jwt.sign({ id: facultyB._id }, process.env.JWT_SECRET);
  stuToken = jwt.sign({ id: student._id }, process.env.JWT_SECRET);
  otherStuToken = jwt.sign({ id: other._id }, process.env.JWT_SECRET);

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/faculty-portal', require('../routes/facultyPortal'));
  app.use('/api/coursework', require('../routes/coursework'));
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  server.close();
  await mongoose.disconnect();
  await mongod.stop();
});

let assignmentId;

test('faculty creates an assignment for an assigned subject', async () => {
  const res = await api(facToken, 'POST', '/api/faculty-portal/assignments', {
    title: 'AI Problem Set 1', description: 'Solve search problems', subject: 'Artificial Intelligence',
    section: 'A', dueDate: '2099-01-01', maxMarks: 50,
  });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.assignment.department, 'CSE');
  assert.strictEqual(res.body.assignment.semester, '5');
  assignmentId = res.body.assignment._id;
});

test('faculty CANNOT create an assignment for a subject they do not teach (403)', async () => {
  const res = await api(facToken, 'POST', '/api/faculty-portal/assignments', {
    title: 'Rogue', subject: 'Quantum Physics', dueDate: '2099-01-01',
  });
  assert.strictEqual(res.status, 403);
});

test('student sees the class assignment; other-class student does not', async () => {
  const mine = await api(stuToken, 'GET', '/api/coursework/assignments');
  assert.strictEqual(mine.status, 200);
  assert.strictEqual(mine.body.assignments.length, 1);
  assert.strictEqual(mine.body.assignments[0].submitted, false);

  const other = await api(otherStuToken, 'GET', '/api/coursework/assignments');
  assert.strictEqual(other.body.assignments.length, 0);
});

test('student submits, faculty sees the submission and grades it', async () => {
  const sub = await api(stuToken, 'POST', `/api/coursework/assignments/${assignmentId}/submit`, {
    text: 'My answer is BFS.',
  });
  assert.strictEqual(sub.status, 201);

  const list = await api(facToken, 'GET', `/api/faculty-portal/assignments/${assignmentId}/submissions`);
  assert.strictEqual(list.body.submissions.length, 1);
  assert.strictEqual(list.body.submissions[0].studentId, 'CS001');

  const graded = await api(facToken, 'PUT', `/api/faculty-portal/assignments/${assignmentId}/submissions/CS001`, {
    marks: 45, remarks: 'Good work',
  });
  assert.strictEqual(graded.status, 200);
  assert.strictEqual(graded.body.submission.marks, 45);

  const after = await api(stuToken, 'GET', '/api/coursework/assignments');
  assert.strictEqual(after.body.assignments[0].submission.marks, 45);
  assert.strictEqual(after.body.assignments[0].submission.remarks, 'Good work');
});

test('faculty rejects out-of-range marks', async () => {
  const bad = await api(facToken, 'PUT', `/api/faculty-portal/assignments/${assignmentId}/submissions/CS001`, { marks: 999 });
  assert.strictEqual(bad.status, 400);
});

test('study material upload + student download flow', async () => {
  const up = await api(facToken, 'POST', '/api/faculty-portal/materials', {
    title: 'Unit 1 Notes', subject: 'Artificial Intelligence', section: 'A', kind: 'PDF',
    attachment: 'data:text/plain;base64,SGVsbG8=', attachmentName: 'notes.pdf', attachmentType: 'application/pdf',
  });
  assert.strictEqual(up.status, 201);
  const mid = up.body.material._id;
  assert.strictEqual(up.body.material.attachment, undefined, 'blob must be omitted from create response');

  const list = await api(stuToken, 'GET', '/api/coursework/materials');
  assert.strictEqual(list.body.materials.length, 1);

  const file = await api(stuToken, 'GET', `/api/coursework/materials/${mid}/file`);
  assert.strictEqual(file.status, 200);
  assert.ok(file.body.attachment.startsWith('data:text/plain'));

  const denied = await api(otherStuToken, 'GET', `/api/coursework/materials/${mid}/file`);
  assert.strictEqual(denied.status, 403);
});

test('analytics returns aggregated structure', async () => {
  const res = await api(facToken, 'GET', '/api/faculty-portal/analytics');
  assert.strictEqual(res.status, 200);
  const a = res.body.analytics;
  assert.ok('attendancePercentage' in a);
  assert.ok(Array.isArray(a.subjectWise));
  assert.ok(Array.isArray(a.assignmentCompletion));
  assert.strictEqual(a.teachingSummary.assignments, 1);
  assert.strictEqual(a.teachingSummary.materials, 1);
  // One student submitted the single assignment → 100% completion.
  assert.strictEqual(a.assignmentCompletion[0].submitted, 1);
  assert.strictEqual(a.assignmentCompletion[0].expected, 1);
});

test('notifications feed includes the student submission alert', async () => {
  const res = await api(facToken, 'GET', '/api/faculty-portal/notifications');
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.notifications.some(n => n.type === 'submission'));
});

test('faculty profile update persists', async () => {
  const res = await api(facToken, 'PUT', '/api/faculty-portal/profile', {
    designation: 'Associate Professor', qualification: 'Ph.D.', experience: '10 years',
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.faculty.designation, 'Associate Professor');
  const me = await api(facToken, 'GET', '/api/faculty-portal/me');
  assert.strictEqual(me.body.faculty.qualification, 'Ph.D.');
});

test('a student cannot reach the faculty portal (403)', async () => {
  const res = await api(stuToken, 'GET', '/api/faculty-portal/assignments');
  assert.strictEqual(res.status, 403);
});

test('closing an assignment blocks further submissions', async () => {
  await api(facToken, 'PUT', `/api/faculty-portal/assignments/${assignmentId}`, { status: 'closed' });
  const res = await api(stuToken, 'POST', `/api/coursework/assignments/${assignmentId}/submit`, { text: 'late' });
  assert.strictEqual(res.status, 400);
});

// ── Exhaustive endpoint + ownership coverage ────────────────────────────────
test('faculty GET /assignments lists own assignments with submission counts', async () => {
  const res = await api(facToken, 'GET', '/api/faculty-portal/assignments');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.assignments.length, 1);
  const a = res.body.assignments[0];
  assert.strictEqual(a.submissionCount, 1);
  assert.strictEqual(a.gradedCount, 1);
  assert.strictEqual(a.effectiveStatus, 'closed');
  assert.strictEqual(a.attachment, undefined, 'list must not ship the blob');
});

let a2Id;
test('assignment with brief attachment: create, student downloads brief, submission-file round-trip', async () => {
  // Create a second assignment carrying a brief attachment.
  const create = await api(facToken, 'POST', '/api/faculty-portal/assignments', {
    title: 'AI Lab', subject: 'Artificial Intelligence', section: 'A', dueDate: '2099-01-01', maxMarks: 20,
    attachment: 'data:application/pdf;base64,QnJpZWY=', attachmentName: 'brief.pdf', attachmentType: 'application/pdf',
  });
  assert.strictEqual(create.status, 201);
  a2Id = create.body.assignment._id;

  // Student downloads the brief (class-scoped coursework endpoint).
  const brief = await api(stuToken, 'GET', `/api/coursework/assignments/${a2Id}/file`);
  assert.strictEqual(brief.status, 200);
  assert.ok(brief.body.attachment.startsWith('data:application/pdf'));
  // Other-class student is denied the brief.
  const briefDenied = await api(otherStuToken, 'GET', `/api/coursework/assignments/${a2Id}/file`);
  assert.strictEqual(briefDenied.status, 403);

  // Student submits WITH a file, faculty downloads that submission file.
  const sub = await api(stuToken, 'POST', `/api/coursework/assignments/${a2Id}/submit`, {
    text: 'lab done', attachment: 'data:text/plain;base64,V29yaw==', attachmentName: 'work.txt', attachmentType: 'text/plain',
  });
  assert.strictEqual(sub.status, 201);
  const file = await api(facToken, 'GET', `/api/faculty-portal/assignments/${a2Id}/submissions/CS001/file`);
  assert.strictEqual(file.status, 200);
  assert.ok(file.body.attachment.startsWith('data:text/plain'));
});

test('assignment ownership: a different faculty cannot view/grade/edit/delete', async () => {
  assert.strictEqual((await api(facBToken, 'GET', `/api/faculty-portal/assignments/${a2Id}/submissions`)).status, 403);
  assert.strictEqual((await api(facBToken, 'PUT', `/api/faculty-portal/assignments/${a2Id}/submissions/CS001`, { marks: 5 })).status, 403);
  assert.strictEqual((await api(facBToken, 'PUT', `/api/faculty-portal/assignments/${a2Id}`, { title: 'hijack' })).status, 403);
  assert.strictEqual((await api(facBToken, 'DELETE', `/api/faculty-portal/assignments/${a2Id}`)).status, 403);
});

test('DELETE /assignments/:id removes an OWN assignment', async () => {
  const del = await api(facToken, 'DELETE', `/api/faculty-portal/assignments/${a2Id}`);
  assert.strictEqual(del.status, 200);
  const list = await api(facToken, 'GET', '/api/faculty-portal/assignments');
  assert.ok(!list.body.assignments.some(a => a._id === a2Id));
});

let matId;
test('faculty GET /materials, GET file, PUT edit — full lifecycle', async () => {
  const up = await api(facToken, 'POST', '/api/faculty-portal/materials', {
    title: 'Unit 2', subject: 'Artificial Intelligence', section: 'A', kind: 'DOC',
    attachment: 'data:text/plain;base64,RG9j', attachmentName: 'u2.doc', attachmentType: 'application/msword',
  });
  matId = up.body.material._id;

  const list = await api(facToken, 'GET', '/api/faculty-portal/materials');
  assert.strictEqual(list.status, 200);
  assert.ok(list.body.materials.some(m => m._id === matId));
  assert.ok(list.body.materials.every(m => m.attachment === undefined), 'list omits blobs');

  const file = await api(facToken, 'GET', `/api/faculty-portal/materials/${matId}/file`);
  assert.strictEqual(file.status, 200);
  assert.ok(file.body.attachment.startsWith('data:text/plain'));

  const edit = await api(facToken, 'PUT', `/api/faculty-portal/materials/${matId}`, { title: 'Unit 2 (rev)' });
  assert.strictEqual(edit.status, 200);
  assert.strictEqual(edit.body.material.title, 'Unit 2 (rev)');
});

test('material ownership: a different faculty cannot edit/delete/download', async () => {
  assert.strictEqual((await api(facBToken, 'PUT', `/api/faculty-portal/materials/${matId}`, { title: 'x' })).status, 403);
  assert.strictEqual((await api(facBToken, 'GET', `/api/faculty-portal/materials/${matId}/file`)).status, 403);
  assert.strictEqual((await api(facBToken, 'DELETE', `/api/faculty-portal/materials/${matId}`)).status, 403);
});

test('DELETE /materials/:id removes an OWN material', async () => {
  const del = await api(facToken, 'DELETE', `/api/faculty-portal/materials/${matId}`);
  assert.strictEqual(del.status, 200);
});

test('faculty B (different class) sees none of faculty A\'s coursework via analytics scope', async () => {
  const res = await api(facBToken, 'GET', '/api/faculty-portal/analytics');
  assert.strictEqual(res.status, 200);
  // Faculty B created nothing; their assignment/material counts are zero.
  assert.strictEqual(res.body.analytics.teachingSummary.assignments, 0);
  assert.strictEqual(res.body.analytics.teachingSummary.materials, 0);
});

test('an admin cannot reach the student coursework API (403)', async () => {
  // Build an admin token to confirm coursework is student-only.
  const admin = await User.create({
    name: 'Admin', studentId: 'ADM01', email: 'admin@college.edu', password: 'password123',
    department: 'Admin', role: 'admin',
  });
  const admToken = jwt.sign({ id: admin._id }, process.env.JWT_SECRET);
  const res = await api(admToken, 'GET', '/api/coursework/assignments');
  assert.strictEqual(res.status, 403);
});
