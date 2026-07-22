/**
 * Migration 0004 — Timetable lifecycle status backfill.
 *
 * Why: the Timetable model gained a lifecycle `status` field (enum:
 * draft | published | archived, default 'published'). Rows created before that
 * change have NO status field at all. The student-facing resolver
 * (routes/timetable.js → resolveTimetableForUser) filters on `status: 'published'`,
 * so a statusless timetable silently fails to match and the Timetable page 404s
 * for that cohort — even though a schema default of 'published' exists (defaults
 * apply only on document creation, never to already-stored rows).
 *
 * What it does (safe + idempotent — re-runnable; only touches `timetables`):
 *   status → 'published' for every row that has no status field.
 *
 * Mirrors migration 0003 (notice-lifecycle). Run AFTER deploying the updated
 * model/routes, against the target database:
 *   cd backend
 *   node migrations/0004-backfill-timetable-status.js
 *
 * Requires MONGO_URI in backend/.env. Take a DB backup / Atlas snapshot first.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI not set in backend/.env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI, { tls: true });
  const col = mongoose.connection.collection('timetables');

  // Backfill status → 'published' on legacy rows that predate the status field.
  const res = await col.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'published' } }
  );

  console.log(`✅ status → published: ${res.modifiedCount}`);
  console.log('Migration 0004 complete.');

  await mongoose.disconnect();
  process.exit(0);
})().catch(err => {
  console.error('❌ Migration 0004 failed:', err);
  process.exit(1);
});
