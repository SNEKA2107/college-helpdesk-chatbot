const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const Timetable = require('../models/Timetable');

const router = express.Router();

// GET /api/timetable — Full timetable for the student's dept/semester
router.get('/', protect, async (req, res) => {
  try {
    const { department, semester } = req.user;
    const timetable = await Timetable.findOne({ department, semester })
      || await Timetable.findOne().sort({ createdAt: -1 });

    if (!timetable) return res.status(404).json({ success: false, message: 'No timetable found.' });
    res.json({ success: true, timetable });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/timetable/today — Today's schedule
router.get('/today', protect, async (req, res) => {
  try {
    const { department, semester } = req.user;
    const timetable = await Timetable.findOne({ department, semester })
      || await Timetable.findOne().sort({ createdAt: -1 });

    if (!timetable) return res.status(404).json({ success: false, message: 'No timetable found.' });

    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const today = days[new Date().getDay()];
    const subjects = timetable.schedule[today] || [];

    res.json({
      success: true,
      day:      today,
      date:     new Date().toISOString().split('T')[0],
      slots:    timetable.slots,
      subjects,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/timetable/all — Admin: list every timetable for editing
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const timetables = await Timetable.find().sort({ updatedAt: -1 });
    res.json({ success: true, timetables });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/timetable — Admin: create timetable
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const tt = await Timetable.create(req.body);
    res.status(201).json({ success: true, timetable: tt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/timetable/:id — Admin: update timetable
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const tt = await Timetable.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!tt) return res.status(404).json({ success: false, message: 'Timetable not found.' });
    res.json({ success: true, timetable: tt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
