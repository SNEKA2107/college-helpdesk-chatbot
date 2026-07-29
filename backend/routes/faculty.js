const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const Faculty = require('../models/Faculty');
const User = require('../models/User');
const { logAudit } = require('../utils/audit');
const { fail, badRequest, notFound } = require('../utils/apiError');
const { resolveDepartment } = require('../services/departments');
const { createFacultyUser, setAssignments, generateTempPassword } = require('../services/facultyAccounts');

const router = express.Router();

function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// GET /api/faculty — list/search the directory (any authenticated user).
// Filters: ?q= (name/subject/department) &department= &hod=true
router.get('/', protect, async (req, res) => {
  try {
    const { q, department, hod } = req.query;
    const filter = { isActive: { $ne: false } };
    if (department && department !== 'All') filter.department = department;
    if (hod === 'true') filter.isHOD = true;
    if (q && q.trim()) {
      const rx = new RegExp(escapeRegex(q.trim()), 'i');
      filter.$or = [{ name: rx }, { subjects: rx }, { department: rx }, { designation: rx }, { email: rx }];
    }
    let query = Faculty.find(filter).sort({ isHOD: -1, name: 1 });
    // Only an admin needs the linked-account detail; students just get the directory.
    if (req.user.role === 'admin') query = query.populate('user', 'studentId email assignedSubjects isActive');
    const faculty = await query;
    res.json({ success: true, count: faculty.length, faculty });
  } catch (err) {
    return fail(res, err, 'Could not load the faculty directory.');
  }
});

const clean = (s) => (typeof s === 'string' ? s.replace(/<[^>]*>/g, '') : s);

function normalise(body) {
  const out = { ...body };
  ['name', 'designation', 'officeLocation', 'phone', 'department'].forEach(k => { if (out[k] != null) out[k] = clean(out[k]); });
  if (typeof out.subjects === 'string') out.subjects = out.subjects.split(',').map(s => clean(s.trim())).filter(Boolean);
  // Never let a client set the account link or internal ids directly.
  delete out.user; delete out._id; delete out.assignments;
  return out;
}

/**
 * POST /api/faculty — admin: add a faculty member.
 *
 * Creates BOTH the directory profile AND the User login account, returning a
 * one-time temporary password (audit finding C-2). Subject/class assignments may
 * be supplied inline so the portal is populated on first login (finding C-3).
 */
router.post('/', protect, adminOnly, async (req, res) => {
  const body = normalise(req.body);
  if (!body.name || !String(body.name).trim()) return badRequest(res, 'Faculty name is required.');
  if (!body.email || !String(body.email).trim()) {
    return badRequest(res, 'A faculty email is required — it is their login username.');
  }

  const dept = await resolveDepartment(body.department);
  if (!dept.ok) return badRequest(res, dept.message);
  body.department = dept.code;

  let createdUser = null;
  try {
    // Create the login first: if the email is taken we stop before leaving an
    // orphaned directory row behind.
    const { user, tempPassword } = await createFacultyUser({
      name: String(body.name).trim(),
      email: body.email,
      department: dept.code,
      designation: body.designation,
      phone: body.phone,
      assignments: Array.isArray(req.body.assignments) ? req.body.assignments : [],
    });
    createdUser = user;

    const faculty = await Faculty.create({ ...body, user: user._id });
    await logAudit(req, 'faculty.create', 'Faculty', faculty._id, {
      name: faculty.name, department: faculty.department, staffId: user.studentId,
    });

    res.status(201).json({
      success: true,
      message: 'Faculty added and login account created',
      faculty,
      account: {
        staffId: user.studentId,
        email: user.email,
        // Shown once so the admin can hand it over; never stored in plain text.
        temporaryPassword: tempPassword,
      },
    });
  } catch (err) {
    // Roll back the account if the directory row failed — never a half-created faculty.
    if (createdUser) await User.deleteOne({ _id: createdUser._id }).catch(() => {});
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.clientMessage });
    return fail(res, err, 'Could not create the faculty member.');
  }
});

// PUT /api/faculty/:id — admin: update the directory row, keeping the linked
// User account's shared fields in step.
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const body = normalise(req.body);
    if (body.department !== undefined) {
      const dept = await resolveDepartment(body.department);
      if (!dept.ok) return badRequest(res, dept.message);
      body.department = dept.code;
    }
    const faculty = await Faculty.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
    if (!faculty) return notFound(res, 'Faculty');

    if (faculty.user) {
      const sync = {};
      if (body.name !== undefined) sync.name = faculty.name;
      if (body.department !== undefined) sync.department = faculty.department;
      if (body.designation !== undefined) sync.designation = faculty.designation;
      if (body.phone !== undefined) sync.phone = faculty.phone;
      if (Object.keys(sync).length) await User.updateOne({ _id: faculty.user }, sync);
    }
    await logAudit(req, 'faculty.update', 'Faculty', faculty._id, { name: faculty.name });
    res.json({ success: true, faculty });
  } catch (err) {
    return fail(res, err, 'Could not update the faculty member.');
  }
});

// GET /api/faculty/:id/assignments — admin: what this member currently teaches.
router.get('/:id/assignments', protect, adminOnly, async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id);
    if (!faculty) return notFound(res, 'Faculty');
    if (!faculty.user) return res.json({ success: true, linked: false, assignments: [] });
    const user = await User.findById(faculty.user).select('assignedSubjects studentId email');
    if (!user) return res.json({ success: true, linked: false, assignments: [] });
    res.json({ success: true, linked: true, staffId: user.studentId, assignments: user.assignedSubjects || [] });
  } catch (err) {
    return fail(res, err, 'Could not load assignments.');
  }
});

/**
 * PUT /api/faculty/:id/assignments — admin: assign department / academic year /
 * semester / section / batch / subjects (audit finding C-3). Replaces the set.
 * Body: { assignments: [{ code, name, department, semester, section, year, batch }] }
 */
router.put('/:id/assignments', protect, adminOnly, async (req, res) => {
  const rows = req.body && req.body.assignments;
  if (!Array.isArray(rows)) return badRequest(res, 'assignments must be an array.');

  try {
    const faculty = await Faculty.findById(req.params.id);
    if (!faculty) return notFound(res, 'Faculty');
    if (!faculty.user) {
      return res.status(409).json({
        success: false,
        message: 'This directory entry has no login account, so it cannot be assigned classes.',
      });
    }
    for (const row of rows) {
      if (!row || (!row.name && !row.code)) return badRequest(res, 'Each assignment needs a subject name or code.');
      const dept = await resolveDepartment(row.department || faculty.department);
      if (!dept.ok) return badRequest(res, dept.message);
      row.department = dept.code;
    }

    const user = await setAssignments(faculty.user, rows);
    if (!user) return notFound(res, 'Faculty account');

    // Keep the searchable directory subject list aligned with what they teach.
    faculty.subjects = [...new Set((user.assignedSubjects || []).map(s => s.name).filter(Boolean))];
    await faculty.save();

    await logAudit(req, 'faculty.assignments', 'Faculty', faculty._id, {
      name: faculty.name, count: (user.assignedSubjects || []).length,
    });
    res.json({ success: true, message: 'Assignments updated', assignments: user.assignedSubjects });
  } catch (err) {
    return fail(res, err, 'Could not update assignments.');
  }
});

// POST /api/faculty/:id/reset-password — admin: issue a fresh temporary password.
router.post('/:id/reset-password', protect, adminOnly, async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id);
    if (!faculty) return notFound(res, 'Faculty');
    if (!faculty.user) return res.status(409).json({ success: false, message: 'This faculty member has no login account.' });

    const user = await User.findById(faculty.user);
    if (!user) return notFound(res, 'Faculty account');

    const tempPassword = generateTempPassword();
    user.password = tempPassword;          // hashed by the User model's pre-save hook
    user.mustChangePassword = true;
    await user.save();

    await logAudit(req, 'faculty.password_reset', 'Faculty', faculty._id, { name: faculty.name });
    res.json({
      success: true, message: 'Temporary password issued',
      account: { staffId: user.studentId, email: user.email, temporaryPassword: tempPassword },
    });
  } catch (err) {
    return fail(res, err, 'Could not reset the password.');
  }
});

// DELETE /api/faculty/:id — admin: remove the directory row and deactivate the
// linked login. The User is deactivated rather than deleted so historical
// attendance/marks rows keep a valid author reference.
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id);
    if (!faculty) return notFound(res, 'Faculty');    // audit finding L-1

    if (faculty.user) await User.updateOne({ _id: faculty.user }, { isActive: false });
    await faculty.deleteOne();

    await logAudit(req, 'faculty.delete', 'Faculty', faculty._id, { name: faculty.name });
    res.json({ success: true, message: 'Faculty removed and login deactivated' });
  } catch (err) {
    return fail(res, err, 'Could not remove the faculty member.');
  }
});

module.exports = router;
