const mongoose = require('mongoose');

// Phase 4 — Faculty Assignments. A faculty creates an assignment for one of their
// assigned classes (department/semester/section) and subject. Students in that class
// submit against it; the faculty then grades each submission with marks + remarks.
// File payloads are stored as base64 data-URLs (same convention as Notice attachments).

const submissionSchema = new mongoose.Schema({
  student:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentId:      { type: String, required: true, uppercase: true, trim: true },
  studentName:    { type: String, default: '' },
  text:           { type: String, default: '' },   // typed answer / notes
  attachment:     { type: String, default: '' },   // base64 data-URL
  attachmentName: { type: String, default: '' },
  attachmentType: { type: String, default: '' },
  submittedAt:    { type: Date, default: Date.now },
  // Grading (set by faculty)
  marks:          { type: Number, default: null },   // out of maxMarks
  grade:          { type: String, default: '' },     // optional letter grade
  remarks:        { type: String, default: '' },     // faculty remarks
  gradedBy:       { type: String, default: '' },
  gradedAt:       { type: Date, default: null },
}, { _id: false });

const assignmentSchema = new mongoose.Schema({
  title:          { type: String, required: true, trim: true },
  description:    { type: String, default: '' },
  subject:        { type: String, required: true, trim: true },
  subjectCode:    { type: String, default: '', trim: true },
  department:     { type: String, required: true, trim: true },
  semester:       { type: String, default: '', trim: true },
  section:        { type: String, default: '', trim: true },
  dueDate:        { type: Date, required: true },
  maxMarks:       { type: Number, default: 100, min: 1, max: 1000 },
  // Optional question paper / brief attachment.
  attachment:     { type: String, default: '' },
  attachmentName: { type: String, default: '' },
  attachmentType: { type: String, default: '' },
  // 'open' accepts submissions; 'closed' does not. Auto-derived from dueDate on read,
  // but faculty can force-close early.
  status:         { type: String, enum: ['open', 'closed'], default: 'open' },
  createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  facultyName:    { type: String, default: '' },
  submissions:    { type: [submissionSchema], default: [] },
}, { timestamps: true });

// A class is looked up by (department, semester, section) for student access.
assignmentSchema.index({ department: 1, semester: 1, section: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
