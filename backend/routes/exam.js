const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const Exam = require('../models/Exam');
const { logAudit } = require('../utils/audit');
const { fail, badRequest } = require('../utils/apiError');
const { pick } = require('../utils/sanitize');
const { resolveDepartment } = require('../services/departments');

const router = express.Router();

// Content fields only — lifecycle moves via /publish and /archive.
const EXAM_FIELDS = ['department', 'semester', 'year', 'section', 'theoryStart',
                     'theoryEnd', 'practicalStart', 'practicalEnd',
                     'hallTicketAvailable', 'schedule', 'practicals', 'instructions'];

// Resolve the exam schedule for a student's cohort. Published only. Scoped to the
// student's department+semester, then ranked by year/section specificity. A blank
// department on an exam means "institution-wide" (applies to everyone) — this keeps
// the pre-existing single exam visible to all while allowing cohort-specific ones.
async function resolveExamForUser(user) {
  const { department, semester, year = '', section = '' } = user;

  // Candidates: published exams that are either institution-wide (no department) or
  // match the student's department. Semester must match when the exam specifies one.
  const candidates = await Exam.find({
    status: 'published',
    $or: [{ department: '' }, { department }],
  }).sort({ updatedAt: -1 });

  const scoped = candidates.filter(e => !e.semester || !semester || String(e.semester) === String(semester) || e.department === '');
  const pool = scoped.length ? scoped : candidates;
  if (!pool.length) return null;

  const score = (e) => {
    let s = 0;
    if (department && e.department === department) s += 4;
    if (semester && String(e.semester) === String(semester)) s += 2;
    if (year && e.year === year) s += 2;
    if (section && e.section === section) s += 1;
    return s;
  };
  return pool.reduce((best, e) => (score(e) > score(best) ? e : best), pool[0]);
}

// GET /api/exam — student: their cohort's published exam; admin: latest (for back-compat)
router.get('/', protect, async (req, res) => {
  try {
    let exam;
    if (req.user.role === 'admin') {
      exam = await Exam.findOne().sort({ createdAt: -1 });
    } else {
      exam = await resolveExamForUser(req.user);
    }
    if (!exam) return res.status(404).json({ success: false, message: 'No exam schedule has been published for your class yet.' });
    res.json({ success: true, exam });
  } catch (err) {
    return fail(res, err, 'Could not complete the exam request.');
  }
});

// GET /api/exam/all — admin: every exam (history + drafts) for management
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const exams = await Exam.find().sort({ updatedAt: -1 });
    res.json({ success: true, exams });
  } catch (err) {
    return fail(res, err, 'Could not complete the exam request.');
  }
});

// GET /api/exam/schedule — student: theory schedule for their cohort
router.get('/schedule', protect, async (req, res) => {
  try {
    const exam = req.user.role === 'admin'
      ? await Exam.findOne().sort({ createdAt: -1 })
      : await resolveExamForUser(req.user);
    if (!exam) return res.status(404).json({ success: false, message: 'No exam schedule found.' });
    res.json({ success: true, schedule: exam.schedule });
  } catch (err) {
    return fail(res, err, 'Could not complete the exam request.');
  }
});

// GET /api/exam/practicals — student: practicals for their cohort
router.get('/practicals', protect, async (req, res) => {
  try {
    const exam = req.user.role === 'admin'
      ? await Exam.findOne().sort({ createdAt: -1 })
      : await resolveExamForUser(req.user);
    if (!exam) return res.status(404).json({ success: false, message: 'No exam schedule found.' });
    res.json({ success: true, practicals: exam.practicals });
  } catch (err) {
    return fail(res, err, 'Could not complete the exam request.');
  }
});

// POST /api/exam — Admin: create exam schedule (starts as DRAFT)
router.post('/', protect, adminOnly, async (req, res) => {
  // Audit finding M-2: validate before Mongoose so a bad body is a 400, not a 500.
  const { department, semester } = req.body || {};
  if (!department) return badRequest(res, 'Department is required.');
  if (!semester)   return badRequest(res, 'Semester is required.');

  const dept = await resolveDepartment(department);
  if (!dept.ok) return badRequest(res, dept.message);

  try {
    const exam = await Exam.create({ ...pick(req.body, EXAM_FIELDS), department: dept.code, status: 'draft', publishedAt: undefined });
    await logAudit(req, 'exam.create', 'Exam', exam._id, {
      department: exam.department, semester: exam.semester, year: exam.year, section: exam.section,
    });
    res.status(201).json({ success: true, exam });
  } catch (err) {
    return fail(res, err, 'Could not create the exam schedule.');
  }
});

// PUT /api/exam/:id — Admin: update exam content (lifecycle via /publish & /archive)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    // Allowlist rather than spread-and-delete (see the timetable route).
    const update = pick(req.body, EXAM_FIELDS);
    const exam = await Exam.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!exam) return res.status(404).json({ success: false, message: 'Exam record not found.' });
    await logAudit(req, 'exam.update', 'Exam', exam._id, { status: exam.status });
    res.json({ success: true, exam });
  } catch (err) {
    return fail(res, err, 'Could not complete the exam request.');
  }
});

// PUT /api/exam/:id/publish — Admin: publish to the cohort
router.put('/:id/publish', protect, adminOnly, async (req, res) => {
  try {
    const exam = await Exam.findByIdAndUpdate(
      req.params.id,
      { status: 'published', publishedAt: new Date() },
      { new: true }
    );
    if (!exam) return res.status(404).json({ success: false, message: 'Exam record not found.' });
    await logAudit(req, 'exam.publish', 'Exam', exam._id, {
      department: exam.department, semester: exam.semester, year: exam.year, section: exam.section,
    });
    res.json({ success: true, exam });
  } catch (err) {
    return fail(res, err, 'Could not complete the exam request.');
  }
});

// PUT /api/exam/:id/archive — Admin: archive (hidden from students)
router.put('/:id/archive', protect, adminOnly, async (req, res) => {
  try {
    const exam = await Exam.findByIdAndUpdate(req.params.id, { status: 'archived' }, { new: true });
    if (!exam) return res.status(404).json({ success: false, message: 'Exam record not found.' });
    await logAudit(req, 'exam.archive', 'Exam', exam._id, {});
    res.json({ success: true, exam });
  } catch (err) {
    return fail(res, err, 'Could not complete the exam request.');
  }
});

module.exports = router;
