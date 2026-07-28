const express = require('express');
const jwt     = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User    = require('../models/User');
const { protect } = require('../middleware/auth');

const { fail, badRequest } = require('../utils/apiError');
const { resolveDepartment } = require('../services/departments');

const router = express.Router();

const genToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// ── First-run bootstrap (audit finding C-1) ─────────────────────────────────
// A brand-new deployment has no admin and therefore no way in. These two routes
// close that gap WITHOUT weakening anything: both are hard-gated on there being
// zero admin accounts, so the moment the first admin exists they are inert.

/** True only while the system has no admin at all. */
async function setupRequired() {
  return (await User.countDocuments({ role: 'admin' })) === 0;
}

// GET /api/auth/setup-status — public. Lets the UI decide whether to show setup.
router.get('/setup-status', async (req, res) => {
  try {
    res.json({ success: true, needsSetup: await setupRequired() });
  } catch (err) {
    return fail(res, err, 'Could not determine setup status.');
  }
});

// POST /api/auth/setup — create the very first admin. Permanently disabled
// (410 Gone) as soon as any admin exists, so it can never be used to escalate.
router.post('/setup', [
  body('name').isString().trim().notEmpty().withMessage('Name is required'),
  body('studentId').isString().trim().notEmpty().withMessage('An admin username/ID is required'),
  body('email').isEmail().normalizeEmail().withMessage('A valid email is required'),
  body('password').isString()
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter')
    .matches(/[\d@$!%*?&_\-#]/).withMessage('Password must contain at least one digit or special character'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg });

  try {
    // Re-checked inside the request so a race cannot create two "first" admins.
    if (!(await setupRequired())) {
      return res.status(410).json({
        success: false,
        message: 'Setup has already been completed. Ask an existing administrator to create further accounts.',
      });
    }

    const { name, studentId, email, password } = req.body;
    const clash = await User.findOne({ $or: [{ email }, { studentId: studentId.toUpperCase() }] });
    if (clash) return res.status(409).json({ success: false, message: 'That username or email is already registered.' });

    // 'Admin' always exists after bootstrapDepartments(); fall back defensively.
    const dept = await resolveDepartment('Admin', { allowInactive: true });

    const user = await User.create({
      name, studentId, email, password,
      department: dept.ok ? dept.code : 'Admin',
      role: 'admin',
      semester: '',
      approvalStatus: 'approved',
    });

    console.log(`✅ First admin created via setup: ${user.studentId}`);
    const token = genToken(user._id);
    res.status(201).json({ success: true, message: 'Administrator account created', token, user });
  } catch (err) {
    return fail(res, err, 'Could not complete setup.');
  }
});

// POST /api/auth/register
router.post('/register', [
  body('name').isString().notEmpty().trim().withMessage('Name is required'),
  body('studentId').isString().notEmpty().trim().withMessage('Student ID is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isString()
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter')
    .matches(/[\d@$!%*?&_\-#]/).withMessage('Password must contain at least one digit or special character'),
  body('department').isString().notEmpty().withMessage('Department is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
  }

  const { name, studentId, email, password, department, semester, year, section } = req.body;

  try {
    // Departments are data, not a hardcoded enum (audit finding H-1). An unknown
    // department is a 400 with the valid options — not a 500 leaking Mongoose text.
    const dept = await resolveDepartment(department);
    if (!dept.ok) return badRequest(res, dept.message);

    const existingUser = await User.findOne({ $or: [{ email }, { studentId: studentId.toUpperCase() }] });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'An account with this email or Student ID already exists.' });
    }

    // H4: new students await admin approval — no token issued, no auto-login.
    // `role` is deliberately NOT read from the body: self-registration can only
    // ever create a student, which is what blocks privilege escalation here.
    const user = await User.create({
      name, studentId, email, password,
      department: dept.code,
      semester, year, section,
      role: 'student',
      approvalStatus: 'pending',
    });

    res.status(201).json({
      success: true,
      pending: true,
      message: 'Registration submitted. Your account is pending admin approval — you will be able to log in once approved.',
      user: { name: user.name, studentId: user.studentId, approvalStatus: user.approvalStatus },
    });
  } catch (err) {
    return fail(res, err, 'Could not complete registration.');
  }
});

// ── Unified credential authentication ───────────────────────────────────────
// One code path for every role. The client sends a credential and a password and
// NEVER a role — the role is read off the stored user, which is what stops a
// caller choosing their own privileges. Both login routes below delegate here so
// the account-state rules exist in exactly one place.

/**
 * Resolve a submitted credential to a user account.
 *
 * Accepts a student register number, a faculty staff ID, an admin ID, or an
 * email — all case-insensitively. `studentId` is stored uppercase and `email`
 * lowercase by the schema, so each branch normalises to match.
 */
async function findByIdentifier(identifier) {
  const raw = String(identifier == null ? '' : identifier).trim();
  if (!raw) return null;

  // An '@' means it can only be an email; otherwise treat it as an ID and fall
  // back to email so an unusual identifier still resolves rather than 401-ing.
  if (raw.includes('@')) return User.findOne({ email: raw.toLowerCase() });
  return (await User.findOne({ studentId: raw.toUpperCase() }))
      || (await User.findOne({ email: raw.toLowerCase() }));
}

/**
 * Verify a credential and the account's state.
 * @returns {{ok: true, user}} | {{ok: false, status: number, message: string}}
 */
async function authenticate(identifier, password, { requireRole } = {}) {
  const user = await findByIdentifier(identifier);

  // One generic message for "no such account" AND "wrong password" — telling
  // them apart would let anyone enumerate valid register numbers.
  const rejected = { ok: false, status: 401, message: 'Invalid credentials. Please check your ID or email and password.' };
  if (!user || !(await user.matchPassword(password))) return rejected;
  if (requireRole && user.role !== requireRole) return rejected;

  if (!user.isActive) {
    return { ok: false, status: 403, message: 'Account is deactivated. Contact the admin.' };
  }
  // H4: block login until a student's registration is approved. Staff accounts
  // are created already approved, so this never fires for them.
  if (user.approvalStatus === 'pending') {
    return { ok: false, status: 403, message: 'Your registration is pending admin approval. Please try again once it is approved.' };
  }
  if (user.approvalStatus === 'rejected') {
    const reason = user.rejectionReason ? ` Reason: ${user.rejectionReason}.` : '';
    return { ok: false, status: 403, message: `Your registration was not approved.${reason} Please contact the college office.` };
  }
  return { ok: true, user };
}

/**
 * POST /api/auth/login — the single login for students, faculty and admins.
 *
 * Body: { identifier | studentId | email, password }
 * `studentId` and `email` are accepted as aliases so every existing client
 * (and the /auth/faculty-login callers below) keeps working unchanged.
 */
router.post('/login', [
  body('password').isString().notEmpty().withMessage('Password is required'),
  body().custom(b => {
    if (!b || !(b.identifier || b.studentId || b.email)) {
      throw new Error('Enter your register number, staff ID, admin ID or email');
    }
    return true;
  }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
  }

  const { identifier, studentId, email, password } = req.body;
  try {
    const result = await authenticate(identifier || studentId || email, password);
    if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });

    // The role on the returned user is what the client redirects on.
    const token = genToken(result.user._id);
    res.json({ success: true, message: 'Login successful', token, user: result.user });
  } catch (err) {
    return fail(res, err, 'Could not complete the request. Please try again.');
  }
});

// POST /api/auth/faculty-login — retained for backward compatibility with the
// earlier email-only faculty endpoint. It is now a thin wrapper over the same
// authenticate() above, scoped to the faculty role; no logic is duplicated.
router.post('/faculty-login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isString().notEmpty().withMessage('Password is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const result = await authenticate(req.body.email, req.body.password, { requireRole: 'faculty' });
    if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });
    const token = genToken(result.user._id);
    res.json({ success: true, message: 'Login successful', token, user: result.user });
  } catch (err) {
    return fail(res, err, 'Could not complete the request. Please try again.');
  }
});

// GET /api/auth/me (protected)
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// PUT /api/auth/change-password (protected)
router.put('/change-password', protect, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { currentPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (!(await user.matchPassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    // The account is no longer on a system-issued temporary password, so stop
    // prompting for a change (audit finding C-2 — the flag was written when an
    // admin provisioned a faculty login but nothing ever cleared it).
    user.mustChangePassword = false;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully.', mustChangePassword: false });
  } catch (err) {
    return fail(res, err, 'Could not complete the request. Please try again.');
  }
});

// PUT /api/auth/profile — update own profile.
//
// PATCH semantics: a field is written ONLY when the client actually sends it.
// This route used to build the update object unconditionally, so any partial save
// blanked every field the caller had omitted — uploading a profile photo (which
// sends just { name, photo }) silently erased the student's semester and all of
// their parent details, and losing `semester` dropped them out of their cohort
// (faculty roster, timetable, exam schedule and coursework all key off it).
// `year`/`section` were already guarded this way; the rest now match.
const PROFILE_TEXT_FIELDS = [
  'phone', 'semester', 'year', 'section',
  'parentName', 'motherName', 'parentPhone', 'parentEmail', 'parentOccupation', 'parentAddress',
];

router.put('/profile', protect, async (req, res) => {
  const body = req.body || {};
  const { name, photo } = body;

  // `name` remains required: every existing client sends it, and an empty display
  // name is never a valid state.
  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, message: 'Name is required.' });
  }
  if (photo !== undefined && typeof photo === 'string' && photo.length > 7 * 1024 * 1024) {
    return res.status(400).json({ success: false, message: 'Photo is too large. Please use an image under 5 MB.' });
  }

  try {
    const update = { name: String(name).trim() };
    // Only fields present in the request body are touched — an omitted field keeps
    // whatever is already stored.
    for (const field of PROFILE_TEXT_FIELDS) {
      if (body[field] !== undefined) update[field] = String(body[field] == null ? '' : body[field]).trim();
    }
    if (photo !== undefined) update.photo = photo;

    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true, runValidators: true });
    res.json({ success: true, message: 'Profile updated successfully.', user });
  } catch (err) {
    return fail(res, err, 'Could not complete the request. Please try again.');
  }
});

module.exports = router;
