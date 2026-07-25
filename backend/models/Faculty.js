const mongoose = require('mongoose');

// Phase 7 — Faculty Directory. Admin-managed; the Copilot text-searches it to
// answer "who teaches X", "who is the HOD", "what is the faculty email", etc.
//
// Since the dynamic-data fix this record is always paired with a User account
// (role:'faculty') that provides the actual login — see routes/faculty.js. The
// `user` link below joins the two; it is optional so directory rows created
// before the change keep working.
const facultySchema = new mongoose.Schema({
  name:           { type: String, required: true, trim: true },
  user:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
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

module.exports = mongoose.model('Faculty', facultySchema);
