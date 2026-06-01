const express = require('express');
const Event   = require('../models/Event');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/events — list active events
router.get('/', protect, async (req, res) => {
  try {
    const events = await Event.find({ isActive: true }).sort({ date: 1 });
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/events/:id/register — register current user
router.post('/:id/register', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    const already = event.registrations.includes(req.user._id);
    if (already) return res.status(400).json({ success: false, message: 'Already registered.' });
    if (event.registrations.length >= event.seats) {
      return res.status(400).json({ success: false, message: 'Event is full.' });
    }

    event.registrations.push(req.user._id);
    await event.save();
    res.json({ success: true, message: 'Registered successfully.', count: event.registrations.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/events/:id/register — unregister
router.delete('/:id/register', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    event.registrations = event.registrations.filter(id => id.toString() !== req.user._id.toString());
    await event.save();
    res.json({ success: true, message: 'Unregistered.', count: event.registrations.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/events — admin: create event
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const event = await Event.create(req.body);
    res.status(201).json({ success: true, event });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/events/:id — admin: update event
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    res.json({ success: true, event });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/events/:id — admin: delete event
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Event deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
