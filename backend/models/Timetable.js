const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
  department:   { type: String, required: true },
  // Phase-1 foundation: study-year + section so timetables are segmented by cohort
  // (dept × year × semester × section). Both optional/back-compatible: existing
  // records default to '' which is treated as "applies to the whole dept+semester".
  year:         { type: String, default: '' },
  semester:     { type: String, required: true },
  section:      { type: String, default: '' },
  academicYear: { type: String, required: true },
  // Lifecycle foundation only. Default 'published' preserves current visibility for
  // existing rows. Publish/archive admin workflow itself is Phase 2 (High).
  status:       { type: String, enum: ['draft', 'published', 'archived'], default: 'published' },
  publishedAt:  { type: Date },
  slots:        [String],
  schedule:     { type: mongoose.Schema.Types.Mixed, default: {} },
  subjectDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

// Fast cohort lookup. Non-unique for now — uniqueness enforcement is deferred to
// Phase 2 so it cannot reject pre-existing duplicate rows on deploy.
timetableSchema.index({ department: 1, year: 1, semester: 1, section: 1, status: 1 });

module.exports = mongoose.model('Timetable', timetableSchema);
