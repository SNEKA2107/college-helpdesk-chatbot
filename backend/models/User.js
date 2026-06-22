const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  studentId:  { type: String, required: true, unique: true, uppercase: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:   { type: String, required: true, minlength: 8 },
  department: { type: String, required: true, enum: ['IT','CSE','AIML','AIDS','Bioinformatics','ECE','EEE','MECH','CIVIL','Admin'] },
  semester:   { type: String, default: '' },
  // Phase-1 foundation: cohort fields used to assign the correct segmented timetable.
  // Optional/back-compatible — existing users default to ''.
  year:       { type: String, default: '' },
  section:    { type: String, default: '' },
  role:       { type: String, enum: ['student','admin'], default: 'student' },
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
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
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
