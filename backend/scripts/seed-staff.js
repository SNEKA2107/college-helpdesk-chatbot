/**
 * seed-staff.js — large-scale staff seed: ~200 faculty + ~30 administrators.
 *
 *   cd backend && node scripts/seed-staff.js
 *
 * DETERMINISTIC AND IDEMPOTENT. Every record is derived from its index, so a
 * rerun produces byte-identical values and skips anything that already exists.
 * Nothing is ever deleted or overwritten — existing students, faculty and admins
 * are left exactly as they are.
 *
 * Each faculty member gets BOTH halves of the pairing the app expects:
 *   • a User document (role:'faculty') — the login + assignedSubjects the portal reads
 *   • a Faculty directory document linked back via `user` — what the Copilot searches
 *
 * ── Why assignments leave `section` and `year` blank ────────────────────────
 * routes/facultyPortal.js narrows a faculty's student roster by department, and
 * additionally by semester/section/year *only where the assignment specifies one*.
 * Essentially no student in this database has `section` or `year` populated, so an
 * assignment pinned to section 'A' would resolve to an empty class list. Leaving
 * them blank means "every section / every year", which is what makes the seeded
 * dashboards show real students, attendance, marks and analytics immediately.
 * `batch` is carried for realism — it is descriptive metadata and is not used to
 * filter rosters.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Faculty = require('../models/Faculty');
const Counter = require('../models/Counter');
const { bootstrapDepartments } = require('../services/departments');
const { seedPassword } = require('../utils/seedPassword');

// ── Shared seed passwords ───────────────────────────────────────────────────
// Hashed by the User model's pre-save hook. Documented in the final report so
// they can be rotated before the system carries real staff.
// Sourced from the environment, or generated and printed once. They used to be
// fixed strings that were also published in the project documentation.
const FACULTY_PASSWORD = seedPassword('faculty').password;
const ADMIN_PASSWORD   = seedPassword('admin').password;

// ── Name pools — combined by index, so name N is always the same person ─────
const FIRST = [
  'Aarav', 'Abhinav', 'Aditya', 'Ajay', 'Akash', 'Anand', 'Aravind', 'Arjun', 'Arun', 'Ashwin',
  'Balaji', 'Bharath', 'Chandran', 'Deepak', 'Dhanush', 'Dinesh', 'Ganesh', 'Gokul', 'Gopinath', 'Gowtham',
  'Hariharan', 'Hemanth', 'Jagadeesh', 'Jeevan', 'Karthik', 'Kishore', 'Lokesh', 'Mahesh', 'Manikandan', 'Manoj',
  'Mohan', 'Murugan', 'Naveen', 'Nithish', 'Prabhu', 'Prakash', 'Prasanth', 'Praveen', 'Rajesh', 'Rajkumar',
  'Ramesh', 'Rishi', 'Sathish', 'Selvam', 'Senthil', 'Shanmugam', 'Sivakumar', 'Srikanth', 'Suresh', 'Surya',
  'Thirumaran', 'Udhay', 'Venkatesh', 'Vignesh', 'Vijay', 'Vikram', 'Vinoth', 'Vishnu', 'Vivek', 'Yuvaraj',
  'Abinaya', 'Akshaya', 'Ananya', 'Anitha', 'Aswini', 'Bhavani', 'Brindha', 'Deepika', 'Dharani', 'Divya',
  'Geetha', 'Gomathi', 'Harini', 'Indhumathi', 'Janani', 'Jayalakshmi', 'Kalpana', 'Kavitha', 'Kavya', 'Keerthana',
  'Kiruthika', 'Kousalya', 'Lavanya', 'Madhumitha', 'Maheswari', 'Meenakshi', 'Nandhini', 'Nithya', 'Oviya', 'Pavithra',
  'Preethi', 'Priyadharshini', 'Radhika', 'Ramya', 'Revathi', 'Saranya', 'Shanthi', 'Sowmya', 'Swathi', 'Vaishnavi',
];
const LAST = [
  'Annamalai', 'Arumugam', 'Balakrishnan', 'Chandrasekaran', 'Devarajan', 'Elango', 'Ganesan', 'Gopalan',
  'Hariharan', 'Iyer', 'Jayakumar', 'Krishnan', 'Lakshmanan', 'Mahadevan', 'Nagarajan', 'Narayanan',
  'Palaniswamy', 'Pillai', 'Raghavan', 'Rajagopal', 'Ramachandran', 'Sundaram', 'Thirumalai', 'Vasudevan',
  'Venkataraman', 'Viswanathan', 'Subramanian', 'Chinnaswamy', 'Muthukrishnan', 'Sivaraman',
];

/** Deterministic, collision-free name for global index i. */
function nameFor(i) {
  // Stride the surname list by a co-prime step so pairings do not repeat early.
  const first = FIRST[i % FIRST.length];
  const last = LAST[(i * 7 + Math.floor(i / FIRST.length)) % LAST.length];
  return `${first} ${last}`;
}

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');

// ── Department plan ─────────────────────────────────────────────────────────
// `count` sums to exactly 200. `semesters` are the cohorts that actually hold
// students, so seeded assignments resolve to real rosters.
const DEPARTMENTS = [
  { code: 'CSE',            count: 30, semesters: ['2nd', '4th', '6th', '8th'] },
  { code: 'IT',             count: 28, semesters: ['2nd', '4th', '6th', '8th'] },
  { code: 'AIML',           count: 24, semesters: ['2nd', '4th', '6th', '8th'] },
  { code: 'AIDS',           count: 24, semesters: ['2nd', '4th', '6th', '8th'] },
  { code: 'ECE',            count: 22, semesters: ['2nd', '4th', '6th', '8th'] },
  { code: 'Bioinformatics', count: 20, semesters: ['2nd', '4th', '6th', '8th'] },
  { code: 'EEE',            count: 20, semesters: ['2nd', '4th', '6th', '8th'] },
  { code: 'MECH',           count: 18, semesters: ['2nd', '4th', '6th', '8th'] },
  { code: 'CIVIL',          count: 14, semesters: ['2nd', '4th', '6th', '8th'] },
];

// Subject catalogue per department: [code, name].
const SUBJECTS = {
  CSE: [
    ['CS3401', 'Data Structures'], ['CS3452', 'Theory of Computation'], ['CS3491', 'Artificial Intelligence'],
    ['CS3492', 'Database Management Systems'], ['CS3501', 'Compiler Design'], ['CS3591', 'Computer Networks'],
    ['CS3691', 'Embedded Systems and IoT'], ['CS3251', 'Programming in C'], ['CS3351', 'Digital Principles'],
    ['CS3551', 'Distributed Computing'], ['CS3691', 'Operating Systems'], ['CS3711', 'Cloud Computing'],
  ],
  IT: [
    ['IT3401', 'Web Essentials'], ['IT3501', 'Full Stack Web Development'], ['IT3491', 'Software Engineering'],
    ['IT3402', 'Object Oriented Programming'], ['IT3502', 'Information Security'], ['IT3601', 'Mobile Application Development'],
    ['IT3301', 'Computer Organisation'], ['IT3602', 'Data Warehousing and Mining'], ['IT3701', 'DevOps Practices'],
    ['IT3702', 'Human Computer Interaction'],
  ],
  AIML: [
    ['AL3451', 'Machine Learning'], ['AL3452', 'Deep Learning'], ['AL3391', 'Artificial Intelligence Fundamentals'],
    ['AL3501', 'Natural Language Processing'], ['AL3502', 'Computer Vision'], ['AL3601', 'Reinforcement Learning'],
    ['AL3301', 'Probability and Statistics'], ['AL3602', 'Neural Networks'], ['AL3701', 'Generative AI Systems'],
  ],
  AIDS: [
    ['AD3491', 'Fundamentals of Data Science'], ['AD3492', 'Big Data Analytics'], ['AD3501', 'Data Visualisation'],
    ['AD3391', 'Data Exploration and Wrangling'], ['AD3502', 'Predictive Analytics'], ['AD3601', 'Time Series Analysis'],
    ['AD3301', 'Statistical Foundations'], ['AD3602', 'Business Intelligence'], ['AD3701', 'Data Engineering'],
  ],
  ECE: [
    ['EC3492', 'Digital Signal Processing'], ['EC3552', 'VLSI Design'], ['EC3491', 'Communication Systems'],
    ['EC3401', 'Networks and Security'], ['EC3351', 'Control Systems'], ['EC3501', 'Wireless Communication'],
    ['EC3251', 'Circuit Analysis'], ['EC3451', 'Linear Integrated Circuits'], ['EC3601', 'Antennas and Microwave'],
  ],
  Bioinformatics: [
    ['BI3401', 'Genomics and Proteomics'], ['BI3402', 'Biological Databases'], ['BI3501', 'Computational Biology'],
    ['BI3301', 'Biochemistry'], ['BI3502', 'Structural Bioinformatics'], ['BI3601', 'Systems Biology'],
    ['BI3302', 'Molecular Biology'], ['BI3602', 'Drug Design and Discovery'], ['BI3701', 'Biostatistics'],
  ],
  EEE: [
    ['EE3401', 'Transmission and Distribution'], ['EE3491', 'Power Electronics'], ['EE3501', 'Power System Analysis'],
    ['EE3301', 'Electrical Machines'], ['EE3502', 'Control Systems Engineering'], ['EE3601', 'Renewable Energy Systems'],
    ['EE3251', 'Electric Circuit Analysis'], ['EE3602', 'Switchgear and Protection'], ['EE3701', 'Smart Grid Technology'],
  ],
  MECH: [
    ['ME3391', 'Engineering Thermodynamics'], ['ME3591', 'Design of Machine Elements'], ['ME3491', 'Theory of Machines'],
    ['ME3351', 'Engineering Mechanics'], ['ME3492', 'Hydraulics and Pneumatics'], ['ME3501', 'Heat and Mass Transfer'],
    ['ME3451', 'Manufacturing Technology'], ['ME3601', 'Finite Element Analysis'], ['ME3701', 'Robotics and Automation'],
  ],
  CIVIL: [
    ['CE3401', 'Structural Analysis'], ['CE3402', 'Concrete Technology'], ['CE3501', 'Geotechnical Engineering'],
    ['CE3301', 'Fluid Mechanics'], ['CE3502', 'Environmental Engineering'], ['CE3601', 'Transportation Engineering'],
    ['CE3351', 'Surveying'], ['CE3602', 'Water Resources Engineering'], ['CE3701', 'Estimation and Costing'],
  ],
};

/** Designation for position `i` within a department of `total` members. */
function designationFor(i, total) {
  if (i === 0) return 'HOD';                                  // exactly one per department
  const professors = Math.max(2, Math.round(total * 0.15));
  const associates = Math.max(3, Math.round(total * 0.25));
  const assistants = Math.max(4, Math.round(total * 0.45));
  if (i <= professors) return 'Professor';
  if (i <= professors + associates) return 'Associate Professor';
  if (i <= professors + associates + assistants) return 'Assistant Professor';
  return 'Lecturer';
}

/** Academic-year label a batch belongs to, e.g. semester 6 → 3rd year, batch 2023. */
function batchForSemester(sem) {
  const n = parseInt(sem, 10) || 1;
  const yearOfStudy = Math.ceil(n / 2);                       // 1..4
  const intake = 2026 - yearOfStudy;                          // rough intake year
  return { year: `${yearOfStudy}${['st', 'nd', 'rd', 'th'][Math.min(yearOfStudy - 1, 3)]}`, batch: String(intake) };
}

// ── Administrator plan — ~30 accounts across the operational functions ──────
const ADMIN_ROLES = [
  'Super Admin', 'Academic Admin', 'Exam Admin', 'Library Admin', 'Fee Admin',
  'Placement Admin', 'Department Admin', 'Student Affairs Admin', 'Hostel Admin', 'Transport Admin',
];
const ADMIN_COUNT = 30;

// ── Builders ────────────────────────────────────────────────────────────────

/** Every faculty record, fully derived from its index. Pure — no DB access. */
function buildFaculty() {
  const out = [];
  let n = 0;                                                   // global index → ID + name
  for (const dept of DEPARTMENTS) {
    const catalogue = SUBJECTS[dept.code];
    for (let i = 0; i < dept.count; i++, n++) {
      const name = nameFor(n);
      const staffId = `FAC${String(101 + n).padStart(4, '0')}`; // FAC0101 … FAC0300
      const designation = designationFor(i, dept.count);

      // Two subjects each, walked through the catalogue so a department's
      // coverage spreads evenly rather than everyone teaching subject #1.
      const subjectRows = [0, 1].map(k => {
        const [code, subject] = catalogue[(i * 2 + k) % catalogue.length];
        const semester = dept.semesters[(i + k) % dept.semesters.length];
        const { year, batch } = batchForSemester(semester);
        return {
          code, name: subject, department: dept.code, semester,
          // Blank on purpose — see the header note. These widen the class to
          // every section/year, which is what makes the roster resolve.
          section: '', year: '',
          batch,
          // Carried separately for the directory/report only.
          _displayYear: year,
        };
      });

      out.push({
        n, staffId, name, department: dept.code, designation,
        email: `${slug(name)}.${staffId.toLowerCase()}@college.edu`,
        phone: `9${String(400000000 + n * 137).slice(0, 9)}`,
        isHOD: designation === 'HOD',
        officeLocation: `${dept.code} Block · Room ${200 + (i % 40)}`,
        assignedSubjects: subjectRows.map(({ _displayYear, ...row }) => row),
        displayYears: [...new Set(subjectRows.map(r => r._displayYear))],
        subjects: [...new Set(subjectRows.map(r => r.name))],
      });
    }
  }
  return out;
}

/** Every administrator record. Pure. */
function buildAdmins() {
  const out = [];
  for (let i = 0; i < ADMIN_COUNT; i++) {
    const name = nameFor(220 + i);                             // disjoint slice of the name pool
    const adminId = `ADM${String(i + 1).padStart(3, '0')}`;     // ADM001 … ADM030
    const role = ADMIN_ROLES[i % ADMIN_ROLES.length];
    out.push({
      adminId, name, role,
      email: `${slug(name)}.${adminId.toLowerCase()}@college.edu`,
      phone: `9${String(500000000 + i * 173).slice(0, 9)}`,
    });
  }
  return out;
}

/**
 * Reconcile the two halves of a faculty record for accounts that predate the
 * pairing. Both directions exist in older data:
 *
 *   • directory rows from seed-knowledge-demo.js with no User — searchable by the
 *     Copilot but unable to log in, and un-assignable from the admin panel
 *   • Users from seed.js with no directory row — able to log in but invisible to
 *     "who teaches X" / "who is the HOD" queries
 *
 * Additive only: nothing is deleted, and an already-linked pair is left alone.
 */
async function reconcile() {
  const { nextFacultyId } = require('../services/facultyAccounts');
  const out = { linked: 0, loginsCreated: 0, directoriesCreated: 0, skipped: [] };

  // Directory row → login.
  for (const doc of await Faculty.find({ $or: [{ user: null }, { user: { $exists: false } }] })) {
    if (!doc.email) { out.skipped.push(`${doc.name} (no email — cannot create a login)`); continue; }
    const email = doc.email.toLowerCase();

    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.role !== 'faculty') { out.skipped.push(`${doc.name} (${email} belongs to a ${existing.role})`); continue; }
      doc.user = existing._id; await doc.save(); out.linked++;
      continue;
    }

    const user = await User.create({
      name: doc.name,
      studentId: await nextFacultyId(),
      email,
      password: FACULTY_PASSWORD,
      department: doc.department || 'General',
      role: 'faculty',
      semester: '',
      designation: doc.designation || 'Assistant Professor',
      phone: doc.phone || '',
      approvalStatus: 'approved',
      isActive: true,
      // Give them the subjects the directory already advertises, scoped to their
      // department, so their portal is not empty on first login.
      assignedSubjects: (doc.subjects || []).map(name => ({
        code: '', name, department: doc.department || 'General',
        semester: '', section: '', year: '', batch: '',
      })),
    });
    doc.user = user._id; await doc.save();
    out.loginsCreated++;
  }

  // Login → directory row.
  for (const user of await User.find({ role: 'faculty' })) {
    if (await Faculty.exists({ user: user._id })) continue;
    const byEmail = user.email ? await Faculty.findOne({ email: user.email.toLowerCase() }) : null;
    if (byEmail) { byEmail.user = user._id; await byEmail.save(); out.linked++; continue; }

    await Faculty.create({
      name: user.name, user: user._id, department: user.department,
      designation: user.designation || 'Assistant Professor',
      email: user.email, phone: user.phone || '',
      subjects: [...new Set((user.assignedSubjects || []).map(s => s.name).filter(Boolean))],
      isActive: user.isActive !== false,
    });
    out.directoriesCreated++;
  }

  return out;
}

// ── Seed ────────────────────────────────────────────────────────────────────

async function seed() {
  await mongoose.connect(process.env.MONGO_URI, { tls: true, serverSelectionTimeoutMS: 20000 });
  console.log(`✅ Connected — database "${mongoose.connection.name}"\n`);

  // Departments are data now; the generated staff reference them, so make sure
  // the collection exists before validating anything against it.
  const boot = await bootstrapDepartments();
  console.log(boot.skipped ? 'ℹ️  Departments already present' : `✅ Departments bootstrapped (${boot.created})`);

  const stats = {
    facultyCreated: 0, facultySkipped: 0, directoryCreated: 0, directoryLinked: 0,
    adminCreated: 0, adminSkipped: 0,
  };

  // ── Faculty ──
  const faculty = buildFaculty();
  console.log(`\n👨‍🏫 Seeding ${faculty.length} faculty…`);
  for (const f of faculty) {
    let user = await User.findOne({ $or: [{ studentId: f.staffId }, { email: f.email }] });

    if (user) {
      stats.facultySkipped++;
    } else {
      user = await User.create({
        name: f.name,
        studentId: f.staffId,
        email: f.email,
        password: FACULTY_PASSWORD,        // hashed by the model's pre-save hook
        department: f.department,
        role: 'faculty',
        semester: '',
        designation: f.designation,
        phone: f.phone,
        approvalStatus: 'approved',        // staff are not part of the student approval queue
        isActive: true,
        mustChangePassword: false,         // seeded accounts are demo-ready
        assignedSubjects: f.assignedSubjects,
      });
      stats.facultyCreated++;
    }

    // The directory half of the pairing, always linked back to the login.
    const existingDoc = await Faculty.findOne({ $or: [{ user: user._id }, { email: f.email }] });
    if (!existingDoc) {
      await Faculty.create({
        name: f.name, user: user._id, department: f.department, designation: f.designation,
        email: f.email, phone: f.phone, subjects: f.subjects,
        officeLocation: f.officeLocation, isHOD: f.isHOD, isActive: true,
      });
      stats.directoryCreated++;
    } else if (!existingDoc.user) {
      existingDoc.user = user._id;
      await existingDoc.save();
      stats.directoryLinked++;
    }
  }

  // Keep runtime ID allocation clear of the seeded FAC0101–FAC0300 block.
  // nextFacultyId() only retries 25 times, so without this an admin creating a
  // faculty member through the UI would collide repeatedly and fail.
  const highest = 100 + faculty.length;
  const counter = await Counter.findById('faculty-staff-id');
  if (!counter || counter.seq < highest) {
    await Counter.findByIdAndUpdate('faculty-staff-id', { seq: highest }, { upsert: true });
    console.log(`   ↳ faculty-staff-id counter advanced to ${highest}`);
  }

  // ── Administrators ──
  const admins = buildAdmins();
  console.log(`\n🛡️  Seeding ${admins.length} administrators…`);
  for (const a of admins) {
    const clash = await User.findOne({ $or: [{ studentId: a.adminId }, { email: a.email }] });
    if (clash) { stats.adminSkipped++; continue; }
    await User.create({
      name: a.name,
      studentId: a.adminId,
      email: a.email,
      password: ADMIN_PASSWORD,
      department: 'Admin',
      role: 'admin',
      semester: '',
      designation: a.role,                 // the admin's function, e.g. 'Exam Admin'
      phone: a.phone,
      approvalStatus: 'approved',
      isActive: true,
    });
    stats.adminCreated++;
  }

  const repair = await reconcile();

  console.log(`
──────────────────────────────────────────────
  Faculty logins   created ${stats.facultyCreated}   already present ${stats.facultySkipped}
  Directory rows   created ${stats.directoryCreated}   linked ${stats.directoryLinked}
  Administrators   created ${stats.adminCreated}   already present ${stats.adminSkipped}

  Reconciliation of pre-existing records:
    directory rows linked to an existing login .... ${repair.linked}
    logins created for directory-only faculty ..... ${repair.loginsCreated}
    directory rows created for login-only faculty . ${repair.directoriesCreated}
──────────────────────────────────────────────
  Faculty password : ${FACULTY_PASSWORD}
  Admin password   : ${ADMIN_PASSWORD}
──────────────────────────────────────────────`);

  await mongoose.disconnect();
}

if (require.main === module) {
  seed().catch(err => { console.error('❌ Seed failed:', err); process.exit(1); });
}

module.exports = { buildFaculty, buildAdmins, reconcile, DEPARTMENTS, ADMIN_ROLES, FACULTY_PASSWORD, ADMIN_PASSWORD };
