const crypto = require('crypto');
const User = require('../models/User');
const Counter = require('../models/Counter');

/**
 * Faculty account provisioning.
 *
 * Audit finding C-2: POST /api/faculty wrote only a `Faculty` directory document
 * (no password field), while faculty login queries the `User` collection — so an
 * admin-created faculty member could never log in. This service creates the
 * matching User account so the admin panel alone is sufficient.
 *
 * Audit finding C-3: nothing wrote User.assignedSubjects, leaving every new
 * faculty member with an empty portal. `setAssignments()` fills that gap.
 */

// Password charset excludes look-alikes (0/O, 1/l/I) — these get read off a screen
// and typed by hand. Always satisfies the User model rule: >=8 chars, a letter and a digit.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';

function generateTempPassword(length = 12) {
  const all = LETTERS + DIGITS;
  const pick = set => set[crypto.randomInt(0, set.length)];
  // Guarantee at least one letter and one digit, then fill and shuffle.
  const chars = [pick(LETTERS), pick(DIGITS)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Next unused faculty staff id, e.g. FAC0007. Atomic via the Counter collection. */
async function nextFacultyId() {
  for (let attempt = 0; attempt < 25; attempt++) {
    const seq = await Counter.next('faculty-staff-id');
    const candidate = `FAC${String(seq).padStart(4, '0')}`;
    if (!(await User.exists({ studentId: candidate }))) return candidate;
    // Collision with a legacy hand-made id (e.g. seeded FAC01) — take the next one.
  }
  throw new Error('Could not allocate a unique faculty ID');
}

/** Normalise an assignment row coming from the admin UI. */
function normaliseAssignment(a = {}) {
  const s = v => (v == null ? '' : String(v).replace(/<[^>]*>/g, '').trim());
  return {
    code: s(a.code), name: s(a.name), department: s(a.department),
    semester: s(a.semester), section: s(a.section),
    // Year/batch are carried on the subject row so a faculty member can be
    // assigned to a specific batch without a schema migration.
    year: s(a.year), batch: s(a.batch),
  };
}

/**
 * Create the User login account for a faculty member.
 * @returns {{user, tempPassword}}
 * @throws  {Error & {statusCode, clientMessage}} on duplicate/validation problems
 */
async function createFacultyUser({ name, email, department, designation, phone, assignments = [] }) {
  const mail = String(email || '').toLowerCase().trim();
  if (!mail) {
    const e = new Error('email required');
    e.statusCode = 400; e.clientMessage = 'A faculty email is required — it is their login username.';
    throw e;
  }

  const existing = await User.findOne({ email: mail });
  if (existing) {
    const e = new Error('duplicate');
    e.statusCode = 409;
    e.clientMessage = existing.role === 'faculty'
      ? `A faculty account already exists for ${mail}.`
      : `${mail} is already registered as a ${existing.role} account.`;
    throw e;
  }

  const tempPassword = generateTempPassword();
  const user = await User.create({
    name,
    studentId: await nextFacultyId(),
    email: mail,
    password: tempPassword,           // hashed by the User model's pre-save hook
    department,
    role: 'faculty',
    semester: '',
    designation: designation || '',
    phone: phone || '',
    approvalStatus: 'approved',       // staff accounts are not part of the student approval queue
    mustChangePassword: true,
    assignedSubjects: (assignments || []).map(normaliseAssignment),
  });

  return { user, tempPassword };
}

/** Replace a faculty member's subject/class assignments (audit finding C-3). */
async function setAssignments(userId, assignments) {
  const rows = (assignments || []).map(normaliseAssignment)
    .filter(a => a.name || a.code); // a row with neither is meaningless
  const user = await User.findOneAndUpdate(
    { _id: userId, role: 'faculty' },
    { assignedSubjects: rows },
    { new: true, runValidators: true },
  ).select('-password');
  return user;
}

module.exports = { generateTempPassword, nextFacultyId, createFacultyUser, setAssignments, normaliseAssignment };
