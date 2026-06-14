/**
 * Migration 0002 — CRIT-05: backfill payment verification flags.
 *
 * Why: payments recorded before this change have no `verified` / `recordedBy` field.
 * Without a backfill they would suddenly display as "Pending verification" and would
 * stop counting toward the cleared status. We grandfather all existing payments as
 * verified (recordedBy 'Legacy') so historical records stay trustworthy.
 *
 * Safe + idempotent — re-runnable. Only touches `fees` documents whose history
 * entries are missing the `verified` field.
 *
 *   cd backend
 *   node migrations/0002-backfill-fee-verification.js
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
  const col = mongoose.connection.collection('fees');

  const fees = await col.find({ 'history.0': { $exists: true } }).toArray();
  let touchedDocs = 0, touchedPayments = 0;

  for (const fee of fees) {
    let changed = false;
    const history = (fee.history || []).map(p => {
      if (p.verified === undefined) {
        changed = true;
        touchedPayments++;
        return { ...p, verified: true, recordedBy: p.recordedBy || 'Legacy' };
      }
      return p;
    });
    if (changed) {
      await col.updateOne({ _id: fee._id }, { $set: { history } });
      touchedDocs++;
    }
  }

  console.log(`✅ Migration 0002 complete — grandfathered ${touchedPayments} payment(s) across ${touchedDocs} fee record(s) as verified.`);
  await mongoose.disconnect();
})().catch(err => {
  console.error('❌ Migration 0002 failed:', err.message);
  process.exit(1);
});
