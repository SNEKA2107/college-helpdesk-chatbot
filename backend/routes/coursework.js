const express       = require('express');
const Assignment    = require('../models/Assignment');
const StudyMaterial = require('../models/StudyMaterial');
const { protect }   = require('../middleware/auth');

// Student-facing coursework API (mounted at /api/coursework). Lets a student see the
// assignments & study materials for THEIR OWN class, submit assignments, and download
// materials. Faculty CRUD/grading lives in routes/facultyPortal.js — this is additive
// and never touches admin/faculty entities. Student-role only.
const router = express.Router();

const norm = v => (v == null ? '' : String(v).trim().toLowerCase());
const MAX_FILE = 7 * 1024 * 1024;

router.use(protect, (req, res, next) => {
  if (req.user.role !== 'student') return res.status(403).json({ success: false, message: 'Student access only.' });
  next();
});

// Does an assignment/material's class match this student's cohort?
function matchesStudent(item, u) {
  if (norm(item.department) !== norm(u.department)) return false;
  if (norm(item.semester) && norm(item.semester) !== norm(u.semester)) return false;
  if (norm(item.section) && norm(item.section) !== norm(u.section)) return false;
  return true;
}

// Mongo prefilter (department + optional semester); section is filtered in JS because
// the stored value may be '' (all sections).
function classFilter(u) {
  return {
    department: u.department,
    $or: [{ semester: '' }, { semester: u.semester || '' }],
  };
}

function effectiveStatus(a) {
  if (a.status === 'closed') return 'closed';
  return new Date(a.dueDate) < new Date() ? 'closed' : 'open';
}

// ── Assignments ─────────────────────────────────────────────────────────────
// GET /assignments — assignments for the student's class + their own submission
router.get('/assignments', async (req, res) => {
  try {
    const docs = await Assignment.find(classFilter(req.user)).sort({ dueDate: 1 }).lean();
    const list = docs.filter(a => matchesStudent(a, req.user)).map(a => {
      const mine = (a.submissions || []).find(s => norm(s.studentId) === norm(req.user.studentId));
      return {
        _id: a._id, title: a.title, description: a.description,
        subject: a.subject, subjectCode: a.subjectCode,
        dueDate: a.dueDate, maxMarks: a.maxMarks, facultyName: a.facultyName,
        hasAttachment: !!a.attachment, attachmentName: a.attachmentName,
        status: effectiveStatus(a),
        submitted: !!mine,
        submission: mine ? {
          text: mine.text, attachmentName: mine.attachmentName, submittedAt: mine.submittedAt,
          marks: mine.marks, grade: mine.grade, remarks: mine.remarks, gradedAt: mine.gradedAt,
        } : null,
      };
    });
    res.json({ success: true, count: list.length, assignments: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /assignments/:id/file — download the assignment brief attachment (class-scoped)
router.get('/assignments/:id/file', async (req, res) => {
  try {
    const a = await Assignment.findById(req.params.id).select('attachment attachmentName department semester section');
    if (!a || !a.attachment) return res.status(404).json({ success: false, message: 'No attachment.' });
    if (!matchesStudent(a, req.user)) return res.status(403).json({ success: false, message: 'Not for your class.' });
    res.json({ success: true, attachment: a.attachment, attachmentName: a.attachmentName });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /assignments/:id/submit — create/replace the student's own submission
router.post('/assignments/:id/submit', async (req, res) => {
  const { text, attachment, attachmentName, attachmentType } = req.body;
  if (!text && !attachment) return res.status(400).json({ success: false, message: 'Add a note or attach a file to submit.' });
  if (attachment && attachment.length > MAX_FILE) return res.status(400).json({ success: false, message: 'Attachment is too large (max 5 MB).' });
  try {
    const a = await Assignment.findById(req.params.id);
    if (!a) return res.status(404).json({ success: false, message: 'Assignment not found.' });
    if (!matchesStudent(a, req.user)) return res.status(403).json({ success: false, message: 'This assignment is not for your class.' });
    if (effectiveStatus(a) === 'closed') return res.status(400).json({ success: false, message: 'This assignment is closed for submissions.' });

    const existing = (a.submissions || []).find(s => norm(s.studentId) === norm(req.user.studentId));
    if (existing) {
      existing.text = (text || '').trim();
      if (attachment !== undefined) { existing.attachment = attachment || ''; existing.attachmentName = attachmentName || ''; existing.attachmentType = attachmentType || ''; }
      existing.submittedAt = new Date();
      // Re-submission clears any prior grade.
      existing.marks = null; existing.grade = ''; existing.remarks = ''; existing.gradedBy = ''; existing.gradedAt = null;
    } else {
      a.submissions.push({
        student: req.user._id, studentId: req.user.studentId, studentName: req.user.name,
        text: (text || '').trim(), attachment: attachment || '', attachmentName: attachmentName || '', attachmentType: attachmentType || '',
        submittedAt: new Date(),
      });
    }
    await a.save();
    res.status(201).json({ success: true, message: existing ? 'Submission updated.' : 'Assignment submitted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Study Materials ─────────────────────────────────────────────────────────
// GET /materials — study materials for the student's class (blob omitted)
router.get('/materials', async (req, res) => {
  try {
    const docs = await StudyMaterial.find(classFilter(req.user)).sort({ createdAt: -1 }).select('-attachment').lean();
    const materials = docs.filter(m => matchesStudent(m, req.user));
    res.json({ success: true, count: materials.length, materials });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /materials/:id/file — download a class-scoped material's file
router.get('/materials/:id/file', async (req, res) => {
  try {
    const m = await StudyMaterial.findById(req.params.id).select('attachment attachmentName department semester section');
    if (!m || !m.attachment) return res.status(404).json({ success: false, message: 'No file.' });
    if (!matchesStudent(m, req.user)) return res.status(403).json({ success: false, message: 'Not for your class.' });
    res.json({ success: true, attachment: m.attachment, attachmentName: m.attachmentName });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
