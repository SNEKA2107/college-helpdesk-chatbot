const express = require('express');
const Leave   = require('../models/Leave');
const User    = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');
const { sendEmail, emailTemplate } = require('../utils/email');
const { logAudit } = require('../utils/audit');

const router = express.Router();

// ── Supporting-document validation (base64 data URL stored in Mongo) ──────────
// Kept conservative: only PDF/JPG/PNG, ≤3 MB decoded so the ~33% base64 inflation
// stays under the server's 5 MB JSON body limit.
const MAX_DOC_BYTES = 3 * 1024 * 1024;           // 3 MB raw
const ALLOWED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ALLOWED_DOC_EXT = ['pdf', 'jpg', 'jpeg', 'png'];

// Returns { ok, error?, fields? }. fields = sanitized {document, documentName, documentType}.
function validateDocument(document, documentName, documentType) {
  if (!document) return { ok: true, fields: null };          // optional
  const m = /^data:([a-zA-Z0-9.+/-]+);base64,(.+)$/.exec(document);
  if (!m) return { ok: false, error: 'Document must be a valid base64 data URL.' };

  const declaredMime = m[1].toLowerCase();
  const b64 = m[2];
  // The MIME inside the data URL is the source of truth; the client-sent documentType must agree.
  if (!ALLOWED_DOC_TYPES.includes(declaredMime)) {
    return { ok: false, error: 'Only PDF, JPG, or PNG files are allowed.' };
  }
  if (documentType && documentType.toLowerCase() !== declaredMime) {
    return { ok: false, error: 'Document type mismatch.' };
  }

  // Decoded size guard (base64 length → byte count, accounting for padding).
  const padding = (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
  const byteLen = Math.floor(b64.length * 3 / 4) - padding;
  if (byteLen > MAX_DOC_BYTES) {
    return { ok: false, error: 'Document is too large. Maximum size is 3 MB.' };
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(b64)) {
    return { ok: false, error: 'Document contains invalid data.' };
  }

  // Sanitize the filename and verify its extension is allowed.
  const safeName = String(documentName || 'document')
    .replace(/[^\w.\- ]+/g, '_')
    .slice(0, 120);
  const ext = safeName.includes('.') ? safeName.split('.').pop().toLowerCase() : '';
  if (ext && !ALLOWED_DOC_EXT.includes(ext)) {
    return { ok: false, error: 'File extension not allowed. Use PDF, JPG, or PNG.' };
  }

  return { ok: true, fields: { document, documentName: safeName, documentType: declaredMime } };
}

// GET /api/leave — list (blob excluded to keep the payload small; name/type retained
// so the UI knows a document exists and can fetch it on demand).
router.get('/', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { student: req.user._id };
    const leaves = await Leave.find(filter).select('-document').sort({ createdAt: -1 });
    res.json({ success: true, count: leaves.length, leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/leave
router.post('/', protect, async (req, res) => {
  const { leaveType, fromDate, toDate, reason, department, semester, document, documentName, documentType } = req.body;
  if (!leaveType || !fromDate || !toDate || !reason) {
    return res.status(400).json({ success: false, message: 'Leave type, dates, and reason are required.' });
  }
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

    // Audit (distinguish OD from plain leave for the trail)
    const isOD = (leave.leaveType || '').startsWith('On Duty');
    await logAudit(req, isOD ? 'od.decision' : 'leave.decision', 'Leave', leave._id, {
      status, studentId: leave.studentId, leaveType: leave.leaveType,
    });

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
