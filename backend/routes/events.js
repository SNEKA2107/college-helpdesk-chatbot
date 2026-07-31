const express = require('express');
const Event   = require('../models/Event');
const { protect, adminOnly } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { fail, notFound } = require('../utils/apiError');
const { pick } = require('../utils/sanitize');

const router = express.Router();

// Fields an admin may set on an event. `registrations` is deliberately absent —
// it is only ever changed by the register/unregister routes.
const EVENT_FIELDS = ['title', 'category', 'date', 'time', 'venue', 'organizer',
                      'description', 'seats', 'isActive'];

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
    const event = await Event.findById(req.params.id).select('seats registrations');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    if (event.registrations.some(id => id.equals(req.user._id))) {
      return res.status(400).json({ success: false, message: 'Already registered.' });
    }

    // Atomic seat claim. Checking length and then saving is a check-then-act:
    // concurrent registrations all observed the same pre-write count and every
    // one of them appended, so the seat cap could be overshot by firing requests
    // in parallel. $expr evaluates the capacity against the document at write
    // time, and $ne re-checks duplicates in the same operation.
    const updated = await Event.findOneAndUpdate(
      {
        _id: event._id,
        registrations: { $ne: req.user._id },
        $expr: { $lt: [{ $size: '$registrations' }, '$seats'] },
      },
      { $push: { registrations: req.user._id } },
      { new: true },
    ).select('registrations');

    if (!updated) {
      // Either the last seat went to a concurrent request, or this user already
      // registered in one. Re-read to tell the caller which.
      const fresh = await Event.findById(event._id).select('seats registrations');
      const dup = fresh && fresh.registrations.some(id => id.equals(req.user._id));
      return res.status(dup ? 400 : 409).json({
        success: false,
        message: dup ? 'Already registered.' : 'Event is full.',
      });
    }
    res.json({ success: true, message: 'Registered successfully.', count: updated.registrations.length });
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
    // Allowlist: spreading the body let a caller pre-populate `registrations`
    // and set fields the admin form never exposes.
    const event = await Event.create(pick(req.body, EVENT_FIELDS));
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
    const event = await Event.findByIdAndUpdate(req.params.id, pick(req.body, EVENT_FIELDS), { new: true, runValidators: true });
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
