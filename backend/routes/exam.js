const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const Exam = require('../models/Exam');

const router = express.Router();

// GET /api/exam — Full exam data for current semester
router.get('/', protect, async (req, res) => {
  try {
    const exam = await Exam.findOne().sort({ createdAt: -1 });
    if (!exam) return res.status(404).json({ success: false, message: 'No exam schedule found.' });
    res.json({ success: true, exam });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/exam/schedule
router.get('/schedule', protect, async (req, res) => {
  try {
    const exam = await Exam.findOne().sort({ createdAt: -1 });
    if (!exam) return res.status(404).json({ success: false, message: 'No exam schedule found.' });
    res.json({ success: true, schedule: exam.schedule });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/exam/practicals
router.get('/practicals', protect, async (req, res) => {
  try {
    const exam = await Exam.findOne().sort({ createdAt: -1 });
    if (!exam) return res.status(404).json({ success: false, message: 'No exam schedule found.' });
    res.json({ success: true, practicals: exam.practicals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/exam — Admin: create/replace exam schedule
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const exam = await Exam.create(req.body);
    res.status(201).json({ success: true, exam });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/exam/:id — Admin: update exam schedule
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const exam = await Exam.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!exam) return res.status(404).json({ success: false, message: 'Exam record not found.' });
    res.json({ success: true, exam });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
