const mongoose = require('mongoose');

// Normalize any date input to UTC midnight so that "same calendar day" duplicates
// are detected by the unique index below (otherwise a time component would make
// 9:00 AM and 10:00 AM on the same day look like two distinct records).
function startOfDayUTC(value) {
  const d = new Date(value);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

const attendanceSchema = new mongoose.Schema({
  student:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentId: { type: String, required: true, uppercase: true },
  subject:   { type: String, required: true, trim: true },
  date:      { type: Date, required: true, set: startOfDayUTC },
  status:    { type: String, enum: ['Present', 'Absent', 'Late'], default: 'Present' },
  markedBy:  { type: String, default: 'Admin' },
}, { timestamps: true });

// CRIT-04: exactly one attendance record per student, per subject, per day.
// Prevents duplicate marking that would corrupt attendance percentages.
attendanceSchema.index({ student: 1, subject: 1, date: 1 }, { unique: true });
// Retained for fast student-timeline queries (summary / listing).
attendanceSchema.index({ studentId: 1, date: -1 });

// Exposed so routes can normalize the filter date to match stored values.
attendanceSchema.statics.startOfDayUTC = startOfDayUTC;

module.exports = mongoose.model('Attendance', attendanceSchema);
