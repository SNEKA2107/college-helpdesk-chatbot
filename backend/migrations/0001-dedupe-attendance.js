/**
 * Migration 0001 — CRIT-04: de-duplicate attendance and add the unique index.
 *
 * Why: the new unique index { student, subject, date } cannot be built while
 * duplicate rows exist, and old rows may carry a time component on `date`.
 *
 * What it does (safe + idempotent — re-runnable):
 *   1. Normalizes every attendance `date` to UTC midnight.
 *   2. Collapses duplicates (same student+subject+day), keeping the newest row.
 *   3. Creates the unique compound index.
 *
 * Run AFTER deploying the updated model/routes, against the target database:
 *   cd backend
 *   node migrations/0001-dedupe-attendance.js
 *
 * Requires MONGO_URI in backend/.env (same var the app uses). Take a DB backup /
 * Atlas snapshot first. This script only touches the `attendances` collection.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

function startOfDayUTC(value) {
  const d = new Date(value);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI not set in backend/.env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI, { tls: true });
  const col = mongoose.connection.collection('attendances');

  // 1) Normalize dates to UTC midnight
  const all = await col.find({}).toArray();
  let normalized = 0;
  for (const doc of all) {
    const norm = startOfDayUTC(doc.date);
    if (+norm !== +new Date(doc.date)) {
      await col.updateOne({ _id: doc._id }, { $set: { date: norm } });
      normalized++;
    }
  }

  // 2) Collapse duplicates, keeping the most recently created row (highest _id)
  const groups = await col.aggregate([
    { $group: { _id: { student: '$student', subject: '$subject', date: '$date' }, ids: { $push: '$_id' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]).toArray();

  let removed = 0;
  for (const g of groups) {
    const sorted = g.ids.sort();                 // ObjectId sorts chronologically
    const toDelete = sorted.slice(0, -1);        // keep the last (newest)
    if (toDelete.length) {
      await col.deleteMany({ _id: { $in: toDelete } });
      removed += toDelete.length;
    }
  }

  // 3) Build the unique index (no-op if it already exists)
  await col.createIndex({ student: 1, subject: 1, date: 1 }, { unique: true });

  console.log(`✅ Migration 0001 complete — normalized ${normalized} dates, removed ${removed} duplicate record(s), unique index ensured.`);
  await mongoose.disconnect();
})().catch(err => {
  console.error('❌ Migration 0001 failed:', err.message);
  process.exit(1);
});
