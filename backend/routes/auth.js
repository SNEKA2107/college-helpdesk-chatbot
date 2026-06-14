const express = require('express');
const jwt     = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User    = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

const genToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// POST /api/auth/register
router.post('/register', [
  body('name').isString().notEmpty().trim().withMessage('Name is required'),
  body('studentId').isString().notEmpty().trim().withMessage('Student ID is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isString()
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter')
    .matches(/[\d@$!%*?&_\-#]/).withMessage('Password must contain at least one digit or special character'),
  body('department').isString().notEmpty().withMessage('Department is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { name, studentId, email, password, department, semester, year, section } = req.body;

  try {
    const existingUser = await User.findOne({ $or: [{ email }, { studentId: studentId.toUpperCase() }] });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'An account with this email or Student ID already exists.' });
    }

    // H4: new students await admin approval — no token issued, no auto-login.
    const user = await User.create({ name, studentId, email, password, department, semester, year, section, approvalStatus: 'pending' });

    res.status(201).json({
      success: true,
      pending: true,
      message: 'Registration submitted. Your account is pending admin approval — you will be able to log in once approved.',
      user: { name: user.name, studentId: user.studentId, approvalStatus: user.approvalStatus },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', [
  body('studentId').isString().notEmpty().withMessage('Student ID is required'),
  body('password').isString().notEmpty().withMessage('Password is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { studentId, password } = req.body;

  try {
    const user = await User.findOne({ studentId: studentId.toUpperCase() });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid Student ID or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact the admin.' });
    }

    // H4: block login until a student's registration is approved.
    if (user.approvalStatus === 'pending') {
      return res.status(403).json({ success: false, message: 'Your registration is pending admin approval. Please try again once it is approved.' });
    }
    if (user.approvalStatus === 'rejected') {
      const reason = user.rejectionReason ? ` Reason: ${user.rejectionReason}.` : '';
      return res.status(403).json({ success: false, message: `Your registration was not approved.${reason} Please contact the college office.` });
    }

    const token = genToken(user._id);
    res.json({ success: true, message: 'Login successful', token, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/me (protected)
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// PUT /api/auth/change-password (protected)
router.put('/change-password', protect, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { currentPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (!(await user.matchPassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/auth/profile — update own profile
router.put('/profile', protect, async (req, res) => {
  const { name, phone, semester, year, section, photo, parentName, motherName, parentPhone, parentEmail, parentOccupation, parentAddress } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Name is required.' });
  }
  if (photo !== undefined && typeof photo === 'string' && photo.length > 7 * 1024 * 1024) {
    return res.status(400).json({ success: false, message: 'Photo is too large. Please use an image under 5 MB.' });
  }
  try {
    const update = {
      name: name.trim(),
      phone: (phone || '').trim(),
      semester: (semester || '').trim(),
      parentName: (parentName || '').trim(),
      motherName: (motherName || '').trim(),
      parentPhone: (parentPhone || '').trim(),
      parentEmail: (parentEmail || '').trim(),
      parentOccupation: (parentOccupation || '').trim(),
      parentAddress: (parentAddress || '').trim(),
    };
    if (photo !== undefined) update.photo = photo;
    // Cohort fields are only touched when explicitly sent, so a partial profile
    // save never wipes a student's year/section.
    if (year !== undefined) update.year = (year || '').trim();
    if (section !== undefined) update.section = (section || '').trim();
    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true, runValidators: true });
    res.json({ success: true, message: 'Profile updated successfully.', user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
