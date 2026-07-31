const express = require('express');
const AuditLog = require('../models/AuditLog');
const { protect, adminOnly } = require('../middleware/auth');
const { fail } = require('../utils/apiError');
const { coerceQuery } = require('../utils/sanitize');

const router = express.Router();

// GET /api/audit — admin: recent audit entries (optional ?entity= & ?limit=)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const filter = {};
    // Coerced: ?entity[$ne]=x would otherwise reach the filter as an operator.
    const entity = coerceQuery(req.query.entity);
    if (entity) filter.entity = entity;
    const limit = Math.min(parseInt(req.query.limit || '200', 10) || 200, 500);
    const logs = await AuditLog.find(filter).sort({ timestamp: -1 }).limit(limit);

    // ?verify=1 walks the hash chain and reports whether the trail is intact.
    // Detection, not prevention: anything with database credentials can still
    // edit a row, but it cannot do so without breaking every hash that follows.
    const body = { success: true, count: logs.length, logs };
    if (req.query.verify === '1') {
      body.integrity = await AuditLog.verifyChain(1000);
      if (!body.integrity.ok) {
        console.error(`🚨 AUDIT CHAIN BROKEN at seq ${body.integrity.brokenAt}: ${body.integrity.reason}`);
      }
    }
    res.json(body);
  } catch (err) {
    return fail(res, err, 'Could not load the audit log.');
  }
});

module.exports = router;
