/**
 * Migration 0003 — Notice lifecycle backfill.
 *
 * Why: the Notice model gained lifecycle fields (status, publishedAt, audience,
 * createdBy). Rows created before this change have none of them. Without a backfill
 * they rely on the route's backward-compatible `$nin` query, but sorting by
 * publishedAt and the admin status filters work best once every row is normalised.
 *
 * What it does (safe + idempotent — re-runnable; only touches `notices`):
 *   1. status      → 'archived' when isActive === false, else 'published'.
 *   2. publishedAt → createdAt (so existing notices keep their original date + sort order).
 *   3. audience    → 'all' (legacy notices were campus-wide).
 *   createdBy is left null — there is no reliable author mapping for legacy rows.
 *
 * It does NOT delete or archive test/dev notices — that is a separate, reviewed step
 * (see scripts/cleanup-notices.js + NOTICE_DATA_CLEANUP_REPORT.md).
 *
 * Run AFTER deploying the updated model/routes, against the target database:
 *   cd backend
 *   node migrations/0003-notice-lifecycle.js
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
  const col = mongoose.connection.collection('notices');

  // 1) Backfill status from the legacy isActive flag where status is missing.
  const toPublished = await col.updateMany(
    { status: { $exists: false }, isActive: { $ne: false } },
    { $set: { status: 'published' } }
  );
  const toArchived = await col.updateMany(
    { status: { $exists: false }, isActive: false },
    { $set: { status: 'archived' } }
  );

  // 2) Backfill publishedAt from createdAt for published rows that have none.
  const docs = await col.find({ publishedAt: { $in: [null, undefined] } }).toArray();
  let datedCount = 0;
  for (const d of docs) {
    if (d.createdAt) {
      await col.updateOne({ _id: d._id }, { $set: { publishedAt: d.createdAt } });
      datedCount++;
    }
  }

  // 3) Backfill audience.
  const aud = await col.updateMany(
    { audience: { $exists: false } },
    { $set: { audience: 'all' } }
  );

  console.log(`✅ status → published: ${toPublished.modifiedCount}`);
  console.log(`✅ status → archived: ${toArchived.modifiedCount}`);
  console.log(`✅ publishedAt backfilled: ${datedCount}`);
  console.log(`✅ audience → all: ${aud.modifiedCount}`);
  console.log('Migration 0003 complete.');

  await mongoose.disconnect();
  process.exit(0);
})().catch(err => {
  console.error('❌ Migration 0003 failed:', err);
  process.exit(1);
});
