const mongoose = require('mongoose');

// Daily snapshot of a student's computed success scores. One row per student
// per day (upserted) so the dashboard can plot success/placement-growth trends.
const successMetricSchema = new mongoose.Schema({
  student:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  successScore:  Number,
  attHealth:     Number,
  academic:      Number,
  placement:     Number,
  engagement:    Number,
  cgpa:          Number,
  attendancePct: Number,
  backlogs:      Number,
  snapshotDate:  { type: String, index: true },   // YYYY-MM-DD
}, { timestamps: true });

successMetricSchema.index({ student: 1, snapshotDate: 1 }, { unique: true });

module.exports = mongoose.model('SuccessMetric', successMetricSchema);
