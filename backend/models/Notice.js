const mongoose = require('mongoose');

// Non-department audiences. A notice may also target a single department by
// storing its code here — validated against the Department collection in
// routes/notices.js rather than a hardcoded enum, so new departments work
// immediately (audit finding H-1).
const ROLE_AUDIENCES = ['all', 'student', 'faculty', 'admin'];

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
  audience:  { type: String, default: 'all', trim: true },

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

/**
 * Audience tags a user is entitled to receive: 'all', their role, and any
 * department they belong to. `extraDepts` covers faculty, whose reach comes from
 * assigned classes rather than a single `department` field.
 *
 * Roles map to their own tag — a faculty member is NOT a student, so they must
 * not inherit student-targeted notices (and vice versa).
 */
noticeSchema.statics.audiencesFor = function (user, extraDepts = []) {
  if (!user) return ['all'];
  if (user.role === 'admin') return ['all', 'admin'];
  const roleTag = user.role === 'faculty' ? 'faculty' : 'student';
  const tags = ['all', roleTag, user.department, ...extraDepts];
  return [...new Set(tags.filter(Boolean))];
};

/**
 * Filter matching notices that are LIVE for `user` right now: published, not
 * deactivated, not past expiry, and addressed to one of their audiences.
 *
 * Every reader-facing query must go through this so the visibility rules cannot
 * drift apart — the faculty dashboard and notification feeds previously applied
 * their own narrower conditions and kept serving expired notices.
 *
 * Legacy rows written before status/audience/isActive existed have those fields
 * absent; they are treated as published, active and addressed to everyone.
 */
noticeSchema.statics.liveFilter = function (user, extraDepts = []) {
  return {
    status: { $nin: ['draft', 'archived'] },
    isActive: { $ne: false },
    $and: [
      { $or: [
        { audience: { $in: this.audiencesFor(user, extraDepts) } },
        { audience: { $exists: false } },
        { audience: null },
      ] },
      { $or: [
        { expiresAt: null },
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } },
      ] },
    ],
  };
};

const Notice = mongoose.model('Notice', noticeSchema);
Notice.ROLE_AUDIENCES = ROLE_AUDIENCES;

module.exports = Notice;
