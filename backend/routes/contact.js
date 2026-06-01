const express = require('express');
const Contact = require('../models/Contact');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// POST /api/contact — Student sends a message
router.post('/', protect, async (req, res) => {
  const { department, subject, message } = req.body;
  if (!department || !subject || !message) {
    return res.status(400).json({ success: false, message: 'Department, subject, and message are required.' });
  }
  try {
    const contact = await Contact.create({
      student:   req.user._id,
      studentId: req.user.studentId,
      name:      req.user.name,
      email:     req.user.email,
      department, subject, message
    });
    res.status(201).json({ success: true, message: 'Message sent to the office.', contact });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/contact — Admin gets all messages
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 });
    res.json({ success: true, count: messages.length, messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/contact/:id/resolve — Admin marks resolved
router.put('/:id/resolve', protect, adminOnly, async (req, res) => {
  try {
    const msg = await Contact.findByIdAndUpdate(req.params.id, { status: 'Resolved' }, { new: true });
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });
    res.json({ success: true, message: 'Marked as resolved', contact: msg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
