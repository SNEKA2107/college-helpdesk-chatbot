const mongoose = require('mongoose');

// Anna University 10-point grading (R2017/R2021 theory split).
// Assumptions (documented): internal is out of 40, external out of 60, total out of 100,
// minimum pass = 50. A total below 50 is a Reappear (RA) with grade point 0.
const GRADE_BANDS = [
  { min: 91, grade: 'O',  point: 10 },
  { min: 81, grade: 'A+', point: 9 },
  { min: 71, grade: 'A',  point: 8 },
  { min: 61, grade: 'B+', point: 7 },
  { min: 50, grade: 'B',  point: 6 },
  { min: 0,  grade: 'RA', point: 0 },
];

function computeGrade(internal, external) {
  const total = Math.round((Number(internal) || 0) + (Number(external) || 0));
  const band = GRADE_BANDS.find(b => total >= b.min);
  return { total, grade: band.grade, gradePoint: band.point };
}

const marksSchema = new mongoose.Schema({
  student:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentId:     { type: String, required: true, uppercase: true, trim: true },
  semester:      { type: String, required: true, trim: true },
  subject:       { type: String, required: true, trim: true },
  subjectCode:   { type: String, default: '', trim: true },
  credits:       { type: Number, required: true, min: 0, max: 12 },
  internalMarks: { type: Number, required: true, min: 0, max: 40 },
  externalMarks: { type: Number, required: true, min: 0, max: 60 },
  total:         { type: Number, default: 0 },
  grade:         { type: String, default: 'RA' },
  gradePoint:    { type: Number, default: 0 },
  enteredBy:     { type: String, default: 'Admin' },
}, { timestamps: true });

// CRIT-01: one marks record per student, per semester, per subject.
marksSchema.index({ student: 1, semester: 1, subject: 1 }, { unique: true });

marksSchema.statics.computeGrade = computeGrade;
marksSchema.statics.GRADE_BANDS = GRADE_BANDS;

module.exports = mongoose.model('Marks', marksSchema);
