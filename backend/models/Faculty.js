const mongoose = require('mongoose');

// Phase 7 — Faculty Directory. Admin-managed; the Copilot text-searches it to
// answer "who teaches X", "who is the HOD", "what is the faculty email", etc.
const DEPARTMENTS = ['IT', 'CSE', 'AIML', 'AIDS', 'Bioinformatics', 'ECE', 'EEE', 'MECH', 'CIVIL', 'General'];

const facultySchema = new mongoose.Schema({
  name:           { type: String, required: true, trim: true },
  department:     { type: String, default: 'General', index: true },
  designation:    { type: String, default: 'Assistant Professor' },
  email:          { type: String, default: '', lowercase: true, trim: true },
  phone:          { type: String, default: '' },
  subjects:       { type: [String], default: [] },
  officeLocation: { type: String, default: '' },
  // Marks the Head of Department for the "who is the HOD" query.
  isHOD:          { type: Boolean, default: false },
  isActive:       { type: Boolean, default: true },
}, { timestamps: true });

// Keyword retrieval over the fields students ask about.
facultySchema.index({ name: 'text', subjects: 'text', department: 'text', designation: 'text' });

const Faculty = mongoose.model('Faculty', facultySchema);
Faculty.DEPARTMENTS = DEPARTMENTS;

module.exports = Faculty;
