const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  date:        { type: String, required: true },
  description: { type: String, required: true },
  amount:      { type: Number, required: true },
  mode:        { type: String, enum: ['Online', 'DD', 'Cash', 'NEFT'], required: true },
  txn:         { type: String, default: 'MANUAL' },
  // CRIT-05: student-recorded payments start unverified; an admin confirms them.
  verified:    { type: Boolean, default: false },
  recordedBy:  { type: String, default: 'Student' },
}, { _id: false });

const feeSchema = new mongoose.Schema({
  student:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentId:    { type: String, required: true, uppercase: true },
  semester:     { type: String, required: true },
  academicYear: { type: String, required: true },
  components: [{
    name:   { type: String, required: true },
    amount: { type: Number, required: true },
    _id: false,
  }],
  total:    { type: Number, required: true },
  dueDate:  { type: String, required: true },
  lateFine: { type: Number, default: 0 },
  history:  [paymentSchema],
}, { timestamps: true });

// All recorded payments (verified or not) — used to cap further recording.
feeSchema.virtual('amountPaid').get(function () {
  return this.history.reduce((sum, p) => sum + p.amount, 0);
});

// Only admin-verified payments count toward "paid" — keeps the cleared status trustworthy.
feeSchema.virtual('verifiedPaid').get(function () {
  return this.history.reduce((sum, p) => sum + (p.verified ? p.amount : 0), 0);
});

feeSchema.virtual('balance').get(function () {
  return this.total - this.amountPaid;
});

feeSchema.virtual('status').get(function () {
  return this.verifiedPaid >= this.total ? 'Paid' : 'Pending';
});

module.exports = mongoose.model('Fee', feeSchema);
