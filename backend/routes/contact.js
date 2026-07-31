const express = require('express');
const Contact = require('../models/Contact');
const { protect, adminOnly } = require('../middleware/auth');
const { fail } = require('../utils/apiError');
const { stripHtml } = require('../utils/sanitize');

const router = express.Router();

// POST /api/contact — Student sends a message
router.post('/', protect, async (req, res) => {
  const { department, subject, message } = req.body;
  if (!department || !subject || !message) {
    return res.status(400).json({ success: false, message: 'Department, subject, and message are required.' });
  }
  if (typeof subject === 'string' && subject.length > 200) {
    return res.status(400).json({ success: false, message: 'Subject must be 200 characters or fewer.' });
  }
  if (typeof message === 'string' && message.length > 2000) {
    return res.status(400).json({ success: false, message: 'Message must be 2000 characters or fewer.' });
  }
  try {
    // Strip markup on write, as notices.js, knowledge.js, faculty.js and
    // departments.js all do. This was the one write path that stored raw input,
    // and it is rendered in the admin inbox.
    const contact = await Contact.create({
      student:   req.user._id,
      studentId: req.user.studentId,
      name:      req.user.name,
      email:     req.user.email,
      department: stripHtml(department),
      subject:    stripHtml(subject),
      message:    stripHtml(message),
    });
    res.status(201).json({ success: true, message: 'Message sent to the office.', contact });
  } catch (err) {
    return fail(res, err, 'Could not complete the request.');
  }
});

// GET /api/contact — Admin gets all messages
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 });
    res.json({ success: true, count: messages.length, messages });
  } catch (err) {
    return fail(res, err, 'Could not complete the request.');
  }
});

// PUT /api/contact/:id/resolve — Admin marks resolved
router.put('/:id/resolve', protect, adminOnly, async (req, res) => {
  try {
    const msg = await Contact.findByIdAndUpdate(req.params.id, { status: 'Resolved' }, { new: true });
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });
    res.json({ success: true, message: 'Marked as resolved', contact: msg });
  } catch (err) {
    return fail(res, err, 'Could not complete the request.');
  }
});

module.exports = router;
