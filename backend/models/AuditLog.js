const mongoose = require('mongoose');
const crypto = require('crypto');

// Phase 2 (H5): immutable trail of admin write actions.
const auditLogSchema = new mongoose.Schema({
  actor:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // admin who acted
  actorName: { type: String, default: '' },
  actorId:   { type: String, default: '' },                         // studentId of the admin (readable)
  action:    { type: String, required: true },                      // e.g. 'timetable.publish'
  entity:    { type: String, required: true },                      // e.g. 'Timetable'
  entityId:  { type: String, default: '' },
  details:   { type: mongoose.Schema.Types.Mixed, default: {} },    // small contextual snapshot
  timestamp: { type: Date, default: Date.now },

  // ── Tamper evidence (hash chain) ──────────────────────────────────────────
  // The trail was "immutable" by convention only: anything holding database
  // credentials could edit or delete a row and nothing would show. Each entry
  // now carries a SHA-256 over its own contents PLUS the previous entry's hash,
  // so the records form a chain. Altering or removing any entry breaks every
  // hash after it, which GET /api/audit?verify=1 detects and reports.
  //
  // This is detection, not prevention — an attacker with write access can still
  // change data. What they cannot do is change it *without leaving a trace*,
  // which is what an audit trail is actually for.
  prevHash:  { type: String, default: '' },
  hash:      { type: String, default: '', index: true },
  seq:       { type: Number, default: 0, index: true },
}, { timestamps: false });

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ entity: 1, timestamp: -1 });

/** Canonical serialisation of the fields covered by the hash. */
auditLogSchema.statics.canonical = function (doc) {
  return JSON.stringify({
    seq: doc.seq,
    actor: doc.actor ? String(doc.actor) : '',
    actorName: doc.actorName || '',
    actorId: doc.actorId || '',
    action: doc.action,
    entity: doc.entity,
    entityId: doc.entityId || '',
    details: doc.details || {},
    timestamp: new Date(doc.timestamp).toISOString(),
    prevHash: doc.prevHash || '',
  });
};

auditLogSchema.statics.computeHash = function (doc) {
  return crypto.createHash('sha256').update(this.canonical(doc)).digest('hex');
};

/**
 * Walk the chain oldest-to-newest and report the first break.
 * @returns {{ok, checked, brokenAt?, reason?}}
 */
auditLogSchema.statics.verifyChain = async function (limit = 1000) {
  const rows = await this.find().sort({ seq: 1 }).limit(limit).lean();
  let prev = '';
  for (const row of rows) {
    if ((row.prevHash || '') !== prev) {
      return { ok: false, checked: rows.length, brokenAt: row.seq, reason: 'prevHash does not match the preceding entry' };
    }
    if (row.hash !== this.computeHash(row)) {
      return { ok: false, checked: rows.length, brokenAt: row.seq, reason: 'entry contents do not match its recorded hash' };
    }
    prev = row.hash;
  }
  return { ok: true, checked: rows.length };
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
