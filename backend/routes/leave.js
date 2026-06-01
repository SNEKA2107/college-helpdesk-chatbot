const express = require('express');
const Leave   = require('../models/Leave');
const User    = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');
const { sendEmail, emailTemplate } = require('../utils/email');

const router = express.Router();

// GET /api/leave
router.get('/', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { student: req.user._id };
    const leaves = await Leave.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: leaves.length, leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/leave
router.post('/', protect, async (req, res) => {
  const { leaveType, fromDate, toDate, reason, department, semester } = req.body;
  if (!leaveType || !fromDate || !toDate || !reason) {
    return res.status(400).json({ success: false, message: 'Leave type, dates, and reason are required.' });
  }
  try {
    const leave = await Leave.create({
      student:    req.user._id,
      studentId:  req.user.studentId,
      name:       req.user.name,
      department: department || req.user.department,
      semester:   semester   || req.user.semester,
      leaveType, fromDate: new Date(fromDate), toDate: new Date(toDate), reason,
    });
    res.status(201).json({ success: true, message: 'Leave application submitted successfully', leave });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/leave/:id/status — approve/reject (admin)
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  const { status, remarks } = req.body;
  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status must be Approved or Rejected.' });
  }
  try {
    const leave = await Leave.findByIdAndUpdate(
      req.params.id,
      { status, remarks: remarks || '', approvedBy: req.user.name },
      { new: true }
    );
    if (!leave) return res.status(404).json({ success: false, message: 'Leave not found' });

    // Email notification
    const student = await User.findOne({ studentId: leave.studentId });
    if (student && student.email) {
      const icon = status === 'Approved' ? '✅' : '❌';
      await sendEmail({
        to: student.email,
        subject: `${icon} Leave Application ${status} — CampusAssist`,
        html: emailTemplate(`Leave Application ${status}`, `
          <p>Dear <strong>${leave.name}</strong>,</p>
          <p>Your leave application has been <strong style="color:${status === 'Approved' ? '#4ade80' : '#f87171'};">${status.toLowerCase()}</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
            <tr><td style="padding:6px 0;color:#94a3b8;">Leave Type</td><td style="color:#e2e8f0;">${leave.leaveType}</td></tr>
            <tr><td style="padding:6px 0;color:#94a3b8;">From</td><td style="color:#e2e8f0;">${new Date(leave.fromDate).toDateString()}</td></tr>
            <tr><td style="padding:6px 0;color:#94a3b8;">To</td><td style="color:#e2e8f0;">${new Date(leave.toDate).toDateString()}</td></tr>
            ${remarks ? `<tr><td style="padding:6px 0;color:#94a3b8;">Remarks</td><td style="color:#e2e8f0;">${remarks}</td></tr>` : ''}
          </table>
          <p style="color:#94a3b8;">Approved by: ${req.user.name}</p>
        `),
      });
    }

    res.json({ success: true, message: `Leave ${status.toLowerCase()}`, leave });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/leave/:id — cancel if still Pending
router.delete('/:id', protect, async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ success: false, message: 'Leave not found' });
    if (leave.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    if (leave.status !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a processed leave application.' });
    }
    await leave.deleteOne();
    res.json({ success: true, message: 'Leave application cancelled' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
