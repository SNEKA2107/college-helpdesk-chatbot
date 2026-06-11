const express = require('express');
const User    = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/students — All students (admin only)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { dept, semester, search } = req.query;
    const filter = { role: 'student' };
    if (dept)     filter.department = dept;
    if (semester) filter.semester   = semester;
    if (search)   filter.$or = [
      { name:      { $regex: search, $options: 'i' } },
      { studentId: { $regex: search, $options: 'i' } },
    ];

    const students = await User.find(filter).select('-password').sort({ studentId: 1 });
    res.json({ success: true, count: students.length, students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/students/search/:query  — admin only (prevents student enumeration)
router.get('/search/:query', protect, adminOnly, async (req, res) => {
  try {
    const q = req.params.query;
    const students = await User.find({
      role: 'student',
      $or: [
        { name:      { $regex: q, $options: 'i' } },
        { studentId: { $regex: q, $options: 'i' } },
      ]
    }).select('-password').limit(20);
    res.json({ success: true, students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/students/:id — admin only (prevents IDOR on other students' PII)
router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    const student = await User.findById(req.params.id).select('-password');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/students/:id — Update profile (own or admin)
router.put('/:id', protect, async (req, res) => {
  try {
    const isOwn   = req.user._id.toString() === req.params.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwn && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    const allowed = ['name', 'phone', 'semester'];
    if (isAdmin) allowed.push('department', 'isActive', 'role');
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    const student = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
    res.json({ success: true, student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
