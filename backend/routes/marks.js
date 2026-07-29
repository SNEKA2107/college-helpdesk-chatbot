const express = require('express');
const Marks   = require('../models/Marks');
const User    = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');
const { fail } = require('../utils/apiError');

const router = express.Router();

// Group marks records into per-semester SGPA + overall CGPA (credit-weighted).
function computeCgpa(records) {
  const bySem = {};
  let totalCredits = 0, totalPoints = 0;
  for (const r of records) {
    if (!bySem[r.semester]) bySem[r.semester] = { credits: 0, points: 0, subjects: [] };
    bySem[r.semester].credits += r.credits;
    bySem[r.semester].points  += r.credits * r.gradePoint;
    bySem[r.semester].subjects.push(r);
    totalCredits += r.credits;
    totalPoints  += r.credits * r.gradePoint;
  }
  const semesters = Object.entries(bySem)
    .map(([semester, s]) => ({
      semester,
      credits: s.credits,
      sgpa: s.credits ? +(s.points / s.credits).toFixed(2) : 0,
      subjects: s.subjects,
    }))
    .sort((a, b) => String(a.semester).localeCompare(String(b.semester), undefined, { numeric: true }));
  const cgpa = totalCredits ? +(totalPoints / totalCredits).toFixed(2) : 0;
  return { cgpa, totalCredits, semesters };
}

// Resolve which student's marks to read: admin may pass ?studentId=, a student only sees their own.
function targetStudentId(req) {
  return (req.user.role === 'admin' && req.query.studentId)
    ? req.query.studentId.toUpperCase()
    : req.user.studentId;
}

// Students only ever see published marks. Admin/faculty views see everything.
// Legacy rows have no `published` field, so `$ne: false` keeps them visible.
function marksFilter(req, sid) {
  const filter = { studentId: sid };
  if (req.user.role === 'student') filter.published = { $ne: false };
  return filter;
}

// GET /api/marks — marks for the current student (or ?studentId= for admin)
router.get('/', protect, async (req, res) => {
  try {
    const sid = targetStudentId(req);
    const marks = await Marks.find(marksFilter(req, sid)).sort({ semester: 1, subject: 1 });
    res.json({ success: true, count: marks.length, marks });
  } catch (err) {
    return fail(res, err, 'Could not complete the marks request.');
  }
});

// GET /api/marks/cgpa — server-computed SGPA per semester + overall CGPA
router.get('/cgpa', protect, async (req, res) => {
  try {
    const sid = targetStudentId(req);
    const marks = await Marks.find(marksFilter(req, sid)).sort({ semester: 1, subject: 1 });
    res.json({ success: true, ...computeCgpa(marks) });
  } catch (err) {
    return fail(res, err, 'Could not complete the marks request.');
  }
});

// POST /api/marks — admin: enter or update a subject's marks (idempotent upsert)
router.post('/', protect, adminOnly, async (req, res) => {
  const { studentId, semester, subject, subjectCode, credits, internalMarks, externalMarks } = req.body;
  if (!studentId || !semester || !subject || credits === undefined || internalMarks === undefined || externalMarks === undefined) {
    return res.status(400).json({ success: false, message: 'studentId, semester, subject, credits, internalMarks and externalMarks are required.' });
  }
  const credNum = Number(credits), intNum = Number(internalMarks), extNum = Number(externalMarks);
  if (!Number.isFinite(credNum) || credNum < 0 || credNum > 12) {
    return res.status(400).json({ success: false, message: 'Credits must be between 0 and 12.' });
  }
  if (!Number.isFinite(intNum) || intNum < 0 || intNum > 40) {
    return res.status(400).json({ success: false, message: 'Internal marks must be between 0 and 40.' });
  }
  if (!Number.isFinite(extNum) || extNum < 0 || extNum > 60) {
    return res.status(400).json({ success: false, message: 'External marks must be between 0 and 60.' });
  }
  try {
    const student = await User.findOne({ studentId: studentId.toUpperCase() });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const { total, grade, gradePoint } = Marks.computeGrade(intNum, extNum);
    const record = await Marks.findOneAndUpdate(
      { student: student._id, semester: String(semester), subject: subject.trim() },
      {
        $set: {
          subjectCode: (subjectCode || '').trim(),
          credits: credNum, internalMarks: intNum, externalMarks: extNum,
          total, grade, gradePoint, enteredBy: req.user.name,
        },
        $setOnInsert: { studentId: studentId.toUpperCase() },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true, includeResultMetadata: true }
    );
    const created = !record.lastErrorObject?.updatedExisting;
    res.status(created ? 201 : 200).json({
      success: true,
      message: created ? 'Marks added' : 'Marks updated',
      record: record.value,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Marks already exist for this student, semester, and subject.' });
    }
    return fail(res, err, 'Could not complete the marks request.');
  }
});

// DELETE /api/marks/:id — admin: remove a marks record
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const deleted = await Marks.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Marks record not found.' });
    res.json({ success: true, message: 'Marks record deleted.' });
  } catch (err) {
    return fail(res, err, 'Could not complete the marks request.');
  }
});

module.exports = router;
