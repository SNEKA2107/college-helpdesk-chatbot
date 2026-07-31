const express  = require('express');
const Request  = require('../models/Request');
const User     = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');
const { sendEmail, emailTemplate, html, raw } = require('../utils/email');
const { fail, badRequest } = require('../utils/apiError');

const router = express.Router();

// Valid workflow states, read from the schema so the two cannot drift apart.
const REQUEST_STATUSES = Request.schema.path('status').enumValues;

// GET /api/requests/stats
router.get('/stats', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { student: req.user._id };
    const [total, completed, inProgress, submitted] = await Promise.all([
      Request.countDocuments(filter),
      Request.countDocuments({ ...filter, status: 'Completed' }),
      Request.countDocuments({ ...filter, status: { $in: ['Under Review', 'Processing', 'Ready for Collection'] } }),
      Request.countDocuments({ ...filter, status: 'Submitted' }),
    ]);
    res.json({ success: true, stats: { total, completed, inProgress, pending: submitted } });
  } catch (err) {
    return fail(res, err, 'Could not complete the service request.');
  }
});

// GET /api/requests
router.get('/', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { student: req.user._id };
    const requests = await Request.find(filter)
      .populate('student', 'name studentId department email')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: requests.length, requests });
  } catch (err) {
    return fail(res, err, 'Could not complete the service request.');
  }
});

// POST /api/requests
router.post('/', protect, async (req, res) => {
  const { type, purpose, urgency } = req.body;
  if (!type || !purpose) {
    return res.status(400).json({ success: false, message: 'Request type and purpose are required.' });
  }
  try {
    const request = await Request.create({
      student:   req.user._id,
      studentId: req.user.studentId,
      type, purpose, urgency: urgency || 'Normal',
    });
    res.status(201).json({ success: true, message: 'Request submitted successfully', request });
  } catch (err) {
    return fail(res, err, 'Could not complete the service request.');
  }
});

// PUT /api/requests/:id/status — update status (admin)
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  const { status, remarks } = req.body;
  // findByIdAndUpdate does not run schema validators by default, so an arbitrary
  // string was landing in `status` and driving the request to a state the
  // workflow does not define — and then being reflected into the email below.
  if (!REQUEST_STATUSES.includes(status)) {
    return badRequest(res, `Status must be one of: ${REQUEST_STATUSES.join(', ')}.`);
  }
  const safeRemarks = String(remarks == null ? '' : remarks).slice(0, 1000);
  try {
    const request = await Request.findByIdAndUpdate(
      req.params.id,
      {
        status,
        remarks: safeRemarks,
        ...(status === 'Completed' && { completedAt: new Date() }),
      },
      { new: true, runValidators: true }
    ).populate('student', 'name email studentId');
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    // Email notification
    if (request.student && request.student.email) {
      const statusColors = {
        'Under Review': '#facc15', 'Processing': '#60a5fa',
        'Ready for Collection': '#4ade80', 'Completed': '#4ade80', 'Rejected': '#f87171',
      };
      // Every ${...} below is HTML-escaped by the html`` tag. The colour and the
      // two conditional blocks are template-controlled, so they use raw().
      const remarksRow = safeRemarks
        ? html`<tr><td style="padding:6px 0;color:#94a3b8;">Remarks</td><td style="color:#e2e8f0;">${safeRemarks}</td></tr>`
        : '';
      const collectNote = status === 'Ready for Collection'
        ? '<p style="color:#4ade80;font-weight:bold;">📍 Please collect your document from Room 101, Admin Block with your ID card.</p>'
        : '';
      await sendEmail({
        to: request.student.email,
        subject: `📋 Request Update: ${request.type} — Campus HelpDesk`,
        html: emailTemplate('Document Request Update', html`
          <p>Dear <strong>${request.student.name}</strong>,</p>
          <p>Your document request status has been updated.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
            <tr><td style="padding:6px 0;color:#94a3b8;">Request Type</td><td style="color:#e2e8f0;">${request.type}</td></tr>
            <tr><td style="padding:6px 0;color:#94a3b8;">Ref Number</td><td style="color:#e2e8f0;">${request.refNumber}</td></tr>
            <tr><td style="padding:6px 0;color:#94a3b8;">New Status</td>
              <td style="color:${raw(statusColors[status] || '#e2e8f0')};font-weight:bold;">${status}</td></tr>
            ${raw(remarksRow)}
          </table>
          ${raw(collectNote)}
        `),
      });
    }

    res.json({ success: true, message: 'Status updated', request });
  } catch (err) {
    return fail(res, err, 'Could not complete the service request.');
  }
});

// DELETE /api/requests/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    if (request.status !== 'Submitted') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a request that is already in progress.' });
    }
    await request.deleteOne();
    res.json({ success: true, message: 'Request cancelled' });
  } catch (err) {
    return fail(res, err, 'Could not complete the service request.');
  }
});

module.exports = router;
