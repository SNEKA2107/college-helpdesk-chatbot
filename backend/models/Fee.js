const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  date:        { type: String, required: true },
  description: { type: String, required: true },
  amount:      { type: Number, required: true },
  mode:        { type: String, enum: ['Online', 'DD', 'Cash', 'NEFT'], required: true },
  txn:         { type: String, default: 'MANUAL' },
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

feeSchema.virtual('amountPaid').get(function () {
  return this.history.reduce((sum, p) => sum + p.amount, 0);
});

feeSchema.virtual('balance').get(function () {
  return this.total - this.amountPaid;
});

feeSchema.virtual('status').get(function () {
  return this.amountPaid >= this.total ? 'Paid' : 'Pending';
});

module.exports = mongoose.model('Fee', feeSchema);
