const mongoose = require('mongoose');

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
}, { timestamps: false });

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ entity: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
