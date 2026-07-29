const mongoose = require('mongoose');

/**
 * Departments as data, not code.
 *
 * Audit finding H-1: department codes were a hardcoded enum duplicated across
 * models/User.js, models/Faculty.js, models/Notice.js and five frontend files —
 * and the lists disagreed, so ECE/EEE/MECH/CIVIL students could register but
 * could not be selected in the admin timetable/exam/attendance dropdowns.
 *
 * Every dropdown and validator now reads this collection instead.
 */
const departmentSchema = new mongoose.Schema({
  // Short code stored on User.department, Notice.audience, Timetable.department, …
  //
  // Case is preserved deliberately. Existing records hold mixed-case codes
  // ('Bioinformatics', 'Admin'), and those columns are matched with exact string
  // equality elsewhere (notice audiences, timetable/exam cohort resolution), so
  // upper-casing here would silently orphan every pre-existing row. Uniqueness
  // and lookups are case-INsensitive instead (see resolveDepartment).
  code: {
    type: String, required: [true, 'Department code is required'],
    unique: true, trim: true, maxlength: 20,
  },
  name:        { type: String, required: [true, 'Department name is required'], trim: true, maxlength: 120 },
  description: { type: String, default: '', trim: true, maxlength: 500 },
  // Disabled departments stay valid for existing records but disappear from
  // "create new" dropdowns — safer than deleting a department in use.
  isActive:    { type: Boolean, default: true, index: true },
  // 'Admin' is a functional bucket rather than a teaching department; it is kept
  // out of student-facing pickers.
  isAcademic:  { type: Boolean, default: true },
}, { timestamps: true });

departmentSchema.index({ isActive: 1, code: 1 });

module.exports = mongoose.model('Department', departmentSchema);
