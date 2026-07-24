const express       = require('express');
const User          = require('../models/User');
const Attendance    = require('../models/Attendance');
const Marks         = require('../models/Marks');
const Leave         = require('../models/Leave');
const Notice        = require('../models/Notice');
const Timetable     = require('../models/Timetable');
const Assignment    = require('../models/Assignment');
const StudyMaterial = require('../models/StudyMaterial');
const { protect, facultyOnly } = require('../middleware/auth');

// Max base64 data-URL size for uploaded files (~7 MB, matching the profile-photo guard).
const MAX_FILE = 7 * 1024 * 1024;

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

// Find the assigned subject matching a name (+ optional section) so we can derive the
// canonical class fields (department/semester/section) for an assignment/material.
function matchSubject(fac, subjectName, section) {
  return (fac.assignedSubjects || []).find(s =>
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

// ── Assignments ─────────────────────────────────────────────────────────────
// Derived status: an assignment is 'closed' if force-closed or past its due date.
function effectiveStatus(a) {
  if (a.status === 'closed') return 'closed';
  return new Date(a.dueDate) < new Date() ? 'closed' : 'open';
}

// GET /assignments — the faculty's own assignments (submissions summarised, not inlined)
router.get('/assignments', async (req, res) => {
  try {
    const docs = await Assignment.find({ createdBy: req.user._id }).sort({ createdAt: -1 }).lean();
    const assignments = docs.map(a => ({
      ...a,
      attachment: undefined,
      submissionCount: (a.submissions || []).length,
      gradedCount: (a.submissions || []).filter(s => s.marks != null).length,
      effectiveStatus: effectiveStatus(a),
    }));
    res.json({ success: true, count: assignments.length, assignments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /assignments — create an assignment for an assigned class/subject
router.post('/assignments', async (req, res) => {
  const { title, description, subject, section, dueDate, maxMarks, attachment, attachmentName, attachmentType } = req.body;
  if (!title || !subject || !dueDate) {
    return res.status(400).json({ success: false, message: 'Title, subject and due date are required.' });
  }
  const sub = matchSubject(req.user, subject, section);
  if (!sub) return res.status(403).json({ success: false, message: 'You are not assigned to this subject/section.' });
  if (attachment && attachment.length > MAX_FILE) return res.status(400).json({ success: false, message: 'Attachment is too large (max 5 MB).' });
  const mm = maxMarks === undefined ? 100 : Number(maxMarks);
  if (!Number.isFinite(mm) || mm < 1 || mm > 1000) return res.status(400).json({ success: false, message: 'Max marks must be 1–1000.' });
  try {
    const assignment = await Assignment.create({
      title: title.trim(),
      description: (description || '').trim(),
      subject: sub.name, subjectCode: sub.code || '',
      department: sub.department, semester: sub.semester || '', section: sub.section || '',
      dueDate: new Date(dueDate), maxMarks: mm,
      attachment: attachment || '', attachmentName: attachmentName || '', attachmentType: attachmentType || '',
      createdBy: req.user._id, facultyName: req.user.name,
    });
    res.status(201).json({ success: true, message: 'Assignment created.', assignment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Load an assignment and assert the current faculty owns it.
async function ownAssignment(req, res) {
  const a = await Assignment.findById(req.params.id);
  if (!a) { res.status(404).json({ success: false, message: 'Assignment not found.' }); return null; }
  if (String(a.createdBy) !== String(req.user._id)) { res.status(403).json({ success: false, message: 'You can only manage your own assignments.' }); return null; }
  return a;
}

// PUT /assignments/:id — edit OWN assignment
router.put('/assignments/:id', async (req, res) => {
  try {
    const a = await ownAssignment(req, res); if (!a) return;
    const { title, description, dueDate, maxMarks, status, attachment, attachmentName, attachmentType } = req.body;
    if (title !== undefined) a.title = title.trim();
    if (description !== undefined) a.description = description.trim();
    if (dueDate !== undefined) a.dueDate = new Date(dueDate);
    if (maxMarks !== undefined) {
      const mm = Number(maxMarks);
      if (!Number.isFinite(mm) || mm < 1 || mm > 1000) return res.status(400).json({ success: false, message: 'Max marks must be 1–1000.' });
      a.maxMarks = mm;
    }
    if (status !== undefined && ['open', 'closed'].includes(status)) a.status = status;
    if (attachment !== undefined) {
      if (attachment && attachment.length > MAX_FILE) return res.status(400).json({ success: false, message: 'Attachment is too large (max 5 MB).' });
      a.attachment = attachment; a.attachmentName = attachmentName || ''; a.attachmentType = attachmentType || '';
    }
    await a.save();
    res.json({ success: true, message: 'Assignment updated.', assignment: a });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /assignments/:id — delete OWN assignment
router.delete('/assignments/:id', async (req, res) => {
  try {
    const a = await ownAssignment(req, res); if (!a) return;
    await a.deleteOne();
    res.json({ success: true, message: 'Assignment deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /assignments/:id/submissions — full submissions for an OWN assignment
router.get('/assignments/:id/submissions', async (req, res) => {
  try {
    const a = await ownAssignment(req, res); if (!a) return;
    res.json({ success: true, assignment: { _id: a._id, title: a.title, subject: a.subject, maxMarks: a.maxMarks, dueDate: a.dueDate }, submissions: a.submissions || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /assignments/:id/submissions/:studentId/file — download one submission's attachment
router.get('/assignments/:id/submissions/:studentId/file', async (req, res) => {
  try {
    const a = await ownAssignment(req, res); if (!a) return;
    const sub = (a.submissions || []).find(s => norm(s.studentId) === norm(req.params.studentId));
    if (!sub || !sub.attachment) return res.status(404).json({ success: false, message: 'No attachment.' });
    res.json({ success: true, attachment: sub.attachment, attachmentName: sub.attachmentName });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /assignments/:id/submissions/:studentId — grade a submission with marks + remarks
router.put('/assignments/:id/submissions/:studentId', async (req, res) => {
  const { marks, grade, remarks } = req.body;
  try {
    const a = await ownAssignment(req, res); if (!a) return;
    const sub = (a.submissions || []).find(s => norm(s.studentId) === norm(req.params.studentId));
    if (!sub) return res.status(404).json({ success: false, message: 'Submission not found.' });
    if (marks !== undefined && marks !== null && marks !== '') {
      const m = Number(marks);
      if (!Number.isFinite(m) || m < 0 || m > a.maxMarks) return res.status(400).json({ success: false, message: `Marks must be 0–${a.maxMarks}.` });
      sub.marks = m;
    }
    if (grade !== undefined) sub.grade = String(grade).trim();
    if (remarks !== undefined) sub.remarks = String(remarks).trim();
    sub.gradedBy = req.user.name;
    sub.gradedAt = new Date();
    await a.save();
    res.json({ success: true, message: 'Submission graded.', submission: sub });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Study Materials ─────────────────────────────────────────────────────────
// GET /materials — the faculty's own uploaded materials (blob omitted)
router.get('/materials', async (req, res) => {
  try {
    const materials = await StudyMaterial.find({ createdBy: req.user._id }).sort({ createdAt: -1 }).select('-attachment');
    res.json({ success: true, count: materials.length, materials });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /materials — upload a study material for an assigned class/subject
router.post('/materials', async (req, res) => {
  const { title, description, subject, section, kind, attachment, attachmentName, attachmentType } = req.body;
  if (!title || !subject) return res.status(400).json({ success: false, message: 'Title and subject are required.' });
  if (!attachment) return res.status(400).json({ success: false, message: 'Please attach a file to upload.' });
  if (attachment.length > MAX_FILE) return res.status(400).json({ success: false, message: 'File is too large (max 5 MB).' });
  const sub = matchSubject(req.user, subject, section);
  if (!sub) return res.status(403).json({ success: false, message: 'You are not assigned to this subject/section.' });
  try {
    const material = await StudyMaterial.create({
      title: title.trim(), description: (description || '').trim(),
      subject: sub.name, subjectCode: sub.code || '',
      department: sub.department, semester: sub.semester || '', section: sub.section || '',
      kind: StudyMaterial.KINDS.includes(kind) ? kind : 'Notes',
      attachment, attachmentName: attachmentName || '', attachmentType: attachmentType || '',
      createdBy: req.user._id, facultyName: req.user.name,
    });
    res.status(201).json({ success: true, message: 'Material uploaded.', material: { ...material.toObject(), attachment: undefined } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /materials/:id — edit OWN material metadata (and optionally replace file)
router.put('/materials/:id', async (req, res) => {
  try {
    const m = await StudyMaterial.findById(req.params.id);
    if (!m) return res.status(404).json({ success: false, message: 'Material not found.' });
    if (String(m.createdBy) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'You can only edit your own materials.' });
    const { title, description, kind, attachment, attachmentName, attachmentType } = req.body;
    if (title !== undefined) m.title = title.trim();
    if (description !== undefined) m.description = description.trim();
    if (kind !== undefined && StudyMaterial.KINDS.includes(kind)) m.kind = kind;
    if (attachment) {
      if (attachment.length > MAX_FILE) return res.status(400).json({ success: false, message: 'File is too large (max 5 MB).' });
      m.attachment = attachment; m.attachmentName = attachmentName || ''; m.attachmentType = attachmentType || '';
    }
    await m.save();
    res.json({ success: true, message: 'Material updated.', material: { ...m.toObject(), attachment: undefined } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /materials/:id — delete OWN material
router.delete('/materials/:id', async (req, res) => {
  try {
    const m = await StudyMaterial.findById(req.params.id);
    if (!m) return res.status(404).json({ success: false, message: 'Material not found.' });
    if (String(m.createdBy) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'You can only delete your own materials.' });
    await m.deleteOne();
    res.json({ success: true, message: 'Material deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /materials/:id/file — download an OWN material's file
router.get('/materials/:id/file', async (req, res) => {
  try {
    const m = await StudyMaterial.findById(req.params.id).select('attachment attachmentName createdBy');
    if (!m || !m.attachment) return res.status(404).json({ success: false, message: 'No file.' });
    if (String(m.createdBy) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Not your material.' });
    res.json({ success: true, attachment: m.attachment, attachmentName: m.attachmentName });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Analytics ───────────────────────────────────────────────────────────────
// GET /analytics — aggregated teaching analytics scoped to the faculty's data
router.get('/analytics', async (req, res) => {
  try {
    const fac = req.user;
    const subjects = fac.assignedSubjects || [];
    const subjectNames = new Set(subjects.map(s => norm(s.name)));
    const classes = assignedClasses(fac);

    const students = await User.find(studentsFilter(fac)).select('_id studentId department semester section');
    const studentIds = students.map(s => s._id);

    // Attendance percentage (overall) across the faculty's assigned subjects.
    const attRecords = await Attendance.find({
      student: { $in: studentIds },
      subject: { $in: subjects.map(s => s.name) },
    }).select('status subject');
    const attTotal = attRecords.length;
    const attPresent = attRecords.filter(r => r.status !== 'Absent').length;
    const attendancePercentage = attTotal ? Math.round((attPresent / attTotal) * 100) : 0;

    // Marks scoped to the faculty's subjects + students.
    const marks = await Marks.find({
      student: { $in: studentIds },
      subject: { $in: subjects.map(s => s.name) },
    }).select('subject semester total grade internalMarks externalMarks studentId');

    // Subject-wise average performance + pass/fail.
    const bySubject = {};
    for (const m of marks) {
      const k = m.subject;
      (bySubject[k] ||= { subject: k, count: 0, sum: 0, pass: 0, fail: 0 });
      bySubject[k].count++;
      bySubject[k].sum += m.total || 0;
      if ((m.total || 0) >= 50) bySubject[k].pass++; else bySubject[k].fail++;
    }
    const subjectWise = Object.values(bySubject).map(s => ({
      subject: s.subject, count: s.count, average: s.count ? Math.round(s.sum / s.count) : 0,
      pass: s.pass, fail: s.fail,
    })).sort((a, b) => b.average - a.average);

    // Marks distribution by grade band.
    const gradeOrder = ['O', 'A+', 'A', 'B+', 'B', 'RA'];
    const distMap = {};
    for (const m of marks) distMap[m.grade] = (distMap[m.grade] || 0) + 1;
    const marksDistribution = gradeOrder.filter(g => distMap[g]).map(g => ({ grade: g, count: distMap[g] }));

    // Overall pass/fail.
    const passCount = marks.filter(m => (m.total || 0) >= 50).length;
    const failCount = marks.length - passCount;

    // Assignment completion per assignment (submissions vs class size).
    const assignments = await Assignment.find({ createdBy: fac._id }).select('title subject department semester section submissions dueDate');
    const classSize = cls => students.filter(s =>
      norm(s.department) === norm(cls.department) &&
      (norm(cls.semester) === '' || norm(s.semester) === norm(cls.semester)) &&
      (norm(cls.section) === '' || norm(s.section) === norm(cls.section))).length;
    const assignmentCompletion = assignments.map(a => {
      const expected = classSize(a) || 0;
      const submitted = (a.submissions || []).length;
      return {
        title: a.title, subject: a.subject,
        submitted, expected,
        pct: expected ? Math.round((submitted / expected) * 100) : 0,
      };
    });

    res.json({
      success: true,
      analytics: {
        attendancePercentage,
        attendanceTotals: { present: attPresent, absent: attTotal - attPresent, total: attTotal },
        subjectWise,
        marksDistribution,
        passFail: { pass: passCount, fail: failCount, total: marks.length },
        assignmentCompletion,
        teachingSummary: {
          subjects: subjects.length,
          classes: classes.length,
          students: students.length,
          assignments: assignments.length,
          materials: await StudyMaterial.countDocuments({ createdBy: fac._id }),
          marksRecords: marks.length,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Notifications ───────────────────────────────────────────────────────────
// GET /notifications — a unified read-only feed aggregated from existing data:
// admin/dept notices, new submissions on the faculty's assignments, pending leave/OD,
// and recent timetable changes for the faculty's classes.
router.get('/notifications', async (req, res) => {
  try {
    const fac = req.user;
    const classes = assignedClasses(fac);
    const depts = [...new Set(classes.map(c => c.department).filter(Boolean))];
    const items = [];

    // Admin & department notices (not the faculty's own).
    const notices = await Notice.find({
      status: 'published',
      createdBy: { $ne: fac._id },
      $or: [{ audience: 'all' }, { audience: { $in: depts } }],
    }).sort({ publishedAt: -1, createdAt: -1 }).limit(15).select('title category publishedAt createdAt postedBy');
    notices.forEach(n => items.push({
      type: 'notice', icon: '📢', title: n.title,
      detail: `${n.category} · by ${n.postedBy || 'Admin'}`,
      date: n.publishedAt || n.createdAt,
    }));

    // Student submission alerts on the faculty's assignments.
    const assignments = await Assignment.find({ createdBy: fac._id }).select('title submissions');
    assignments.forEach(a => (a.submissions || []).forEach(s => items.push({
      type: 'submission', icon: '📥', title: `New submission: ${a.title}`,
      detail: `${s.studentName || s.studentId} submitted`,
      date: s.submittedAt,
    })));

    // Pending leave/OD requests in the faculty's departments.
    const leaves = await Leave.find({ department: { $in: depts }, status: 'Pending' })
      .sort({ createdAt: -1 }).limit(15).select('name studentId leaveType reason createdAt');
    leaves.forEach(l => items.push({
      type: 'leave', icon: '📩', title: `Pending ${l.leaveType || 'Leave'}: ${l.name || l.studentId}`,
      detail: (l.reason || '').slice(0, 60),
      date: l.createdAt,
    }));

    // Recent timetable changes for the faculty's classes.
    if (classes.length) {
      const timetables = await Timetable.find({
        status: 'published',
        $or: classes.map(c => {
          const q = { department: c.department };
          if (c.semester) q.semester = c.semester;
          if (c.section)  q.section  = c.section;
          return q;
        }),
      }).sort({ updatedAt: -1 }).limit(10).select('department semester section updatedAt');
      timetables.forEach(t => items.push({
        type: 'timetable', icon: '📅', title: `Timetable updated: ${t.department} · Sem ${t.semester}${t.section ? ` · ${t.section}` : ''}`,
        detail: 'Published timetable changed',
        date: t.updatedAt,
      }));
    }

    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ success: true, count: items.length, notifications: items.slice(0, 50) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Profile update ──────────────────────────────────────────────────────────
// PUT /profile — the faculty updates their own editable profile fields.
router.put('/profile', async (req, res) => {
  const { name, phone, email, designation, qualification, experience, photo } = req.body;
  if (name !== undefined && !String(name).trim()) return res.status(400).json({ success: false, message: 'Name cannot be empty.' });
  if (photo !== undefined && typeof photo === 'string' && photo.length > MAX_FILE) {
    return res.status(400).json({ success: false, message: 'Photo is too large. Please use an image under 5 MB.' });
  }
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (name !== undefined) user.name = String(name).trim();
    if (phone !== undefined) user.phone = String(phone).trim();
    if (email !== undefined && String(email).trim()) user.email = String(email).trim().toLowerCase();
    if (designation !== undefined) user.designation = String(designation).trim();
    if (qualification !== undefined) user.qualification = String(qualification).trim();
    if (experience !== undefined) user.experience = String(experience).trim();
    if (photo !== undefined) user.photo = photo;
    await user.save();
    const faculty = user.toObject(); delete faculty.password;
    res.json({ success: true, message: 'Profile updated.', faculty });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'That email is already in use.' });
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
