const mongoose = require('mongoose');

// Phase 4 — Faculty Study Materials. A faculty uploads course material (PDF / PPT /
// DOC / notes) for one of their assigned classes + subject; students in that class
// download it. File payloads are base64 data-URLs (same convention as Notice/Assignment).

const KINDS = ['PDF', 'PPT', 'DOC', 'Notes', 'Other'];

const studyMaterialSchema = new mongoose.Schema({
  title:          { type: String, required: true, trim: true },
  description:    { type: String, default: '' },
  subject:        { type: String, required: true, trim: true },
  subjectCode:    { type: String, default: '', trim: true },
  department:     { type: String, required: true, trim: true },
  semester:       { type: String, default: '', trim: true },
  section:        { type: String, default: '', trim: true },
  kind:           { type: String, enum: KINDS, default: 'Notes' },
  attachment:     { type: String, default: '' },   // base64 data-URL (required in practice)
  attachmentName: { type: String, default: '' },
  attachmentType: { type: String, default: '' },
  createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  facultyName:    { type: String, default: '' },
}, { timestamps: true });

studyMaterialSchema.index({ department: 1, semester: 1, section: 1 });

const StudyMaterial = mongoose.model('StudyMaterial', studyMaterialSchema);
StudyMaterial.KINDS = KINDS;

module.exports = StudyMaterial;
