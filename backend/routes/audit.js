const express = require('express');
const AuditLog = require('../models/AuditLog');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/audit — admin: recent audit entries (optional ?entity= & ?limit=)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const filter = {};
    if (req.query.entity) filter.entity = req.query.entity;
    const limit = Math.min(parseInt(req.query.limit || '200', 10) || 200, 500);
    const logs = await AuditLog.find(filter).sort({ timestamp: -1 }).limit(limit);
    res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
