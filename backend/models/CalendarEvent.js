const mongoose = require('mongoose');

// CRIT-02: Academic calendar — holidays, exam schedules, semester dates, deadlines, events.
const calendarSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  type:        { type: String, required: true, enum: ['Holiday', 'Exam', 'Deadline', 'Semester', 'Event'] },
  date:        { type: Date, required: true },
  endDate:     { type: Date },               // optional — for ranges (e.g. semester, exam window)
  description: { type: String, default: '', trim: true },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

calendarSchema.index({ date: 1 });

module.exports = mongoose.model('CalendarEvent', calendarSchema);
