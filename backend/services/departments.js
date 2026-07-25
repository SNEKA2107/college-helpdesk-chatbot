const Department = require('../models/Department');

/**
 * Department bootstrap + validation helpers.
 *
 * Backward compatibility is the whole point of `bootstrapDepartments()`: an
 * existing deployment already has users/notices/timetables carrying department
 * codes that used to live in a hardcoded enum. On first boot after this change
 * we materialise those codes (plus the legacy union) into the Department
 * collection, so nothing that worked before stops working.
 */

// The union of every list that used to be hardcoded across the codebase.
// Used ONLY to seed an empty collection on first boot — never consulted at runtime.
const LEGACY_CODES = [
  ['IT', 'Information Technology'],
  ['CSE', 'Computer Science and Engineering'],
  ['AIML', 'Artificial Intelligence and Machine Learning'],
  ['AIDS', 'Artificial Intelligence and Data Science'],
  ['Bioinformatics', 'Bioinformatics'],
  ['ECE', 'Electronics and Communication Engineering'],
  ['EEE', 'Electrical and Electronics Engineering'],
  ['MECH', 'Mechanical Engineering'],
  ['CIVIL', 'Civil Engineering'],
  ['General', 'General'],
];

/**
 * Ensure the Department collection is populated.
 *
 * - Fresh install  → seeds the legacy union so the app is usable immediately.
 * - Existing install → additionally adopts any department code already present
 *   on User documents, so live data never becomes unselectable.
 *
 * Idempotent: safe to run on every boot.
 */
async function bootstrapDepartments() {
  const existing = await Department.countDocuments();
  if (existing > 0) return { created: 0, skipped: true };

  const User = require('../models/User');
  const inUse = await User.distinct('department');

  const map = new Map();
  for (const [code, name] of LEGACY_CODES) map.set(code.toUpperCase(), { code, name });
  for (const code of inUse) {
    if (!code) continue;
    const key = String(code).toUpperCase();
    if (!map.has(key)) map.set(key, { code, name: code });
  }
  // 'Admin' is a bucket for staff accounts, not a teaching department.
  map.set('ADMIN', { code: 'Admin', name: 'Administration', isAcademic: false });

  const docs = [...map.values()].map(d => ({
    code: d.code, name: d.name,
    isAcademic: d.isAcademic !== false,
    isActive: true,
  }));
  await Department.insertMany(docs, { ordered: false }).catch(() => {});
  console.log(`✅ Departments bootstrapped (${docs.length} records)`);
  return { created: docs.length, skipped: false };
}

/** Active department codes, uppercased, for validation. */
async function activeCodes() {
  const rows = await Department.find({ isActive: true }).select('code').lean();
  return rows.map(r => r.code.toUpperCase());
}

/**
 * Resolve a submitted department to its canonical stored code.
 * @returns {Promise<{ok: true, code: string} | {ok: false, message: string}>}
 */
async function resolveDepartment(input, { allowInactive = false } = {}) {
  const raw = (input == null ? '' : String(input)).trim();
  if (!raw) return { ok: false, message: 'Department is required.' };

  const filter = { code: new RegExp(`^${raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
  if (!allowInactive) filter.isActive = true;

  const dept = await Department.findOne(filter);
  if (!dept) {
    const available = await activeCodes();
    return {
      ok: false,
      message: `"${raw}" is not a recognised department. Available: ${available.join(', ') || 'none configured yet'}.`,
    };
  }
  return { ok: true, code: dept.code, department: dept };
}

module.exports = { bootstrapDepartments, activeCodes, resolveDepartment, LEGACY_CODES };
