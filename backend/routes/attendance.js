const express    = require('express');
const Attendance = require('../models/Attendance');
const User       = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');
const { fail } = require('../utils/apiError');
const { coerceQuery } = require('../utils/sanitize');

const router = express.Router();

// GET /api/attendance/summary — subject-wise % for student (or by studentId for admin)
router.get('/summary', protect, async (req, res) => {
  try {
    // coerceQuery first: a repeated ?studentId=A&studentId=B arrives as an ARRAY,
    // and calling .toUpperCase() on it threw a TypeError that surfaced as a 500.
    const q = coerceQuery(req.query.studentId);
    const sid = (req.user.role === 'admin' && q) ? q.toUpperCase() : req.user.studentId;

    const records = await Attendance.find({ studentId: sid });
    const map = {};
    records.forEach(r => {
      if (!map[r.subject]) map[r.subject] = { present: 0, absent: 0, late: 0, total: 0 };
      map[r.subject].total++;
      if (r.status === 'Present') map[r.subject].present++;
      else if (r.status === 'Absent') map[r.subject].absent++;
      else map[r.subject].late++;
    });

    const summary = Object.entries(map).map(([subject, s]) => ({
      subject,
      total:      s.total,
      present:    s.present,
      absent:     s.absent,
      late:       s.late,
      percentage: s.total > 0 ? Math.round(((s.present + s.late) / s.total) * 100) : 0,
    }));

    const totalClasses = records.length;
    const totalPresent = records.filter(r => r.status !== 'Absent').length;
    const overall = totalClasses > 0 ? Math.round((totalPresent / totalClasses) * 100) : 0;

    res.json({ success: true, summary, overall, totalClasses, totalPresent });
  } catch (err) {
    return fail(res, err, 'Could not complete the attendance request.');
  }
});

// GET /api/attendance — records for current student (or all/filtered for admin)
router.get('/', protect, async (req, res) => {
  try {
    const q = coerceQuery(req.query.studentId);
    const filter = req.user.role === 'admin'
      ? (q ? { studentId: q.toUpperCase() } : {})
      : { student: req.user._id };
    const records = await Attendance.find(filter).sort({ date: -1 }).limit(100);
    res.json({ success: true, count: records.length, records });
  } catch (err) {
    return fail(res, err, 'Could not complete the attendance request.');
  }
});

// POST /api/attendance — mark single attendance (admin)
router.post('/', protect, adminOnly, async (req, res) => {
  const { studentId, subject, date, status } = req.body;
  if (!studentId || !subject || !date) {
    return res.status(400).json({ success: false, message: 'studentId, subject, and date are required.' });
  }
  try {
    const student = await User.findOne({ studentId: studentId.toUpperCase() });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // CRIT-04: idempotent mark — one record per student+subject+day. Re-marking the
    // same slot updates the status instead of creating a duplicate.
    //
    // NOTE: the option below must stay `includeResultMetadata`. Mongoose 8 dropped
    // the older `rawResult` and IGNORES it silently, which left `result.value`
    // undefined and `updatedExisting` unreadable — so every re-mark reported
    // "created" and returned no record.
    const day = Attendance.startOfDayUTC(date);
    const result = await Attendance.findOneAndUpdate(
      { student: student._id, subject, date: day },
      {
        $set: { status: status || 'Present', markedBy: req.user.name },
        $setOnInsert: { studentId: studentId.toUpperCase() },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true, includeResultMetadata: true }
    );
    const created = !result.lastErrorObject?.updatedExisting;
    res.status(created ? 201 : 200).json({
      success: true,
      message: created ? 'Attendance marked' : 'Attendance updated for this day',
      record: result.value,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Attendance already recorded for this student, subject, and date.' });
    }
    return fail(res, err, 'Could not complete the attendance request.');
  }
});

// POST /api/attendance/bulk — mark attendance for many students at once (admin)
router.post('/bulk', protect, adminOnly, async (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ success: false, message: 'records array is required.' });
  }
  try {
    // CRIT-04: idempotent bulk marking — upsert per student+subject+day so re-running
    // a class roster never produces duplicates. Reports created/updated/skipped counts.
    let createdCount = 0, updatedCount = 0, skipped = 0;
    for (const r of records) {
      if (!r.studentId || !r.subject || !r.date) { skipped++; continue; }
      const student = await User.findOne({ studentId: r.studentId.toUpperCase() });
      if (!student) { skipped++; continue; }
      const day = Attendance.startOfDayUTC(r.date);
      const result = await Attendance.findOneAndUpdate(
        { student: student._id, subject: r.subject, date: day },
        {
          $set: { status: r.status || 'Present', markedBy: req.user.name },
          $setOnInsert: { studentId: r.studentId.toUpperCase() },
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true, includeResultMetadata: true }
      );
      if (result.lastErrorObject?.updatedExisting) updatedCount++; else createdCount++;
    }
    res.status(201).json({
      success: true,
      message: `${createdCount} created, ${updatedCount} updated${skipped ? `, ${skipped} skipped` : ''}`,
      created: createdCount,
      updated: updatedCount,
      skipped,
    });
  } catch (err) {
    return fail(res, err, 'Could not complete the attendance request.');
  }
});

module.exports = router;
