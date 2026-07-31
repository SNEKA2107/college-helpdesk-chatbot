const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  studentId:  { type: String, required: true, unique: true, uppercase: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:   { type: String, required: true, minlength: 8 },
  // Department is validated against the Department collection at the route layer
  // (services/departments.js) rather than a hardcoded enum, so a college can add
  // its own departments without a code change. Existing values keep working —
  // bootstrapDepartments() adopts every code already present in the data.
  department: { type: String, required: [true, 'Department is required'], trim: true },
  semester:   { type: String, default: '' },
  // Phase-1 foundation: cohort fields used to assign the correct segmented timetable.
  // Optional/back-compatible — existing users default to ''.
  year:       { type: String, default: '' },
  section:    { type: String, default: '' },
  role:       { type: String, enum: ['student','admin','faculty'], default: 'student' },
  // ── Faculty profile (role: 'faculty'). All optional/back-compatible so existing
  // student & admin rows are unaffected. Faculty log in with their ID via the same
  // `studentId` field (e.g. 'FAC01'). ──────────────────────────────────────────
  designation:     { type: String, default: '' }, // e.g. 'Assistant Professor'
  qualification:   { type: String, default: '' }, // e.g. 'Ph.D. in Computer Science'
  experience:      { type: String, default: '' }, // e.g. '12 years'
  assignedSubjects: {
    type: [{
      code:       { type: String, default: '' },  // e.g. 'CS3491'
      name:       { type: String, default: '' },  // e.g. 'Artificial Intelligence'
      department: { type: String, default: '' },  // e.g. 'CSE'
      semester:   { type: String, default: '' },  // e.g. '5th'
      section:    { type: String, default: '' },  // e.g. 'A'
      // Academic year and batch, added with the admin assignment editor. Both are
      // optional: rows written before they existed simply have '' and continue to
      // match every year/batch, exactly as they did before.
      year:       { type: String, default: '' },  // e.g. '3rd'
      batch:      { type: String, default: '' },  // e.g. '2026'
      _id: false,
    }],
    default: [],
  },
  // Placement / success profile (Phase 2). Optional & back-compatible.
  cgpa:           { type: Number, default: 0 },
  skills:         { type: [String], default: [] },
  projects:       { type: [{ title: String, tech: String, _id: false }], default: [] },
  placementOptIn: { type: Boolean, default: true },
  phone:      { type: String, default: '' },
  photo:      { type: String, default: '' },
  parentName: { type: String, default: '' },
  motherName: { type: String, default: '' },
  parentPhone:{ type: String, default: '' },
  parentEmail:{ type: String, default: '' },
  parentOccupation: { type: String, default: '' },
  parentAddress:    { type: String, default: '' },
  isActive:   { type: Boolean, default: true },
  // Phase 2 (H4): registration approval. Default 'approved' so existing users and admin
  // accounts keep working; new student registrations are explicitly set to 'pending'.
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  // Approval audit trail. All optional/nullable for backward compatibility with rows
  // created before these fields existed.
  approvedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // admin who decided
  approvedAt:      { type: Date, default: null },   // when the approve/reject decision was made
  rejectionReason: { type: String, default: '' },   // optional reason shown to a rejected student
  // Set when an account is created with a system-generated temporary password
  // (e.g. admin-provisioned faculty). Purely advisory — the client uses it to
  // prompt for a password change. Defaults false so existing rows are unaffected.
  mustChangePassword: { type: Boolean, default: false },
  // Session revocation counter. Every issued token carries the value current at
  // sign-in; middleware/auth.js rejects any token whose value is stale. Bumping
  // it (logout, password change, deactivation) invalidates every token already
  // handed out — previously nothing could, so a copied token stayed valid for
  // its full 30-day life regardless of what the user or an admin did.
  tokenVersion: { type: Number, default: 0 },
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  // A password change ends every other session. Guarded so that setting the
  // initial password at creation does not count as a revocation event.
  if (!this.isNew) this.tokenVersion = (this.tokenVersion || 0) + 1;
  next();
});

userSchema.methods.matchPassword = async function(entered) {
  return await bcrypt.compare(entered, this.password);
};

userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
