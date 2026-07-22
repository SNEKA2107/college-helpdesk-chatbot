const express = require('express');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { buildHome } = require('../services/homeBriefing');

const router = express.Router();

// Resolve target student: a student sees their own home; an admin may pass ?studentId=.
async function resolveStudent(req) {
  if (req.user.role === 'admin' && req.query.studentId) {
    return User.findOne({ studentId: req.query.studentId.toUpperCase() });
  }
  return req.user;
}

// GET /api/home — personalized Student Home Dashboard payload.
router.get('/', protect, async (req, res) => {
  try {
    const student = await resolveStudent(req);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    const data = await buildHome(student);
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('Home dashboard error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
