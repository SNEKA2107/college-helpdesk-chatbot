const express    = require('express');
const User       = require('../models/User');
const Attendance = require('../models/Attendance');
const Marks      = require('../models/Marks');
const Leave      = require('../models/Leave');
const Notice     = require('../models/Notice');
const Timetable  = require('../models/Timetable');
const { protect, facultyOnly } = require('../middleware/auth');

const router = express.Router();

// Faculty PORTAL API (mounted at /api/faculty-portal). Distinct from the Faculty
// Directory at /api/faculty. Every route requires a logged-in faculty user and
// scopes all data to that faculty's assigned subjects/classes — a faculty can never
// see or act on another faculty's data, and never touches admin/system entities.
router.use(protect, facultyOnly);

// ── Helpers ────────────────────────────────────────────────────────────────
const norm = v => (v == null ? '' : String(v).trim().toLowerCase());

// Distinct (department, semester, section) classes derived from assigned subjects.
function assignedClasses(fac) {
  const seen = new Set(), out = [];
  for (const s of fac.assignedSubjects || []) {
    const key = `${norm(s.department)}|${norm(s.semester)}|${norm(s.section)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ department: s.department, semester: s.semester, section: s.section });
  }
  return out;
}

// Does this faculty teach the given subject to the given section? (authorization guard)
function teaches(fac, subjectName, section) {
  return (fac.assignedSubjects || []).some(s =>
    norm(s.name) === norm(subjectName) &&
    (norm(section) === '' || norm(s.section) === norm(section)));
}

// Mongo filter selecting all students in the faculty's assigned classes.
function studentsFilter(fac) {
  const classes = assignedClasses(fac);
  if (!classes.length) return { _id: null }; // matches nothing
  return {
    role: 'student',
    $or: classes.map(c => {
      const q = { department: c.department };
      if (c.semester) q.semester = c.semester;
      if (c.section)  q.section  = c.section;
      return q;
    }),
  };
}

// ── Profile ─────────────────────────────────────────────────────────────────
// GET /me — the faculty's own profile (req.user already has it, minus password)
router.get('/me', (req, res) => {
  res.json({ success: true, faculty: req.user });
});

// GET /subjects — assigned subjects + derived classes
router.get('/subjects', (req, res) => {
  res.json({
    success: true,
    subjects: req.user.assignedSubjects || [],
    classes: assignedClasses(req.user),
  });
});

// ── Dashboard ─────────────────────────────────────────────────────────────
// GET /dashboard — aggregated stats for the welcome dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const fac = req.user;
    const subjects = fac.assignedSubjects || [];
    const classes = assignedClasses(fac);
    const depts = [...new Set(classes.map(c => c.department).filter(Boolean))];

    const studentIds = (await User.find(studentsFilter(fac)).select('_id')).map(s => s._id);

    // Pending attendance today: assigned subjects with no attendance marked yet today.
    const startOfToday = Attendance.startOfDayUTC(new Date());
    const markedToday = await Attendance.distinct('subject', { markedBy: fac.name, date: startOfToday });
    const pendingAttendance = subjects.filter(s => !markedToday.includes(s.name)).length;

    // Pending leave/OD from the faculty's departments.
    const pendingLeaves = await Leave.countDocuments({ department: { $in: depts }, status: 'Pending' });

    // Recent notices visible to this faculty (its own + all/department-targeted).
    const recentNotices = await Notice.find({
      status: 'published',
      $or: [{ audience: 'all' }, { audience: { $in: depts } }, { createdBy: fac._id }],
    }).sort({ publishedAt: -1, createdAt: -1 }).limit(5).select('title category publishedAt createdAt');

    res.json({
      success: true,
      dashboard: {
        facultyName: fac.name,
        designation: fac.designation,
        department: fac.department,
        studentCount: studentIds.length,
        assignedSubjectCount: subjects.length,
        assignedClassCount: classes.length,
        pendingAttendance,
        pendingLeaves,
        assignedSubjects: subjects,
        recentNotices,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Students ──────────────────────────────────────────────────────────────
// GET /students — students in the faculty's assigned classes
router.get('/students', async (req, res) => {
  try {
    const students = await User.find(studentsFilter(req.user))
      .select('name studentId department semester section year email phone')
      .sort({ studentId: 1 });
    res.json({ success: true, count: students.length, students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /students/:studentId — one student's profile + attendance & marks history.
// Scoped: the student must belong to one of the faculty's assigned classes.
router.get('/students/:studentId', async (req, res) => {
  try {
    const sid = (req.params.studentId || '').toUpperCase();
    const student = await User.findOne({ studentId: sid, role: 'student' })
      .select('name studentId department semester section year email phone');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const allowed = new Set((await User.find(studentsFilter(req.user)).select('_id')).map(s => String(s._id)));
    if (!allowed.has(String(student._id))) {
      return res.status(403).json({ success: false, message: 'This student is not in your assigned classes.' });
    }

    const attendance = await Attendance.find({ student: student._id }).sort({ date: -1 }).limit(100);
    const marks = await Marks.find({ student: student._id }).sort({ semester: 1, subject: 1 });
    res.json({ success: true, student, attendance, marks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Attendance ─────────────────────────────────────────────────────────────
// GET /attendance?subject=&section=&date= — records for a class
router.get('/attendance', async (req, res) => {
  try {
    const { subject, section, date } = req.query;
    if (subject && !teaches(req.user, subject, section)) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this subject/section.' });
    }
    const studentIds = (await User.find(studentsFilter(req.user)).select('_id')).map(s => s._id);
    const filter = { student: { $in: studentIds } };
    if (subject) filter.subject = subject;
    if (date) filter.date = Attendance.startOfDayUTC(date);
    const records = await Attendance.find(filter).sort({ date: -1 }).limit(500);
    res.json({ success: true, count: records.length, records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /attendance — mark/edit attendance for a class (idempotent bulk upsert)
router.post('/attendance', async (req, res) => {
  const { subject, section, date, records } = req.body;
  if (!subject || !date || !Array.isArray(records)) {
    return res.status(400).json({ success: false, message: 'subject, date and records[] are required.' });
  }
  if (!teaches(req.user, subject, section)) {
    return res.status(403).json({ success: false, message: 'You are not assigned to this subject/section.' });
  }
  try {
    const allowed = new Set((await User.find(studentsFilter(req.user)).select('_id')).map(s => String(s._id)));
    const day = Attendance.startOfDayUTC(date);
    let created = 0, updated = 0, skipped = 0;
    for (const r of records) {
      const student = await User.findOne({ studentId: (r.studentId || '').toUpperCase() });
      if (!student || !allowed.has(String(student._id))) { skipped++; continue; }
      const result = await Attendance.findOneAndUpdate(
        { student: student._id, subject, date: day },
        { $set: { status: r.status || 'Present', markedBy: req.user.name }, $setOnInsert: { studentId: student.studentId } },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true, rawResult: true }
      );
      if (result.lastErrorObject?.updatedExisting) updated++; else created++;
    }
    res.status(201).json({ success: true, message: `${created} marked, ${updated} updated${skipped ? `, ${skipped} skipped` : ''}`, created, updated, skipped });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Marks ─────────────────────────────────────────────────────────────────
// GET /marks?subject=&semester=&section= — marks for a class/subject
router.get('/marks', async (req, res) => {
  try {
    const { subject, semester, section } = req.query;
    if (subject && !teaches(req.user, subject, section)) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this subject/section.' });
    }
    const studentIds = (await User.find(studentsFilter(req.user)).select('_id')).map(s => s._id);
    const filter = { student: { $in: studentIds } };
    if (subject) filter.subject = subject;
    if (semester) filter.semester = String(semester);
    const marks = await Marks.find(filter).sort({ studentId: 1 });
    res.json({ success: true, count: marks.length, marks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /marks — enter/update internal + lab/external marks (unpublished by default)
router.post('/marks', async (req, res) => {
  const { studentId, semester, subject, subjectCode, section, credits, internalMarks, externalMarks } = req.body;
  if (!studentId || !semester || !subject || credits === undefined || internalMarks === undefined || externalMarks === undefined) {
    return res.status(400).json({ success: false, message: 'studentId, semester, subject, credits, internalMarks and externalMarks are required.' });
  }
  if (!teaches(req.user, subject, section)) {
    return res.status(403).json({ success: false, message: 'You are not assigned to this subject/section.' });
  }
  const credNum = Number(credits), intNum = Number(internalMarks), extNum = Number(externalMarks);
  if (!Number.isFinite(credNum) || credNum < 0 || credNum > 12) return res.status(400).json({ success: false, message: 'Credits must be 0–12.' });
  if (!Number.isFinite(intNum) || intNum < 0 || intNum > 40) return res.status(400).json({ success: false, message: 'Internal marks must be 0–40.' });
  if (!Number.isFinite(extNum) || extNum < 0 || extNum > 60) return res.status(400).json({ success: false, message: 'Lab/External marks must be 0–60.' });
  try {
    const student = await User.findOne({ studentId: studentId.toUpperCase(), role: 'student' });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    const allowed = new Set((await User.find(studentsFilter(req.user)).select('_id')).map(s => String(s._id)));
    if (!allowed.has(String(student._id))) return res.status(403).json({ success: false, message: 'This student is not in your assigned classes.' });

    const { total, grade, gradePoint } = Marks.computeGrade(intNum, extNum);
    const record = await Marks.findOneAndUpdate(
      { student: student._id, semester: String(semester), subject: subject.trim() },
      {
        $set: {
          subjectCode: (subjectCode || '').trim(),
          credits: credNum, internalMarks: intNum, externalMarks: extNum,
          total, grade, gradePoint, enteredBy: req.user.name,
        },
        $setOnInsert: { studentId: studentId.toUpperCase(), published: false },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true, rawResult: true }
    );
    const created = !record.lastErrorObject?.updatedExisting;
    res.status(created ? 201 : 200).json({ success: true, message: created ? 'Marks saved (unpublished)' : 'Marks updated', record: record.value });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'Marks already exist for this student/semester/subject.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /marks/publish — publish all marks for a subject (makes them student-visible)
router.post('/marks/publish', async (req, res) => {
  const { subject, semester, section } = req.body;
  if (!subject) return res.status(400).json({ success: false, message: 'subject is required.' });
  if (!teaches(req.user, subject, section)) {
    return res.status(403).json({ success: false, message: 'You are not assigned to this subject/section.' });
  }
  try {
    const studentIds = (await User.find(studentsFilter(req.user)).select('_id')).map(s => s._id);
    const q = { student: { $in: studentIds }, subject };
    if (semester) q.semester = String(semester);
    const result = await Marks.updateMany(q, { $set: { published: true } });
    res.json({ success: true, message: `Published ${result.modifiedCount} record(s) for ${subject}.`, published: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Leave & OD ────────────────────────────────────────────────────────────
// GET /leaves?status= — leave/OD requests from the faculty's departments
router.get('/leaves', async (req, res) => {
  try {
    const depts = [...new Set(assignedClasses(req.user).map(c => c.department).filter(Boolean))];
    const filter = { department: { $in: depts } };
    if (req.query.status) filter.status = req.query.status;
    const leaves = await Leave.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, count: leaves.length, leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /leaves/:id — approve/reject a leave/OD request with remarks
router.put('/leaves/:id', async (req, res) => {
  const { status, remarks } = req.body;
  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'status must be Approved or Rejected.' });
  }
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ success: false, message: 'Request not found.' });
    const depts = [...new Set(assignedClasses(req.user).map(c => c.department).filter(Boolean))];
    if (!depts.includes(leave.department)) {
      return res.status(403).json({ success: false, message: 'This request is not for your department.' });
    }
    leave.status = status;
    leave.approvedBy = req.user.name;
    if (remarks !== undefined) leave.remarks = remarks;
    await leave.save();
    res.json({ success: true, message: `Request ${status.toLowerCase()}.`, leave });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Notices ───────────────────────────────────────────────────────────────
// GET /notices — the faculty's own notices (blob omitted)
router.get('/notices', async (req, res) => {
  try {
    const notices = await Notice.find({ createdBy: req.user._id })
      .sort({ createdAt: -1 })
      .select('-attachment');
    res.json({ success: true, count: notices.length, notices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /notices — create a notice (optionally with a PDF/assignment attachment)
router.post('/notices', async (req, res) => {
  const { title, content, category, audience, attachment, attachmentName, attachmentType } = req.body;
  if (!title || !content) return res.status(400).json({ success: false, message: 'Title and content are required.' });
  try {
    const notice = await Notice.create({
      title: title.trim(),
      content: content.trim(),
      category: category || 'general',
      audience: audience || 'all',
      status: 'published',
      publishedAt: new Date(),
      postedBy: req.user.name,
      createdBy: req.user._id,
      attachment: attachment || '',
      attachmentName: attachmentName || '',
      attachmentType: attachmentType || '',
    });
    res.status(201).json({ success: true, message: 'Notice posted.', notice });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /notices/:id — edit OWN notice only
router.put('/notices/:id', async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) return res.status(404).json({ success: false, message: 'Notice not found.' });
    if (String(notice.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only edit your own notices.' });
    }
    const { title, content, category, audience, attachment, attachmentName, attachmentType } = req.body;
    if (title !== undefined) notice.title = title.trim();
    if (content !== undefined) notice.content = content.trim();
    if (category !== undefined) notice.category = category;
    if (audience !== undefined) notice.audience = audience;
    if (attachment !== undefined) { notice.attachment = attachment; notice.attachmentName = attachmentName || ''; notice.attachmentType = attachmentType || ''; }
    await notice.save();
    res.json({ success: true, message: 'Notice updated.', notice });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /notices/:id — delete OWN notice only
router.delete('/notices/:id', async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) return res.status(404).json({ success: false, message: 'Notice not found.' });
    if (String(notice.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'You can only delete your own notices.' });
    }
    await notice.deleteOne();
    res.json({ success: true, message: 'Notice deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /notices/:id/attachment — download an own notice's attachment
router.get('/notices/:id/attachment', async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id).select('attachment attachmentName createdBy');
    if (!notice || !notice.attachment) return res.status(404).json({ success: false, message: 'No attachment.' });
    if (String(notice.createdBy) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Not your notice.' });
    res.json({ success: true, attachment: notice.attachment, attachmentName: notice.attachmentName });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Timetable ─────────────────────────────────────────────────────────────
// GET /timetable — published timetables for the faculty's assigned classes
router.get('/timetable', async (req, res) => {
  try {
    const classes = assignedClasses(req.user);
    if (!classes.length) return res.json({ success: true, timetables: [] });
    const timetables = await Timetable.find({
      status: 'published',
      $or: classes.map(c => {
        const q = { department: c.department };
        if (c.semester) q.semester = c.semester;
        if (c.section)  q.section  = c.section;
        return q;
      }),
    }).sort({ department: 1, semester: 1 });
    res.json({ success: true, timetables });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
