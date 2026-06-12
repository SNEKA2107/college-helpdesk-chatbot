/**
 * One-time migration: replace the old random refNumbers (BC-2026-137 …)
 * with sequential ones in submission order (BC-2026-0001, M-2026-0002 …)
 * and prime the Counter so new requests continue the sequence.
 *
 * Usage: node renumber-requests.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Request  = require('./models/Request');
const Counter  = require('./models/Counter');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected');

  const requests = await Request.find().sort({ createdAt: 1 });
  let seq = 0;
  for (const r of requests) {
    seq++;
    const prefix = r.type.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const year   = new Date(r.createdAt).getFullYear();
    const newRef = `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
    if (r.refNumber !== newRef) {
      await Request.updateOne({ _id: r._id }, { $set: { refNumber: newRef } });
      console.log(`${r.refNumber}  ->  ${newRef}  (${r.createdAt.toISOString().slice(0, 10)} ${r.type})`);
    }
  }

  const year = new Date().getFullYear();
  await Counter.findByIdAndUpdate(`request-${year}`, { $set: { seq } }, { upsert: true });
  console.log(`\n✅ ${seq} requests renumbered; counter request-${year} set to ${seq}`);
  process.exit(0);
})().catch(err => { console.error('❌', err.message); process.exit(1); });
