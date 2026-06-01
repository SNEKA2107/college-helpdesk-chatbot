const express    = require('express');
const Attendance = require('../models/Attendance');
const User       = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/attendance/summary — subject-wise % for student (or by studentId for admin)
router.get('/summary', protect, async (req, res) => {
  try {
    const sid = (req.user.role === 'admin' && req.query.studentId)
      ? req.query.studentId.toUpperCase()
      : req.user.studentId;

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
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/attendance — records for current student (or all/filtered for admin)
router.get('/', protect, async (req, res) => {
  try {
    const filter = req.user.role === 'admin'
      ? (req.query.studentId ? { studentId: req.query.studentId.toUpperCase() } : {})
      : { student: req.user._id };
    const records = await Attendance.find(filter).sort({ date: -1 }).limit(100);
    res.json({ success: true, count: records.length, records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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

    const record = await Attendance.create({
      student:  student._id,
      studentId: studentId.toUpperCase(),
      subject,
      date:     new Date(date),
      status:   status || 'Present',
      markedBy: req.user.name,
    });
    res.status(201).json({ success: true, message: 'Attendance marked', record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/attendance/bulk — mark attendance for many students at once (admin)
router.post('/bulk', protect, adminOnly, async (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ success: false, message: 'records array is required.' });
  }
  try {
    const created = [];
    for (const r of records) {
      const student = await User.findOne({ studentId: r.studentId.toUpperCase() });
      if (!student) continue;
      created.push(await Attendance.create({
        student:   student._id,
        studentId: r.studentId.toUpperCase(),
        subject:   r.subject,
        date:      new Date(r.date),
        status:    r.status || 'Present',
        markedBy:  req.user.name,
      }));
    }
    res.status(201).json({ success: true, message: `${created.length} records created`, created });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
