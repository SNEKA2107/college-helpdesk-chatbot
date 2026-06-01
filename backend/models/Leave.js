const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  student:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentId:  { type: String, required: true },
  name:       { type: String, required: true },
  department: { type: String, required: true },
  semester:   { type: String },
  leaveType:  {
    type: String, required: true,
    enum: ['Medical Leave','Personal Leave','On Duty (OD) – Event','On Duty (OD) – Training','Emergency Leave','Family Function']
  },
  fromDate:   { type: Date, required: true },
  toDate:     { type: Date, required: true },
  reason:     { type: String, required: true },
  document:   { type: String, default: '' },
  status:     { type: String, enum: ['Pending','Approved','Rejected'], default: 'Pending' },
  approvedBy: { type: String, default: '' },
  remarks:    { type: String, default: '' },
}, { timestamps: true });

leaveSchema.virtual('days').get(function() {
  const diff = this.toDate - this.fromDate;
  return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
});

module.exports = mongoose.model('Leave', leaveSchema);
