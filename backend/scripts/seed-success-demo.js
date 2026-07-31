// Seeds realistic Student Success demo data for 22IT101 (idempotent).
// Run: node scripts/seed-success-demo.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Marks = require('../models/Marks');
const SuccessMetric = require('../models/SuccessMetric');

const STUDENT_ID = '22IT101';

// Five subjects; one (Computer Networks) intentionally low to trigger a risk indicator.
const SUBJECTS = [
  { subject: 'Data Structures',     attend: 0.92 },
  { subject: 'Operating Systems',   attend: 0.90 },
  { subject: 'DBMS',                attend: 0.88 },
  { subject: 'Computer Networks',   attend: 0.70 },  // ⚠ below 75%
  { subject: 'Web Technologies',    attend: 0.91 },
];

// 5 semesters of subjects → rising SGPA trend.
const SEM_SUBJECTS = {
  '1': ['Mathematics I', 'Programming in C', 'Physics', 'English', 'Engineering Graphics'],
  '2': ['Mathematics II', 'Data Structures', 'Digital Logic', 'OOP with Java', 'Environmental Science'],
  '3': ['DBMS', 'Operating Systems', 'Computer Architecture', 'Discrete Maths', 'Python Programming'],
  '4': ['Computer Networks', 'Software Engineering', 'Web Technologies', 'Microprocessors', 'Probability & Statistics'],
  '5': ['Machine Learning', 'Cloud Computing', 'Compiler Design', 'Cryptography', 'Mobile App Development'],
};

function dates(count) {
  // Returns `count` distinct weekday dates, most recent first, ~2-3 days apart.
  const out = [];
  const d = new Date();
  while (out.length < count) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) out.push(new Date(d));
    d.setDate(d.getDate() - 2);
  }
  return out;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { tls: true });
  const student = await User.findOne({ studentId: STUDENT_ID });
  if (!student) throw new Error(`Student ${STUDENT_ID} not found — run the main seed first.`);
  console.log(`Seeding success data for ${student.name} (${STUDENT_ID})`);

  // ── Attendance ──
  await Attendance.deleteMany({ student: student._id });
  const attDocs = [];
  for (const s of SUBJECTS) {
    const total = 36;
    const absents = Math.round(total * (1 - s.attend));
    dates(total).forEach((date, i) => {
      // Exactly `absents` evenly-spaced absences → percentage matches the target.
      const isAbsent = absents > 0 && Math.floor((i * absents) / total) !== Math.floor(((i + 1) * absents) / total);
      attDocs.push({
        student: student._id, studentId: STUDENT_ID, subject: s.subject,
        date, status: isAbsent ? 'Absent' : 'Present', markedBy: 'Seed',
      });
    });
  }
  await Attendance.insertMany(attDocs, { ordered: false }).catch(e => console.log('  (some attendance dups skipped)', e.code || ''));
  console.log(`  ✓ ${attDocs.length} attendance records across ${SUBJECTS.length} subjects`);

  // ── Marks (rising SGPA) ──
  await Marks.deleteMany({ student: student._id });
  const markDocs = [];
  Object.entries(SEM_SUBJECTS).forEach(([sem, subjects]) => {
    const semIdx = Number(sem);
    subjects.forEach((subject, j) => {
      const credits = [3, 4, 3, 4, 3][j] || 3;
      // Base rises with semester; small per-subject jitter. internal/40, external/60.
      const base = 58 + semIdx * 4 + ((j % 3) - 1) * 3;     // ~62 → ~80
      const internal = Math.min(40, Math.round(base * 0.4));
      const external = Math.min(60, Math.round(base * 0.6));
      const { total, grade, gradePoint } = Marks.computeGrade(internal, external);
      markDocs.push({
        student: student._id, studentId: STUDENT_ID, semester: sem, subject,
        subjectCode: `IT${semIdx}0${j + 1}`, credits,
        internalMarks: internal, externalMarks: external, total, grade, gradePoint, enteredBy: 'Seed',
      });
    });
  });
  await Marks.insertMany(markDocs, { ordered: false });
  const credits = markDocs.reduce((s, m) => s + m.credits, 0);
  const cgpa = +(markDocs.reduce((s, m) => s + m.credits * m.gradePoint, 0) / credits).toFixed(2);
  console.log(`  ✓ ${markDocs.length} marks records across 5 semesters · CGPA ≈ ${cgpa}`);

  // ── Skill & project profile ──
  student.skills = ['Java', 'Python', 'React', 'Node.js', 'SQL', 'Data Structures', 'Git', 'MongoDB'];
  student.projects = [
    { title: 'Campus HelpDesk AI', tech: 'React + Express + MongoDB' },
    { title: 'Library Management System', tech: 'Java + MySQL' },
  ];
  student.cgpa = cgpa;
  student.placementOptIn = true;
  await student.save();
  console.log(`  ✓ profile: ${student.skills.length} skills, ${student.projects.length} projects, CGPA ${cgpa}`);

  // ── Historical success snapshots (growth trend) ──
  await SuccessMetric.deleteMany({ student: student._id });
  const snaps = [];
  for (let w = 6; w >= 1; w--) {
    const d = new Date(); d.setDate(d.getDate() - w * 7);
    snaps.push({
      student: student._id, snapshotDate: d.toISOString().slice(0, 10),
      successScore: 62 + (6 - w) * 3,   // 62 → 77
      attHealth: 80 + (6 - w), academic: Math.round(cgpa * 10), placement: 55 + (6 - w) * 2, engagement: 30 + (6 - w) * 4,
      cgpa, attendancePct: 84, backlogs: 0,
    });
  }
  await SuccessMetric.insertMany(snaps, { ordered: false });
  console.log(`  ✓ ${snaps.length} weekly success snapshots`);

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(e => { console.error('Seed failed:', e.message); process.exit(1); });
