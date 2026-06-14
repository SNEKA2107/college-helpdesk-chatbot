/**
 * Integration tests for the Critical (Phase 1) fixes.
 * Uses the in-memory MongoDB already available via mongodb-memory-server (devDependency).
 *
 *   cd backend
 *   node --test tests/
 */
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Attendance = require('../models/Attendance');
const Marks = require('../models/Marks');
const Fee = require('../models/Fee');

let mongod;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Attendance.init();   // ensure unique indexes are built before inserting
  await Marks.init();
});

test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test('CRIT-04: unique index blocks a raw duplicate on the same day (any time)', async () => {
  const student = new mongoose.Types.ObjectId();
  await Attendance.create({ student, studentId: 'S1', subject: 'DBMS', date: new Date('2026-06-01T09:00:00Z'), status: 'Present' });
  await assert.rejects(
    () => Attendance.create({ student, studentId: 'S1', subject: 'DBMS', date: new Date('2026-06-01T15:00:00Z'), status: 'Absent' }),
    err => err.code === 11000,
    'a second record for the same student+subject+day must be rejected',
  );
  assert.strictEqual(await Attendance.countDocuments({ student, subject: 'DBMS' }), 1);
});

test('CRIT-04: idempotent upsert updates the existing record instead of duplicating', async () => {
  const student = new mongoose.Types.ObjectId();
  const day = Attendance.startOfDayUTC('2026-06-02T10:00:00Z');
  for (const status of ['Present', 'Absent']) {
    await Attendance.findOneAndUpdate(
      { student, subject: 'CN', date: day },
      { $set: { status, markedBy: 'Admin' }, $setOnInsert: { studentId: 'S2' } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  const recs = await Attendance.find({ student, subject: 'CN' });
  assert.strictEqual(recs.length, 1, 're-marking must not create a duplicate');
  assert.strictEqual(recs[0].status, 'Absent', 'last write wins');
});

test('CRIT-01: marks are unique per student + semester + subject', async () => {
  const student = new mongoose.Types.ObjectId();
  await Marks.create({ student, studentId: 'S3', semester: '5', subject: 'AI', credits: 4, internalMarks: 35, externalMarks: 55, ...Marks.computeGrade(35, 55) });
  await assert.rejects(
    () => Marks.create({ student, studentId: 'S3', semester: '5', subject: 'AI', credits: 4, internalMarks: 30, externalMarks: 50, ...Marks.computeGrade(30, 50) }),
    err => err.code === 11000,
  );
});

test('CRIT-01: CGPA is credit-weighted across subjects', async () => {
  const student = new mongoose.Types.ObjectId();
  await Marks.create({ student, studentId: 'S4', semester: '5', subject: 'A', credits: 4, internalMarks: 40, externalMarks: 60, ...Marks.computeGrade(40, 60) }); // O = 10
  await Marks.create({ student, studentId: 'S4', semester: '5', subject: 'B', credits: 2, internalMarks: 20, externalMarks: 30, ...Marks.computeGrade(20, 30) }); // B = 6
  const recs = await Marks.find({ studentId: 'S4' });
  const credits = recs.reduce((s, r) => s + r.credits, 0);
  const points  = recs.reduce((s, r) => s + r.credits * r.gradePoint, 0);
  // (4*10 + 2*6) / 6 = 52 / 6 = 8.67
  assert.strictEqual(+(points / credits).toFixed(2), 8.67);
});

test('CRIT-05: fee status counts only verified payments', async () => {
  const fee = new Fee({
    student: new mongoose.Types.ObjectId(), studentId: 'S5', semester: '5', academicYear: '2025-26',
    components: [{ name: 'Tuition', amount: 100 }], total: 100, dueDate: '2026-05-25',
    history: [
      { date: '2026-01-01', description: 'p', amount: 60, mode: 'Online', verified: true },
      { date: '2026-02-01', description: 'p', amount: 40, mode: 'Online', verified: false },
    ],
  });
  assert.strictEqual(fee.amountPaid, 100);
  assert.strictEqual(fee.verifiedPaid, 60);
  assert.strictEqual(fee.balance, 0);
  assert.strictEqual(fee.status, 'Pending'); // not 'Paid' until the ₹40 is verified
});
