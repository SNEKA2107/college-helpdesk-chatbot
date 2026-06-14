const AuditLog = require('../models/AuditLog');

// Fire-and-forget audit logging. Records who (req.user) did what to which entity.
// NEVER throws into the caller — an audit failure must not break the business action.
async function logAudit(req, action, entity, entityId, details = {}) {
  try {
    const u = req && req.user ? req.user : {};
    await AuditLog.create({
      actor:     u._id,
      actorName: u.name || '',
      actorId:   u.studentId || '',
      action,
      entity,
      entityId: entityId ? String(entityId) : '',
      details,
    });
  } catch (err) {
    console.error('audit log failed:', err.message);
  }
}

module.exports = { logAudit };
