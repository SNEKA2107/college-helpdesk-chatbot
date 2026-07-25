const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const Department = require('../models/Department');
const User = require('../models/User');
const { logAudit } = require('../utils/audit');
const { fail, badRequest, notFound } = require('../utils/apiError');

const router = express.Router();

const clean = s => (typeof s === 'string' ? s.replace(/<[^>]*>/g, '').trim() : s);

/**
 * Best-effort "is this an admin?" for the otherwise-public GET.
 *
 * Deliberately does NOT use the `protect` middleware: that would 401 anonymous
 * callers, and the public registration page must be able to read the list. This
 * only ever upgrades what a caller sees — a missing or bad token simply means
 * "not an admin", never an error. The auth middleware itself is untouched.
 */
async function isAdminRequest(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return false;
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('role');
    return !!user && user.role === 'admin';
  } catch {
    return false;
  }
}

/**
 * GET /api/departments — the list every dropdown reads.
 *
 * Intentionally UNAUTHENTICATED: the public registration page needs it before a
 * token exists. Only non-sensitive fields (code/name) are exposed, and only
 * active departments unless an authenticated admin asks for everything.
 */
router.get('/', async (req, res) => {
  try {
    // ?all=true (disabled departments + full records) is honoured only for an
    // authenticated admin; for everyone else the flag is ignored rather than
    // rejected, so the public registration page keeps working unchanged.
    const wantsAll = req.query.all === 'true' && await isAdminRequest(req);
    const filter = wantsAll ? {} : { isActive: true };
    const departments = await Department.find(filter).sort({ isAcademic: -1, code: 1 })
      .select(wantsAll ? '' : 'code name isAcademic');
    res.json({ success: true, count: departments.length, departments });
  } catch (err) {
    return fail(res, err, 'Could not load departments.');
  }
});

// POST /api/departments — admin: create.
router.post('/', protect, adminOnly, async (req, res) => {
  const code = clean(req.body.code);
  const name = clean(req.body.name);
  if (!code) return badRequest(res, 'Department code is required.');
  if (!name) return badRequest(res, 'Department name is required.');
  if (!/^[A-Za-z0-9 &.-]{1,20}$/.test(code)) {
    return badRequest(res, 'Department code may only contain letters, numbers, spaces, &, . and - (max 20 characters).');
  }
  try {
    // Case-insensitive duplicate check — 'cse' must not create a second 'CSE'.
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dup = await Department.findOne({ code: new RegExp(`^${escaped}$`, 'i') });
    if (dup) return res.status(409).json({ success: false, message: `Department "${dup.code}" already exists.` });

    const department = await Department.create({
      code, name,
      description: clean(req.body.description) || '',
      isAcademic: req.body.isAcademic !== false,
      isActive: req.body.isActive !== false,
    });
    await logAudit(req, 'department.create', 'Department', department._id, { code: department.code, name: department.name });
    res.status(201).json({ success: true, message: 'Department created', department });
  } catch (err) {
    return fail(res, err, 'Could not create the department.');
  }
});

// PUT /api/departments/:id — admin: update name/description/flags.
// The `code` is deliberately immutable: existing user/notice/timetable rows
// reference it as a string, so renaming it would orphan live data.
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) return notFound(res, 'Department');

    if (req.body.name !== undefined) {
      const name = clean(req.body.name);
      if (!name) return badRequest(res, 'Department name cannot be empty.');
      department.name = name;
    }
    if (req.body.description !== undefined) department.description = clean(req.body.description) || '';
    if (req.body.isActive !== undefined) department.isActive = !!req.body.isActive;
    if (req.body.isAcademic !== undefined) department.isAcademic = !!req.body.isAcademic;

    await department.save();
    await logAudit(req, 'department.update', 'Department', department._id, { code: department.code, isActive: department.isActive });
    res.json({ success: true, message: 'Department updated', department });
  } catch (err) {
    return fail(res, err, 'Could not update the department.');
  }
});

// DELETE /api/departments/:id — admin: remove, but only when nothing references it.
// A department in use is disabled instead (isActive:false) so historical records stay readable.
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) return notFound(res, 'Department');

    const inUse = await User.countDocuments({ department: department.code });
    if (inUse > 0) {
      return res.status(409).json({
        success: false,
        message: `${inUse} account(s) still belong to ${department.code}. Disable the department instead of deleting it.`,
      });
    }
    await department.deleteOne();
    await logAudit(req, 'department.delete', 'Department', department._id, { code: department.code });
    res.json({ success: true, message: 'Department deleted' });
  } catch (err) {
    return fail(res, err, 'Could not delete the department.');
  }
});

module.exports = router;
