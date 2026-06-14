require('dotenv').config();
const mongoose = require('mongoose');
const Request  = require('./models/Request');
const User     = require('./models/User');
const Counter  = require('./models/Counter');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const u = await User.findOne({ studentId: '22IT101' });
  const r = await Request.create({ student: u._id, studentId: u.studentId, type: 'Marksheet', purpose: 'sequence test' });
  console.log('New request ref:', r.refNumber);
  await Request.deleteOne({ _id: r._id });
  await Counter.findByIdAndUpdate('request-2026', { $set: { seq: 20 } });
  console.log('Test request removed, counter restored to 20');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
