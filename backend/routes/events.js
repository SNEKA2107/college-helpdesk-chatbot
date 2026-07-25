const express = require('express');
const Event   = require('../models/Event');
const { protect, adminOnly } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { fail, notFound } = require('../utils/apiError');

const router = express.Router();

// GET /api/events — list active events
router.get('/', protect, async (req, res) => {
  try {
    const events = await Event.find({ isActive: true }).sort({ date: 1 });
    res.json({ success: true, events });
  } catch (err) {
    return fail(res, err, 'Could not complete the event request.');
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
    return fail(res, err, 'Could not complete the event request.');
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
    return fail(res, err, 'Could not complete the event request.');
  }
});

// POST /api/events — admin: create event
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const event = await Event.create(req.body);
    await logAudit(req, 'event.create', 'Event', event._id, { title: event.title, category: event.category });
    res.status(201).json({ success: true, event });
  } catch (err) {
    // fail() already maps a Mongoose ValidationError to a clean 400; a genuine
    // server fault is no longer mislabelled as the caller's mistake.
    return fail(res, err, 'Could not create the event.');
  }
});

// PUT /api/events/:id — admin: update event
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!event) return notFound(res, 'Event');
    res.json({ success: true, event });
  } catch (err) {
    return fail(res, err, 'Could not update the event.');
  }
});

// DELETE /api/events/:id — admin: delete event
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return notFound(res, 'Event');   // audit finding L-1
    res.json({ success: true, message: 'Event deleted.' });
  } catch (err) {
    return fail(res, err, 'Could not delete the event.');
  }
});

module.exports = router;
