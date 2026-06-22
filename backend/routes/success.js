const express = require('express');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { computeSuccess, saveSnapshot, successTrend } = require('../services/successEngine');

const router = express.Router();

// Resolve target student: a student sees their own; an admin may pass ?studentId=.
async function resolveStudent(req) {
  if (req.user.role === 'admin' && req.query.studentId) {
    return User.findOne({ studentId: req.query.studentId.toUpperCase() });
  }
  return req.user;
}

// GET /api/success — full Student Success Dashboard payload + success trend.
router.get('/', protect, async (req, res) => {
  try {
    const student = await resolveStudent(req);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const result = await computeSuccess(student);
    await saveSnapshot(student, result).catch(() => {});   // non-fatal
    const trend = await successTrend(student);

    res.json({ success: true, student: { name: student.name, studentId: student.studentId, department: student.department }, ...result, successTrend: trend });
  } catch (err) {
    console.error('Success engine error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
