const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const Timetable = require('../models/Timetable');
const { detectConflicts } = require('../utils/timetableConflicts');
const { logAudit } = require('../utils/audit');
const { fail, badRequest } = require('../utils/apiError');
const { pick } = require('../utils/sanitize');
const { resolveDepartment } = require('../services/departments');

const router = express.Router();

// Content fields only — `status` and `publishedAt` move via /publish and /archive.
const TIMETABLE_FIELDS = ['department', 'semester', 'academicYear', 'year',
                          'section', 'slots', 'schedule'];

// Resolve the single timetable that belongs to THIS student's cohort.
// Hard rule: never return a timetable from a different department+semester
// (that was the old `|| findOne()` cross-cohort leak). Within the student's
// dept+semester we prefer the most specific match:
//   exact year+section  →  section-only  →  year-only  →  dept+sem ("all sections").
// Archived timetables are never shown.
async function resolveTimetableForUser(user) {
  const { department, semester, year = '', section = '' } = user;
  if (!department || !semester) return null;

  // Students only ever see PUBLISHED timetables — never draft, never archived.
  const candidates = await Timetable.find({
    department,
    semester,
    status: 'published',
  }).sort({ updatedAt: -1 });
  if (!candidates.length) return null;

  const score = (t) => {
    let s = 0;
    if (year && t.year === year) s += 2;
    if (section && t.section === section) s += 1;
    // A blank field on the timetable means "applies to all" — neutral, never negative.
    return s;
  };
  // Highest specificity wins; ties keep the most recently updated (sort above).
  return candidates.reduce((best, t) => (score(t) > score(best) ? t : best), candidates[0]);
}

// GET /api/timetable — Full timetable for the student's cohort
router.get('/', protect, async (req, res) => {
  try {
    const timetable = await resolveTimetableForUser(req.user);
    if (!timetable) return res.status(404).json({ success: false, message: 'No timetable has been published for your class yet.' });
    res.json({ success: true, timetable });
  } catch (err) {
    return fail(res, err, 'Could not complete the timetable request.');
  }
});

// GET /api/timetable/today — Today's schedule
router.get('/today', protect, async (req, res) => {
  try {
    const timetable = await resolveTimetableForUser(req.user);
    if (!timetable) return res.status(404).json({ success: false, message: 'No timetable has been published for your class yet.' });

    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const today = days[new Date().getDay()];
    const subjects = timetable.schedule[today] || [];

    res.json({
      success: true,
      day:      today,
      date:     new Date().toISOString().split('T')[0],
      slots:    timetable.slots,
      subjects,
    });
  } catch (err) {
    return fail(res, err, 'Could not complete the timetable request.');
  }
});

// GET /api/timetable/all — Admin: list every timetable for editing
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const timetables = await Timetable.find().sort({ updatedAt: -1 });
    res.json({ success: true, timetables });
  } catch (err) {
    return fail(res, err, 'Could not complete the timetable request.');
  }
});

// POST /api/timetable — Admin: create timetable (always starts as DRAFT)
router.post('/', protect, adminOnly, async (req, res) => {
  // Audit finding M-2: an empty/partial body used to reach Mongoose and return a
  // 500 with the raw validation text. Check the required fields up front.
  const { department, semester, academicYear } = req.body || {};
  if (!department)   return badRequest(res, 'Department is required.');
  if (!semester)     return badRequest(res, 'Semester is required.');
  if (!academicYear) return badRequest(res, 'Academic year is required (e.g. 2026-2027).');

  const dept = await resolveDepartment(department);
  if (!dept.ok) return badRequest(res, dept.message);

  try {
    // New timetables are drafts until explicitly published — never auto-visible to students.
    const tt = await Timetable.create({ ...pick(req.body, TIMETABLE_FIELDS), department: dept.code, status: 'draft', publishedAt: undefined });
    await logAudit(req, 'timetable.create', 'Timetable', tt._id, {
      department: tt.department, semester: tt.semester, year: tt.year, section: tt.section,
    });
    res.status(201).json({ success: true, timetable: tt });
  } catch (err) {
    return fail(res, err, 'Could not create the timetable.');
  }
});

// PUT /api/timetable/:id — Admin: update timetable content (status unchanged here;
// use /publish and /archive to move lifecycle state).
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    // Allowlist rather than spread-and-delete: the deletes only removed the two
    // keys anyone remembered, leaving every other body key reaching the caster.
    const update = pick(req.body, TIMETABLE_FIELDS);
    const tt = await Timetable.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!tt) return res.status(404).json({ success: false, message: 'Timetable not found.' });
    await logAudit(req, 'timetable.update', 'Timetable', tt._id, { status: tt.status });
    res.json({ success: true, timetable: tt });
  } catch (err) {
    return fail(res, err, 'Could not complete the timetable request.');
  }
});

// GET /api/timetable/:id/conflicts — Admin: preview conflicts without publishing
router.get('/:id/conflicts', protect, adminOnly, async (req, res) => {
  try {
    const tt = await Timetable.findById(req.params.id);
    if (!tt) return res.status(404).json({ success: false, message: 'Timetable not found.' });
    const others = await Timetable.find({ status: 'published', _id: { $ne: tt._id } });
    const conflicts = detectConflicts(tt, others);
    res.json({ success: true, conflicts });
  } catch (err) {
    return fail(res, err, 'Could not complete the timetable request.');
  }
});

// PUT /api/timetable/:id/publish — Admin: publish after conflict check
router.put('/:id/publish', protect, adminOnly, async (req, res) => {
  try {
    const tt = await Timetable.findById(req.params.id);
    if (!tt) return res.status(404).json({ success: false, message: 'Timetable not found.' });

    const others = await Timetable.find({ status: 'published', _id: { $ne: tt._id } });
    const conflicts = detectConflicts(tt, others);
    if (conflicts.length) {
      return res.status(409).json({ success: false, message: 'Cannot publish — conflicts detected.', conflicts });
    }

    tt.status = 'published';
    tt.publishedAt = new Date();
    await tt.save();
    await logAudit(req, 'timetable.publish', 'Timetable', tt._id, {
      department: tt.department, semester: tt.semester, year: tt.year, section: tt.section,
    });
    res.json({ success: true, timetable: tt });
  } catch (err) {
    return fail(res, err, 'Could not complete the timetable request.');
  }
});

// PUT /api/timetable/:id/archive — Admin: archive (hidden from students, kept as history)
router.put('/:id/archive', protect, adminOnly, async (req, res) => {
  try {
    const tt = await Timetable.findByIdAndUpdate(req.params.id, { status: 'archived' }, { new: true });
    if (!tt) return res.status(404).json({ success: false, message: 'Timetable not found.' });
    await logAudit(req, 'timetable.archive', 'Timetable', tt._id, {});
    res.json({ success: true, timetable: tt });
  } catch (err) {
    return fail(res, err, 'Could not complete the timetable request.');
  }
});

module.exports = router;
