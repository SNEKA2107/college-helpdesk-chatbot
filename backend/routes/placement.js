const express = require('express');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { buildPlacement } = require('../services/placementEngine');

const router = express.Router();

// Resolve target student: a student sees their own hub; an admin may pass ?studentId=.
async function resolveStudent(req) {
  if (req.user.role === 'admin' && req.query.studentId) {
    return User.findOne({ studentId: req.query.studentId.toUpperCase() });
  }
  return req.user;
}

// GET /api/placement — full Placement Hub payload for the student.
router.get('/', protect, async (req, res) => {
  try {
    const student = await resolveStudent(req);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    const data = await buildPlacement(student);
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('Placement hub error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
