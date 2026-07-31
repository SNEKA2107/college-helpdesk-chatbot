const express = require('express');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User    = require('../models/User');
const { protect } = require('../middleware/auth');

const { fail, badRequest } = require('../utils/apiError');
const { resolveDepartment } = require('../services/departments');
const { validateUpload, IMAGE_TYPES } = require('../utils/upload');
const loginAttempts = require('../utils/loginAttempts');

const router = express.Router();

// Token lifetime. 30 days on a bearer token with no revocation meant a copied
// token was valid for a month; TOKEN_TTL is now short and the tokenVersion claim
// makes revocation possible. Configurable so a demo can widen it deliberately.
const TOKEN_TTL = process.env.TOKEN_TTL || '12h';

/** Issue a token bound to the user's current session generation. */
const genToken = (user) =>
  jwt.sign({ id: user._id, v: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });

/**
 * The subset of a user record a client is given.
 *
 * Login and /me used to serialise the whole Mongoose document. The password was
 * removed by toJSON, but approvedBy, rejectionReason, tokenVersion and every
 * parent contact field went to the browser whether the view needed them or not.
 */
function publicUser(u) {
  return {
    _id: u._id, name: u.name, studentId: u.studentId, email: u.email,
    role: u.role, department: u.department, semester: u.semester,
    year: u.year, section: u.section, phone: u.phone, photo: u.photo,
    designation: u.designation, qualification: u.qualification, experience: u.experience,
    assignedSubjects: u.assignedSubjects, cgpa: u.cgpa, skills: u.skills,
    projects: u.projects, placementOptIn: u.placementOptIn,
    parentName: u.parentName, motherName: u.motherName, parentPhone: u.parentPhone,
    parentEmail: u.parentEmail, parentOccupation: u.parentOccupation, parentAddress: u.parentAddress,
    mustChangePassword: u.mustChangePassword,
    approvalStatus: u.approvalStatus,
    isActive: u.isActive,
  };
}

// One password rule, applied to registration, setup AND change-password. The
// change-password route previously enforced only a length minimum, so an account
// could be moved to a weaker password than registration would have accepted.
// The 72-byte ceiling is bcrypt's input limit: anything beyond it is silently
// ignored by the hash, so a longer password is not the strength it appears.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'admin@123', 'admin123', 'student123',
  'faculty123', 'qwerty123', '12345678', '123456789', 'letmein1', 'welcome1',
  'iloveyou', 'abc12345', 'passw0rd', 'p@ssw0rd', 'campusassist', 'campushelpdesk', 'changeme1',
]);

const passwordRules = (field) => body(field)
  .isString()
  .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  .isByteLength({ max: 72 }).withMessage('Password must be 72 bytes or fewer')
  .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter')
  .matches(/[\d@$!%*?&_\-#]/).withMessage('Password must contain at least one digit or special character')
  .custom(v => {
    if (COMMON_PASSWORDS.has(String(v).toLowerCase())) {
      throw new Error('That password is too common. Please choose a different one.');
    }
    return true;
  });

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
  passwordRules('password'),
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
    const token = genToken(user);
    res.status(201).json({ success: true, message: 'Administrator account created', token, user: publicUser(user) });
  } catch (err) {
    return fail(res, err, 'Could not complete setup.');
  }
});

// POST /api/auth/register
router.post('/register', [
  body('name').isString().notEmpty().trim().withMessage('Name is required'),
  body('studentId').isString().notEmpty().trim().withMessage('Student ID is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  passwordRules('password'),
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
// A real bcrypt hash (of a value nobody knows) compared against when no account
// matches. Without it the function returned before ever reaching bcrypt, so an
// unknown identifier answered in a fraction of the time a wrong password took —
// a timing channel that undid the carefully generic error message below.
const DUMMY_HASH = bcrypt.hashSync('placeholder-for-constant-time-comparison', 12);

async function authenticate(identifier, password, { requireRole } = {}) {
  // Per-ACCOUNT throttling, on top of the per-IP limiter. IP throttling alone
  // does nothing about credential stuffing spread across many source addresses;
  // this counter follows the target account instead of the source host.
  const state = loginAttempts.check(identifier);
  if (state.locked) {
    return {
      ok: false,
      status: 429,
      message: `Too many failed attempts for this account. Try again in ${Math.ceil(state.retryAfterSec / 60)} minute(s).`,
      retryAfterSec: state.retryAfterSec,
    };
  }
  // Progressive delay once a few attempts have failed: negligible for someone
  // who mistyped, costly for an automated run.
  if (state.delayMs) await new Promise(r => setTimeout(r, state.delayMs));

  const user = await findByIdentifier(identifier);

  // One generic message for "no such account" AND "wrong password" — telling
  // them apart would let anyone enumerate valid register numbers.
  const rejected = { ok: false, status: 401, message: 'Invalid credentials. Please check your ID or email and password.' };
  if (!user) {
    await bcrypt.compare(String(password || ''), DUMMY_HASH);  // spend the same time
    loginAttempts.recordFailure(identifier);
    return rejected;
  }
  if (!(await user.matchPassword(password))) {
    loginAttempts.recordFailure(identifier);
    return rejected;
  }
  if (requireRole && user.role !== requireRole) {
    loginAttempts.recordFailure(identifier);
    return rejected;
  }

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
  // Correct credentials clear the counter, so a legitimate user who mistyped a
  // few times is not carrying penalty into their next session.
  loginAttempts.recordSuccess(identifier);
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
    if (!result.ok) {
      // Retry-After lets a well-behaved client back off instead of hammering.
      if (result.retryAfterSec) res.set('Retry-After', String(result.retryAfterSec));
      return res.status(result.status).json({ success: false, message: result.message });
    }

    // The role on the returned user is what the client redirects on.
    const token = genToken(result.user);
    res.json({ success: true, message: 'Login successful', token, user: publicUser(result.user) });
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
    if (!result.ok) {
      if (result.retryAfterSec) res.set('Retry-After', String(result.retryAfterSec));
      return res.status(result.status).json({ success: false, message: result.message });
    }
    const token = genToken(result.user);
    res.json({ success: true, message: 'Login successful', token, user: publicUser(result.user) });
  } catch (err) {
    return fail(res, err, 'Could not complete the request. Please try again.');
  }
});

// GET /api/auth/me (protected)
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: publicUser(req.user) });
});

// PUT /api/auth/change-password (protected)
router.put('/change-password', protect, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  passwordRules('newPassword'),
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
    // The pre-save hook bumps tokenVersion, so every OTHER session is signed out.
    await user.save();

    // Issue a replacement token for the caller, otherwise the client that just
    // changed its own password would be logged out by its own request.
    const token = genToken(user);
    res.json({
      success: true,
      message: 'Password changed successfully. Other devices have been signed out.',
      mustChangePassword: false,
      token,
    });
  } catch (err) {
    return fail(res, err, 'Could not complete the request. Please try again.');
  }
});

// POST /api/auth/logout — end the session server-side.
//
// There was no such endpoint: logout cleared localStorage and nothing else, so a
// token copied beforehand kept working for its full lifetime. Incrementing
// tokenVersion invalidates every token issued to this account.
router.post('/logout', protect, async (req, res) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
    res.json({ success: true, message: 'Signed out.' });
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
//
// semester/year/section are deliberately NOT here. They decide which cohort's
// timetable, exam schedule, assignments and study materials the account can
// read, so a self-service edit was a one-request way into another class's data.
// An admin sets them through PUT /api/students/:id.
const PROFILE_TEXT_FIELDS = [
  'phone',
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
  // A raw length check accepted any content at all — a text/html or SVG data URL
  // stored here is served straight back to whoever views the profile. The shared
  // validator checks the MIME against an image allowlist, confirms the declared
  // type agrees, verifies the magic bytes and caps the DECODED size.
  let photoFields = null;
  if (photo !== undefined && photo !== null && photo !== '') {
    const check = validateUpload(photo, 'photo', undefined, {
      allowed: IMAGE_TYPES, maxBytes: 5 * 1024 * 1024, label: 'Photo',
    });
    if (!check.ok) return res.status(400).json({ success: false, message: check.error });
    photoFields = check.fields;
  }

  try {
    const update = { name: String(name).trim() };
    // Only fields present in the request body are touched — an omitted field keeps
    // whatever is already stored.
    for (const field of PROFILE_TEXT_FIELDS) {
      if (body[field] !== undefined) update[field] = String(body[field] == null ? '' : body[field]).trim();
    }
    // '' clears the photo; a supplied value is the validated data URL.
    if (photo === '' || photo === null) update.photo = '';
    else if (photoFields) update.photo = photoFields.data;

    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true, runValidators: true });
    res.json({ success: true, message: 'Profile updated successfully.', user: publicUser(user) });
  } catch (err) {
    return fail(res, err, 'Could not complete the request. Please try again.');
  }
});

module.exports = router;
