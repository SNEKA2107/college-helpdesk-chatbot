const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  student:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentId: { type: String, required: true, uppercase: true },
  subject:   { type: String, required: true, trim: true },
  date:      { type: Date, required: true },
  status:    { type: String, enum: ['Present', 'Absent', 'Late'], default: 'Present' },
  markedBy:  { type: String, default: 'Admin' },
}, { timestamps: true });

attendanceSchema.index({ studentId: 1, date: -1 });
attendanceSchema.index({ student: 1, subject: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
