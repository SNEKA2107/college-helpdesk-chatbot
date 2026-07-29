const Fee = require('../models/Fee');

/**
 * Default records every approved student needs.
 *
 * Audit finding M-1: GET /api/fees returned 404 for a newly approved student
 * because only seed.js ever created a Fee document — so the Fees page was dead
 * for every real user. Approval now provisions the record.
 *
 * The amounts below are a starting template, overridable per deployment via env
 * so no code change is needed to set a college's own fee structure.
 */

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Fee components, from env when configured, else a sensible default template. */
function defaultComponents() {
  // FEE_COMPONENTS='Tuition Fee:45000,Lab Fee:7500,Library Fee:2000'
  const raw = (process.env.FEE_COMPONENTS || '').trim();
  if (raw) {
    const parsed = raw.split(',').map(part => {
      const [name, amount] = part.split(':');
      return { name: (name || '').trim(), amount: num(amount, 0) };
    }).filter(c => c.name);
    if (parsed.length) return parsed;
  }
  return [
    { name: 'Tuition Fee',     amount: num(process.env.FEE_TUITION, 45000) },
    { name: 'Laboratory Fee',  amount: num(process.env.FEE_LAB, 7500) },
    { name: 'Library Fee',     amount: num(process.env.FEE_LIBRARY, 2000) },
    { name: 'Examination Fee', amount: num(process.env.FEE_EXAM, 3500) },
  ];
}

/** Academic year label, e.g. "2026-2027" — rolls over in June. */
function currentAcademicYear() {
  if (process.env.ACADEMIC_YEAR) return process.env.ACADEMIC_YEAR;
  const now = new Date();
  const start = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

/** Due date = today + FEE_DUE_DAYS (default 45), as YYYY-MM-DD. */
function defaultDueDate() {
  const days = num(process.env.FEE_DUE_DAYS, 45);
  const d = new Date(Date.now() + days * 86400000);
  return d.toISOString().slice(0, 10);
}

/**
 * Ensure a student has a fee record for their current semester.
 * Idempotent — re-approving or re-running never duplicates or overwrites payments.
 * @returns {Promise<{created: boolean, fee?: object}>}
 */
async function ensureFeeRecord(student) {
  const semester = student.semester || '1st';
  const existing = await Fee.findOne({ student: student._id, semester });
  if (existing) return { created: false, fee: existing };

  const components = defaultComponents();
  const total = components.reduce((sum, c) => sum + c.amount, 0);

  const fee = await Fee.create({
    student:      student._id,
    studentId:    student.studentId,
    semester,
    academicYear: currentAcademicYear(),
    components,
    total,
    dueDate:      defaultDueDate(),
    lateFine:     num(process.env.FEE_LATE_FINE, 0),
    history:      [],
  });
  return { created: true, fee };
}

/**
 * Provision everything a newly approved student needs so their portal works
 * immediately. Best-effort: a failure here must never block the approval itself,
 * so errors are logged and reported rather than thrown.
 */
async function initialiseStudent(student) {
  const result = { fee: false, errors: [] };
  try {
    const { created } = await ensureFeeRecord(student);
    result.fee = created;
  } catch (err) {
    console.error('[studentInit] fee record failed for', student.studentId, err.message);
    result.errors.push('fee record');
  }
  // The academic profile (department/semester/year/section, CGPA, skills) lives on
  // the User document itself and is populated at registration, so nothing further
  // needs creating here. Attendance/marks/assignments are intentionally empty
  // until a faculty member records them.
  return result;
}

module.exports = { initialiseStudent, ensureFeeRecord, currentAcademicYear, defaultComponents };
