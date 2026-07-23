const mongoose = require('mongoose');

// Department codes that may be targeted by a department-specific notice.
// Kept in sync with the student-facing departments in models/User.js (excludes 'Admin').
const DEPARTMENTS = ['IT', 'CSE', 'AIML', 'AIDS', 'Bioinformatics', 'ECE', 'EEE', 'MECH', 'CIVIL'];

// Allowed audiences: everyone, a role, or a single department.
const AUDIENCES = ['all', 'student', 'admin', ...DEPARTMENTS];

const noticeSchema = new mongoose.Schema({
  title:     { type: String, required: true },
  content:   { type: String, required: true },
  category:  { type: String, enum: ['exam', 'fee', 'general', 'urgent', 'holiday'], default: 'general' },
  postedBy:  { type: String, required: true },

  // ── Lifecycle (added for the production announcement workflow) ──────────────
  // status drives visibility: only 'published' notices reach students.
  // Default 'published' preserves the behaviour of any code path that creates a
  // notice without specifying a status (and matches legacy rows after migration).
  status:    { type: String, enum: ['draft', 'published', 'archived'], default: 'published', index: true },

  // Audience targeting. 'all' = everyone, 'student'/'admin' = role-scoped,
  // a department code = that department's students only.
  audience:  { type: String, enum: AUDIENCES, default: 'all' },

  // When the notice went live. Set on publish; used for sort + "time ago".
  // Optional/nullable so drafts have no publish date; backfilled from createdAt for legacy rows.
  publishedAt: { type: Date, default: null },

  // Optional auto-expiry. A published notice past this instant is hidden from students.
  expiresAt: { type: Date },

  // Admin user who authored the notice (audit/ownership). Optional for backward compatibility.
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // ── Smart Notice Summarizer (AI-generated on create/update) ─────────────────
  summary:     { type: String, default: '' },
  keyDates:    { type: [{ label: String, date: String, _id: false }], default: [] },
  actionItems: { type: [String], default: [] },
  aiPriority:  { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },

  // Optional attachment (faculty may upload a PDF / assignment). Stored as a base64
  // data URL; name/type kept separately so list views don't ship the blob. Optional
  // and back-compatible — existing notices simply have no attachment.
  attachment:     { type: String, default: '' },
  attachmentName: { type: String, default: '' },
  attachmentType: { type: String, default: '' },

  // Legacy soft-visibility flag, retained for backward compatibility with older rows/clients.
  isActive:  { type: Boolean, default: true },
  pinned:    { type: Boolean, default: false },
}, { timestamps: true });

const Notice = mongoose.model('Notice', noticeSchema);
Notice.DEPARTMENTS = DEPARTMENTS;
Notice.AUDIENCES = AUDIENCES;

module.exports = Notice;
