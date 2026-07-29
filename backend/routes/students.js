const express = require('express');
const User    = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { fail, badRequest, notFound } = require('../utils/apiError');
const { initialiseStudent } = require('../services/studentInit');
const { resolveDepartment } = require('../services/departments');

const router = express.Router();

// GET /api/students — All students (admin only). Optional ?status=pending|approved|rejected
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { dept, semester, search, status } = req.query;
    const filter = { role: 'student' };
    if (dept)     filter.department = dept;
    if (semester) filter.semester   = semester;
    if (status)   filter.approvalStatus = status;
    if (search)   filter.$or = [
      { name:      { $regex: search, $options: 'i' } },
      { studentId: { $regex: search, $options: 'i' } },
    ];

    const students = await User.find(filter).select('-password').sort({ studentId: 1 });
    res.json({ success: true, count: students.length, students });
  } catch (err) {
    return fail(res, err, 'Could not complete the student request.');
  }
});

// GET /api/students/pending — admin: registrations awaiting approval
router.get('/pending', protect, adminOnly, async (req, res) => {
  try {
    const students = await User.find({ role: 'student', approvalStatus: 'pending' })
      .select('-password').sort({ createdAt: -1 });
    res.json({ success: true, count: students.length, students });
  } catch (err) {
    return fail(res, err, 'Could not complete the student request.');
  }
});

// PUT /api/students/:id/approve — admin: approve a pending registration.
// Approval also provisions the default records a working portal needs
// (audit finding M-1) — see services/studentInit.js.
router.put('/:id/approve', protect, adminOnly, async (req, res) => {
  try {
    const student = await User.findByIdAndUpdate(
      req.params.id,
      { approvalStatus: 'approved', approvedBy: req.user._id, approvedAt: new Date(), rejectionReason: '' },
      { new: true },
    ).select('-password');
    if (!student) return notFound(res, 'Student');

    const init = await initialiseStudent(student);

    await logAudit(req, 'registration.approve', 'User', student._id, {
      studentId: student.studentId, name: student.name, feeRecordCreated: init.fee,
    });
    res.json({
      success: true,
      message: init.errors.length
        ? `Registration approved, but some defaults could not be created: ${init.errors.join(', ')}.`
        : 'Registration approved',
      student,
      initialised: init,
    });
  } catch (err) {
    return fail(res, err, 'Could not approve the registration.');
  }
});

// PUT /api/students/:id/reject — admin: reject a pending registration (optional reason)
router.put('/:id/reject', protect, adminOnly, async (req, res) => {
  try {
    const reason = (req.body && typeof req.body.reason === 'string' ? req.body.reason : '').trim();
    const student = await User.findByIdAndUpdate(
      req.params.id,
      { approvalStatus: 'rejected', approvedBy: req.user._id, approvedAt: new Date(), rejectionReason: reason },
      { new: true },
    ).select('-password');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    await logAudit(req, 'registration.reject', 'User', student._id, { studentId: student.studentId, name: student.name, reason });
    res.json({ success: true, message: 'Registration rejected', student });
  } catch (err) {
    return fail(res, err, 'Could not complete the student request.');
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
    return fail(res, err, 'Could not complete the student request.');
  }
});

// GET /api/students/:id — admin only (prevents IDOR on other students' PII)
router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    const student = await User.findById(req.params.id).select('-password');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, student });
  } catch (err) {
    return fail(res, err, 'Could not complete the student request.');
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
    const allowed = ['name', 'phone', 'semester', 'year', 'section'];
    if (isAdmin) allowed.push('department', 'isActive', 'role');

    // Audit finding L-3: silently dropping fields the caller is not allowed to
    // set returned 200 as though the change had been applied. Reject explicitly.
    const submitted = Object.keys(req.body || {});
    const rejected = submitted.filter(f => !allowed.includes(f));
    if (rejected.length) {
      return badRequest(res, `You cannot change: ${rejected.join(', ')}.`);
    }

    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    // Departments are data now — validate against the Department collection.
    if (updates.department !== undefined) {
      const dept = await resolveDepartment(updates.department);
      if (!dept.ok) return badRequest(res, dept.message);
      updates.department = dept.code;
    }

    const student = await User.findByIdAndUpdate(
      req.params.id, updates, { new: true, runValidators: true },
    ).select('-password');
    if (!student) return notFound(res, 'Student');
    res.json({ success: true, student });
  } catch (err) {
    return fail(res, err, 'Could not update the student.');
  }
});

module.exports = router;
