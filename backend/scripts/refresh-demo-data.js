/**
 * Demo-data freshness remediation (for an EXISTING / live database).
 *
 * seed.js now generates relative dates, but a database that was seeded earlier
 * still holds stale absolute dates (overdue fees, "exam already started",
 * past-dated notices) and a single institution-wide exam that leaks across
 * departments. This script re-bases those records to be current and splits the
 * exam into cohorts — WITHOUT dropping or duplicating real user data.
 *
 *   DRY RUN (default) — reports what would change, changes nothing:
 *       cd backend && node scripts/refresh-demo-data.js
 *
 *   APPLY — performs the updates (idempotent, re-runnable):
 *       cd backend && node scripts/refresh-demo-data.js --apply
 *
 * Requires MONGO_URI in backend/.env. Take a snapshot before --apply.
 * It only touches the demo seed records (matched by their known titles/owner)
 * and exam cohorts; it never deletes a record.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Notice = require('../models/Notice');
const Exam   = require('../models/Exam');
const Fee    = require('../models/Fee');
const BorrowedBook = require('../models/BorrowedBook');

const DAY = 24 * 60 * 60 * 1000;
const BASE = new Date(); BASE.setHours(0, 0, 0, 0);
const dRel  = (o) => new Date(BASE.getTime() + o * DAY);
const ymd   = (o) => dRel(o).toISOString().slice(0, 10);
const human = (o) => dRel(o).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
const ACADEMIC_YEAR = BASE.getMonth() >= 5 ? `${BASE.getFullYear()}–${BASE.getFullYear() + 1}` : `${BASE.getFullYear() - 1}–${BASE.getFullYear()}`;
const isPast = (v) => v && new Date(v) < BASE;

// Re-base a list of {date} sub-docs and the header dates so the earliest theory
// date lands ~14 days out, preserving the original spacing between papers.
function shiftExam(exam) {
  const dates = [exam.theoryStart, ...(exam.schedule || []).map(s => s.date)].filter(Boolean).map(d => new Date(d));
  if (!dates.length) return false;
  const earliest = new Date(Math.min(...dates));
  const deltaDays = Math.round((dRel(14) - earliest) / DAY);
  if (deltaDays === 0) return false;
  const shift = (s) => (s ? ymd(Math.round((new Date(s) - BASE) / DAY) + deltaDays) : s);
  exam.theoryStart = shift(exam.theoryStart);
  exam.theoryEnd = shift(exam.theoryEnd);
  exam.hallTicketAvailable = shift(exam.hallTicketAvailable);
  exam.schedule = (exam.schedule || []).map(s => ({ ...s.toObject?.() ?? s, date: shift(s.date) }));
  exam.practicals = (exam.practicals || []).map(p => ({ ...p.toObject?.() ?? p, date: shift(p.date) }));
  return true;
}

(async () => {
  if (!process.env.MONGO_URI) { console.error('❌ MONGO_URI not set in backend/.env'); process.exit(1); }
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGO_URI);
  const log = [];

  // 1) NOTICES — refresh the known seeded notices' text + publish dates.
  const noticeUpdates = [
    { match: /Fee Payment Deadline/i, set: { content: `This is the final reminder for Semester V fee payment. The last date is ${human(21)}. Students who fail to pay will not be allowed to write semester examinations. Contact the accounts office immediately.`, publishedAt: dRel(0), expiresAt: dRel(22), status: 'published' } },
    { match: /Examination Schedule Released/i, set: { content: `The official semester V examination schedule has been published. Theory exams begin ${human(14)}. Hall tickets can be downloaded from the student portal from ${human(9)} onwards.`, publishedAt: dRel(-1), expiresAt: dRel(28), status: 'published' } },
    { match: /Internal Marks Published/i, set: { publishedAt: dRel(-2), status: 'published' } },
    { match: /College Holiday/i, set: { title: `College Holiday – ${human(15)}`, content: `College will remain closed on ${human(15)} on account of the state-level public holiday. All classes and lab sessions on that day stand cancelled.`, publishedAt: dRel(-1), expiresAt: dRel(16), status: 'published' } },
    { match: /Scholarship Application Open/i, set: { content: `Applications for the Merit-cum-Means Scholarship ${ACADEMIC_YEAR} are now open. Eligible students (family income below ₹2.5 LPA, GPA ≥ 7.5) can apply. Last date: ${human(20)}.`, publishedAt: dRel(-3), expiresAt: dRel(21), status: 'published' } },
  ];
  for (const u of noticeUpdates) {
    const n = await Notice.findOne({ title: u.match });
    if (n) { log.push(`notice: "${n.title}" → refresh dates`); if (apply) await Notice.updateOne({ _id: n._id }, { $set: u.set, $currentDate: { createdAt: false } }); }
  }

  // 2) EXAMS — re-base dates + remove cross-department leakage.
  const exams = await Exam.find();
  for (const e of exams) {
    const changed = shiftExam(e);
    // An institution-wide (blank-department) exam leaks to everyone — tag it to IT.
    if (e.department === '' || e.department == null) { e.department = 'IT'; log.push(`exam ${e._id}: blank department → 'IT' (stop leakage)`); }
    if (!e.semester) e.semester = '5th';
    if (!e.academicYear) e.academicYear = ACADEMIC_YEAR;
    if (changed) log.push(`exam ${e._id} (${e.department}): dates re-based forward`);
    if (apply) await e.save();
  }
  // Ensure each demo cohort has a published exam (clone IT's if missing).
  const itExam = await Exam.findOne({ department: 'IT', status: 'published' });
  for (const dept of ['CSE', 'ECE', 'CIVIL']) {
    const exists = await Exam.findOne({ department: dept });
    if (!exists && itExam) {
      log.push(`exam: missing ${dept} cohort → clone from IT`);
      if (apply) {
        const clone = itExam.toObject(); delete clone._id; delete clone.createdAt; delete clone.updatedAt;
        clone.department = dept;
        await Exam.create(clone);
      }
    }
  }

  // 3) FEES — push past due dates into the near future.
  const fees = await Fee.find();
  for (const f of fees) {
    if (isPast(f.dueDate)) { log.push(`fee ${f.studentId}: dueDate ${ymd0(f.dueDate)} → ${ymd(21)}`); if (apply) { f.dueDate = dRel(21); await f.save(); } }
  }

  // 4) BORROWED BOOKS — clear stale overdue demo loans.
  const loans = await BorrowedBook.find({ status: 'Active' });
  for (const b of loans) {
    if (isPast(b.dueDate)) { log.push(`borrowed "${b.title}": overdue dueDate → ${ymd(7)}`); if (apply) { b.dueDate = dRel(7); await b.save(); } }
  }

  console.log(`\n${apply ? '🔧 APPLY' : '🔍 DRY RUN'} — ${log.length} change(s):`);
  log.forEach((l, i) => console.log(`  ${i + 1}. ${l}`));
  if (!log.length) console.log('  ✅ Everything already current — nothing to do.');
  else if (!apply) console.log('\nℹ️  Re-run with --apply to perform these updates.');

  await mongoose.disconnect();
  process.exit(0);
})().catch(err => { console.error('❌ refresh-demo-data failed:', err); process.exit(1); });

function ymd0(v) { try { return new Date(v).toISOString().slice(0, 10); } catch { return String(v); } }
