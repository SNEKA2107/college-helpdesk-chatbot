const express  = require('express');
const Request  = require('../models/Request');
const User     = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');
const { sendEmail, emailTemplate } = require('../utils/email');

const router = express.Router();

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
    res.status(500).json({ success: false, message: err.message });
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
    res.status(500).json({ success: false, message: err.message });
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
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/requests/:id/status — update status (admin)
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  const { status, remarks } = req.body;
  try {
    const request = await Request.findByIdAndUpdate(
      req.params.id,
      {
        status,
        remarks: remarks || '',
        ...(status === 'Completed' && { completedAt: new Date() }),
      },
      { new: true }
    ).populate('student', 'name email studentId');
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    // Email notification
    if (request.student && request.student.email) {
      const statusColors = {
        'Under Review': '#facc15', 'Processing': '#60a5fa',
        'Ready for Collection': '#4ade80', 'Completed': '#4ade80', 'Rejected': '#f87171',
      };
      await sendEmail({
        to: request.student.email,
        subject: `📋 Request Update: ${request.type} — CampusAssist`,
        html: emailTemplate('Document Request Update', `
          <p>Dear <strong>${request.student.name}</strong>,</p>
          <p>Your document request status has been updated.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
            <tr><td style="padding:6px 0;color:#94a3b8;">Request Type</td><td style="color:#e2e8f0;">${request.type}</td></tr>
            <tr><td style="padding:6px 0;color:#94a3b8;">Ref Number</td><td style="color:#e2e8f0;">${request.refNumber}</td></tr>
            <tr><td style="padding:6px 0;color:#94a3b8;">New Status</td>
              <td style="color:${statusColors[status] || '#e2e8f0'};font-weight:bold;">${status}</td></tr>
            ${remarks ? `<tr><td style="padding:6px 0;color:#94a3b8;">Remarks</td><td style="color:#e2e8f0;">${remarks}</td></tr>` : ''}
          </table>
          ${status === 'Ready for Collection' ? '<p style="color:#4ade80;font-weight:bold;">📍 Please collect your document from Room 101, Admin Block with your ID card.</p>' : ''}
        `),
      });
    }

    res.json({ success: true, message: 'Status updated', request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
