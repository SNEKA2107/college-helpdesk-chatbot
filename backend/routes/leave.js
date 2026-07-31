const express = require('express');
const Leave   = require('../models/Leave');
const User    = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');
const { sendEmail, emailTemplate, html, raw } = require('../utils/email');
const { logAudit } = require('../utils/audit');
const { fail } = require('../utils/apiError');
const { validateUpload, DOCUMENT_TYPES } = require('../utils/upload');

const router = express.Router();

// ── Supporting-document validation ───────────────────────────────────────────
// The checks that used to be written out here became utils/upload.js, so every
// other upload route in the app now gets the same treatment. Delegating rather
// than keeping a second copy also means this route picks up the magic-byte
// verification that the shared version adds.
const MAX_DOC_BYTES = 3 * 1024 * 1024;           // 3 MB decoded

// Returns { ok, error?, fields? }. fields = { document, documentName, documentType }.
function validateDocument(document, documentName, documentType) {
  if (!document) return { ok: true, fields: null };          // optional
  const r = validateUpload(document, documentName || 'document', documentType, {
    allowed: DOCUMENT_TYPES, maxBytes: MAX_DOC_BYTES, label: 'Document',
  });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    fields: { document: r.fields.data, documentName: r.fields.name, documentType: r.fields.type },
  };
}

// GET /api/leave — list (blob excluded to keep the payload small; name/type retained
// so the UI knows a document exists and can fetch it on demand).
router.get('/', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { student: req.user._id };
    const leaves = await Leave.find(filter).select('-document').sort({ createdAt: -1 });
    res.json({ success: true, count: leaves.length, leaves });
  } catch (err) {
    return fail(res, err, 'Could not complete the leave request.');
  }
});

// GET /api/leave/:id/document — fetch the proof blob. Owner or admin only.
// Returns the data URL in JSON; the client converts it to a Blob for preview/download.
router.get('/:id/document', protect, async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id).select('document documentName documentType student');
    if (!leave) return res.status(404).json({ success: false, message: 'Leave application not found.' });

    const isOwner = leave.student && leave.student.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You are not allowed to view this document.' });
    }
    if (!leave.document) {
      return res.status(404).json({ success: false, message: 'No document was attached to this application.' });
    }
    res.json({
      success: true,
      document: leave.document,
      documentName: leave.documentName || 'document',
      documentType: leave.documentType || '',
    });
  } catch (err) {
    return fail(res, err, 'Could not complete the leave request.');
  }
});

// POST /api/leave
router.post('/', protect, async (req, res) => {
  const { leaveType, fromDate, toDate, reason, department, semester, document, documentName, documentType } = req.body;
  if (!leaveType || !fromDate || !toDate || !reason) {
    return res.status(400).json({ success: false, message: 'Leave type, dates, and reason are required.' });
  }
  // The dates were stored verbatim, so an inverted range (return before departure)
  // was accepted and then rendered as a negative-length leave everywhere it was
  // displayed. Reject it here, where the request is still the user's to correct.
  const from = new Date(fromDate);
  const to   = new Date(toDate);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return res.status(400).json({ success: false, message: 'From date and to date must be valid dates.' });
  }
  if (to < from) {
    return res.status(400).json({ success: false, message: 'The to date cannot be earlier than the from date.' });
  }
  // Delegates to the shared validator now (extracted from this very function),
  // which adds magic-byte verification on top of the checks that were here.
  const docCheck = validateDocument(document, documentName, documentType);
  if (!docCheck.ok) {
    return res.status(400).json({ success: false, message: docCheck.error });
  }
  try {
    const leave = await Leave.create({
      student:    req.user._id,
      studentId:  req.user.studentId,
      name:       req.user.name,
      department: department || req.user.department,
      semester:   semester   || req.user.semester,
      leaveType, fromDate: new Date(fromDate), toDate: new Date(toDate), reason,
      ...(docCheck.fields || {}),
    });
    res.status(201).json({ success: true, message: 'Leave application submitted successfully', leave });
  } catch (err) {
    return fail(res, err, 'Could not complete the leave request.');
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
      { status, remarks: String(remarks == null ? '' : remarks).slice(0, 1000), approvedBy: req.user.name },
      { new: true, runValidators: true }
    );
    if (!leave) return res.status(404).json({ success: false, message: 'Leave not found' });

    // Audit (distinguish OD from plain leave for the trail)
    const isOD = (leave.leaveType || '').startsWith('On Duty');
    await logAudit(req, isOD ? 'od.decision' : 'leave.decision', 'Leave', leave._id, {
      status, studentId: leave.studentId, leaveType: leave.leaveType,
    });

    // Email notification
    const student = await User.findOne({ studentId: leave.studentId });
    if (student && student.email) {
      const icon = status === 'Approved' ? '✅' : '❌';
      // html`` escapes every interpolated value; the student's name, the leave
      // type and the admin's remarks all reach this template from user input.
      const remarksRow = leave.remarks
        ? html`<tr><td style="padding:6px 0;color:#94a3b8;">Remarks</td><td style="color:#e2e8f0;">${leave.remarks}</td></tr>`
        : '';
      await sendEmail({
        to: student.email,
        subject: `${icon} Leave Application ${status} — Campus HelpDesk`,
        html: emailTemplate(`Leave Application ${status}`, html`
          <p>Dear <strong>${leave.name}</strong>,</p>
          <p>Your leave application has been <strong style="color:${raw(status === 'Approved' ? '#4ade80' : '#f87171')};">${status.toLowerCase()}</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
            <tr><td style="padding:6px 0;color:#94a3b8;">Leave Type</td><td style="color:#e2e8f0;">${leave.leaveType}</td></tr>
            <tr><td style="padding:6px 0;color:#94a3b8;">From</td><td style="color:#e2e8f0;">${new Date(leave.fromDate).toDateString()}</td></tr>
            <tr><td style="padding:6px 0;color:#94a3b8;">To</td><td style="color:#e2e8f0;">${new Date(leave.toDate).toDateString()}</td></tr>
            ${raw(remarksRow)}
          </table>
          <p style="color:#94a3b8;">Approved by: ${req.user.name}</p>
        `),
      });
    }

    res.json({ success: true, message: `Leave ${status.toLowerCase()}`, leave });
  } catch (err) {
    return fail(res, err, 'Could not complete the leave request.');
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
    return fail(res, err, 'Could not complete the leave request.');
  }
});

module.exports = router;
