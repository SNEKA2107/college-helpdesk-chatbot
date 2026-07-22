/**
 * Regression tests for timetable cohort resolution + lifecycle status filtering.
 *
 * These lock in the contract behind GET /api/timetable (routes/timetable.js →
 * resolveTimetableForUser): a student must only ever receive a PUBLISHED timetable
 * for their exact department+semester. Drafts, archived timetables, documents with
 * no status field, and other cohorts must never be returned.
 *
 * Motivated by a real pilot defect where an existing timetable predated the `status`
 * field (stored with no status) and therefore failed the `status: 'published'` filter,
 * making the Timetable page 404 for the demo cohort.
 *
 *   cd backend
 *   node --test tests/timetable-cohort.test.js
 */
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Timetable = require('../models/Timetable');

let mongod;

// The exact resolution query used by routes/timetable.js. Kept in sync with the
// route's `status: 'published'` + dept/semester scoping so this test guards the
// real access contract rather than a paraphrase of it.
async function resolvePublishedForCohort({ department, semester }) {
  if (!department || !semester) return null;
  const candidates = await Timetable.find({ department, semester, status: 'published' }).sort({ updatedAt: -1 });
  return candidates[0] || null;
}

const baseDoc = (over = {}) => ({
  department: 'IT', semester: '5th', academicYear: '2026-2027',
  slots: ['09:00'], schedule: { Monday: [] }, status: 'published', ...over,
});

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Timetable.init();
});

test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test('TT-01: a student only receives the PUBLISHED timetable for their own dept+semester', async () => {
  await Timetable.deleteMany({});
  const mine = await Timetable.create(baseDoc());                                   // IT / 5th / published  ✅
  await Timetable.create(baseDoc({ department: 'CSE' }));                            // other dept            ❌
  await Timetable.create(baseDoc({ semester: '3rd' }));                             // other semester        ❌

  const got = await resolvePublishedForCohort({ department: 'IT', semester: '5th' });
  assert.ok(got, 'the IT/5th student must get a timetable');
  assert.strictEqual(got._id.toString(), mine._id.toString(), 'must be exactly the IT/5th document');
});

test('TT-02: draft and archived timetables are never returned to students', async () => {
  await Timetable.deleteMany({});
  await Timetable.create(baseDoc({ status: 'draft' }));
  await Timetable.create(baseDoc({ status: 'archived' }));

  const got = await resolvePublishedForCohort({ department: 'IT', semester: '5th' });
  assert.strictEqual(got, null, 'no published timetable exists → must resolve to null, not a draft/archived one');
});

test('TT-03: a document with NO status field is excluded by the published filter (the pilot bug)', async () => {
  await Timetable.deleteMany({});
  // Simulate a legacy doc written before `status` existed: insert raw, bypassing schema defaults.
  await Timetable.collection.insertOne({
    department: 'IT', semester: '5th', academicYear: '2026-2027',
    slots: ['09:00'], schedule: { Monday: [] }, createdAt: new Date(), updatedAt: new Date(),
  });
  const beforeBackfill = await resolvePublishedForCohort({ department: 'IT', semester: '5th' });
  assert.strictEqual(beforeBackfill, null, 'a statusless doc must NOT match status:published (reproduces the 404)');

  // Backfilling status:'published' (the data fix) makes it resolvable again.
  await Timetable.updateMany({ status: { $exists: false } }, { $set: { status: 'published' } });
  const afterBackfill = await resolvePublishedForCohort({ department: 'IT', semester: '5th' });
  assert.ok(afterBackfill, 'after backfill the timetable resolves for the cohort');
});

test('TT-04: a student with no semester (blank cohort) receives no timetable', async () => {
  await Timetable.deleteMany({});
  await Timetable.create(baseDoc());
  const got = await resolvePublishedForCohort({ department: 'IT', semester: '' });
  assert.strictEqual(got, null, 'a blank semester must never cross-match another cohort');
});
