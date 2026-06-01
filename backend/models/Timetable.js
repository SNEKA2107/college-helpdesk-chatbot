const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
  department:   { type: String, required: true },
  semester:     { type: String, required: true },
  academicYear: { type: String, required: true },
  slots:        [String],
  schedule:     { type: mongoose.Schema.Types.Mixed, default: {} },
  subjectDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('Timetable', timetableSchema);
