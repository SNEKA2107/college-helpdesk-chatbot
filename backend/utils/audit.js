const AuditLog = require('../models/AuditLog');

// Fire-and-forget audit logging. Records who (req.user) did what to which entity.
// NEVER throws into the caller — an audit failure must not break the business action.
// Appends are serialised through this promise chain. Two concurrent writes would
// otherwise both read the same "latest" entry and produce two rows claiming the
// same predecessor, which reads as a broken chain on verification.
let appendQueue = Promise.resolve();

async function appendLinked(fields) {
  const last = await AuditLog.findOne().sort({ seq: -1 }).select('seq hash').lean();
  const doc = {
    ...fields,
    timestamp: new Date(),
    seq: last ? last.seq + 1 : 1,
    prevHash: last ? last.hash : '',
  };
  doc.hash = AuditLog.computeHash(doc);
  return AuditLog.create(doc);
}

async function logAudit(req, action, entity, entityId, details = {}) {
  try {
    const u = req && req.user ? req.user : {};
    const fields = {
      actor:     u._id,
      actorName: u.name || '',
      actorId:   u.studentId || '',
      action,
      entity,
      entityId: entityId ? String(entityId) : '',
      details,
    };
    // Chain the append onto the queue so seq/prevHash are allocated serially.
    appendQueue = appendQueue.then(() => appendLinked(fields), () => appendLinked(fields));
    await appendQueue;
  } catch (err) {
    // An audit write must never break the business action, but a silent failure
    // means privileged operations can happen with no trail. Log it loudly and
    // keep a counter the health/monitoring layer can alarm on, rather than
    // swallowing it at debug volume.
    auditFailures.count += 1;
    auditFailures.lastError = err.message;
    auditFailures.lastAt = new Date().toISOString();
    console.error(
      `🚨 AUDIT WRITE FAILED (total ${auditFailures.count}) — action=${action} entity=${entity} ` +
      `actor=${(req && req.user && req.user.studentId) || 'unknown'}: ${err.message}`
    );
  }
}

// Exposed so an operator can see whether the trail has gaps.
const auditFailures = { count: 0, lastError: null, lastAt: null };

module.exports = { logAudit, auditFailures };
