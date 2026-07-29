const express = require('express');
const CalendarEvent = require('../models/CalendarEvent');
const { protect, adminOnly } = require('../middleware/auth');
const { fail } = require('../utils/apiError');

const router = express.Router();

const TYPES = ['Holiday', 'Exam', 'Deadline', 'Semester', 'Event'];

// GET /api/calendar — list active calendar entries (students + admin), optional ?type= filter
router.get('/', protect, async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.type && TYPES.includes(req.query.type)) filter.type = req.query.type;
    const entries = await CalendarEvent.find(filter).sort({ date: 1 });
    res.json({ success: true, count: entries.length, entries });
  } catch (err) {
    return fail(res, err, 'Could not complete the calendar request.');
  }
});

// POST /api/calendar — admin: create an entry
router.post('/', protect, adminOnly, async (req, res) => {
  const { title, type, date, endDate, description } = req.body;
  if (!title || !type || !date) {
    return res.status(400).json({ success: false, message: 'title, type and date are required.' });
  }
  if (!TYPES.includes(type)) {
    return res.status(400).json({ success: false, message: `type must be one of: ${TYPES.join(', ')}` });
  }
  try {
    const entry = await CalendarEvent.create({
      title: title.trim(),
      type,
      date: new Date(date),
      endDate: endDate ? new Date(endDate) : undefined,
      description: (description || '').trim(),
    });
    res.status(201).json({ success: true, message: 'Calendar entry created', entry });
  } catch (err) {
    return fail(res, err, 'Could not complete the calendar request.');
  }
});

// PUT /api/calendar/:id — admin: update an entry
router.put('/:id', protect, adminOnly, async (req, res) => {
  const { title, type, date, endDate, description, isActive } = req.body;
  if (type && !TYPES.includes(type)) {
    return res.status(400).json({ success: false, message: `type must be one of: ${TYPES.join(', ')}` });
  }
  try {
    const update = {};
    if (title !== undefined) update.title = title.trim();
    if (type !== undefined) update.type = type;
    if (date !== undefined) update.date = new Date(date);
    if (endDate !== undefined) update.endDate = endDate ? new Date(endDate) : null;
    if (description !== undefined) update.description = description.trim();
    if (isActive !== undefined) update.isActive = !!isActive;

    const entry = await CalendarEvent.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!entry) return res.status(404).json({ success: false, message: 'Calendar entry not found' });
    res.json({ success: true, message: 'Calendar entry updated', entry });
  } catch (err) {
    return fail(res, err, 'Could not complete the calendar request.');
  }
});

// DELETE /api/calendar/:id — admin: delete an entry
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const deleted = await CalendarEvent.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Calendar entry not found' });
    res.json({ success: true, message: 'Calendar entry deleted' });
  } catch (err) {
    return fail(res, err, 'Could not complete the calendar request.');
  }
});

module.exports = router;
