/**
 * Seed script — run once to populate demo data in MongoDB Atlas.
 * Usage: node seed.js
 */
require('dotenv').config();
const mongoose   = require('mongoose');
const User       = require('./models/User');
const Notice     = require('./models/Notice');
const Request    = require('./models/Request');
const Exam       = require('./models/Exam');
const Fee        = require('./models/Fee');
const Book       = require('./models/Book');
const BorrowedBook = require('./models/BorrowedBook');
const Timetable  = require('./models/Timetable');
const Event      = require('./models/Event');
const { buildExam } = require('./utils/demoExams');
const { seedPassword } = require('./utils/seedPassword');

// ── Relative-date helpers ───────────────────────────────────────────────────
// All demo dates are computed relative to the day the seed runs, so a freshly
// seeded database always looks current (no past-due fees, no "exam already
// started", no expired notices). Offsets are in days from today.
const DAY = 24 * 60 * 60 * 1000;
const BASE = new Date(); BASE.setHours(0, 0, 0, 0);
const dRel  = (offset) => new Date(BASE.getTime() + offset * DAY);   // Date object
const ymd   = (offset) => dRel(offset).toISOString().slice(0, 10);    // 'YYYY-MM-DD'
const human = (offset) => dRel(offset).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
// Current academic year, e.g. seeded in June 2026 → '2026–2027'.
const ACADEMIC_YEAR = BASE.getMonth() >= 5 ? `${BASE.getFullYear()}–${BASE.getFullYear() + 1}` : `${BASE.getFullYear() - 1}–${BASE.getFullYear()}`;

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // ── Users ──────────────────────────────────────────────
  const existingStudent = await User.findOne({ studentId: '22IT101' });
  let student;
  if (!existingStudent) {
    student = await User.create({
      name: 'Sneka S', studentId: '22IT101', email: 'sneka@college.edu',
      password: seedPassword('student').password, mustChangePassword: true,
      department: 'IT', semester: '5th', role: 'student'
    });
    console.log('✅ Demo student created  →  ID: 22IT101 | Password: student123');
  } else {
    student = existingStudent;
    console.log('ℹ️  Demo student already exists');
  }

  const existingAdmin = await User.findOne({ studentId: 'ADMIN01' });
  if (!existingAdmin) {
    await User.create({
      name: 'Admin User', studentId: 'ADMIN01', email: 'admin@college.edu',
      password: seedPassword('admin').password, mustChangePassword: true,
      department: 'Admin', semester: '', role: 'admin'
    });
    console.log('✅ Admin account created  →  ID: ADMIN01 | Password: admin@123');
  } else {
    console.log('ℹ️  Admin already exists');
  }

  // ── Sample faculty (portal login) — idempotent, one per requested department ──
  const FACULTY = [
    { name: 'Dr. John David', studentId: 'FAC001', email: 'john@campusassist.edu', department: 'CSE', designation: 'Professor',
      assignedSubjects: [
        { code: 'CS3401', name: 'Data Structures', department: 'CSE', semester: '6th', section: '' },
        { code: 'CS3691', name: 'Embedded Systems and IoT', department: 'CSE', semester: '6th', section: '' },
      ] },
    { name: 'Dr. Rajesh Kumar', studentId: 'FAC01', email: 'rajesh.kumar@college.edu', department: 'CSE', designation: 'Associate Professor',
      assignedSubjects: [
        { code: 'CS3401', name: 'Data Structures', department: 'CSE', semester: '6th', section: '' },
        { code: 'CS3492', name: 'Database Management Systems', department: 'CSE', semester: '6th', section: '' },
      ] },
    { name: 'Dr. Priya Nair', studentId: 'FAC02', email: 'priya.nair@college.edu', department: 'AIML', designation: 'Assistant Professor',
      assignedSubjects: [
        { code: 'CS3491', name: 'Artificial Intelligence', department: 'AIML', semester: '6th', section: '' },
        { code: 'AL3451', name: 'Machine Learning', department: 'AIML', semester: '6th', section: '' },
      ] },
    { name: 'Dr. Suresh Babu', studentId: 'FAC03', email: 'suresh.babu@college.edu', department: 'ECE', designation: 'Professor',
      assignedSubjects: [
        { code: 'EC3492', name: 'Digital Signal Processing', department: 'ECE', semester: '6th', section: '' },
        { code: 'EC3552', name: 'VLSI Design', department: 'ECE', semester: '6th', section: '' },
      ] },
    { name: 'Dr. Anand Krishnan', studentId: 'FAC04', email: 'anand.krishnan@college.edu', department: 'MECH', designation: 'Associate Professor',
      assignedSubjects: [
        { code: 'ME3391', name: 'Engineering Thermodynamics', department: 'MECH', semester: '6th', section: '' },
        { code: 'ME3591', name: 'Design of Machine Elements', department: 'MECH', semester: '6th', section: '' },
      ] },
  ];
  let facCreated = 0;
  for (const f of FACULTY) {
    if (!(await User.findOne({ studentId: f.studentId }))) {
      await User.create({ ...f, password: seedPassword('faculty').password,
                          mustChangePassword: true, role: 'faculty', semester: '' });
      facCreated++;
    }
  }
  console.log(facCreated ? `✅ ${facCreated} faculty seeded (FAC01–FAC04 | Password: faculty123)` : 'ℹ️  Faculty already exist');

  // ── Notices ────────────────────────────────────────────
  const noticeCount = await Notice.countDocuments();
  if (noticeCount === 0) {
    await Notice.insertMany([
      { title: 'Fee Payment Deadline – Final Reminder', content: `This is the final reminder for Semester V fee payment. The last date is ${human(21)}. Students who fail to pay will not be allowed to write semester examinations. Contact the accounts office immediately.`, category: 'urgent', postedBy: 'Admin', pinned: true, status: 'published', publishedAt: dRel(0), expiresAt: dRel(22) },
      { title: 'Semester V Examination Schedule Released', content: `The official semester V examination schedule has been published. Theory exams begin ${human(14)}. Hall tickets can be downloaded from the student portal from ${human(9)} onwards.`, category: 'exam', postedBy: 'Exam Cell', pinned: false, status: 'published', publishedAt: dRel(-1), expiresAt: dRel(28) },
      { title: 'Internal Marks Published', content: 'Internal assessment marks for Semester V have been published. Students who wish to apply for re-evaluation must submit a request to the department within 3 working days.', category: 'general', postedBy: 'Academic Section', pinned: false, status: 'published', publishedAt: dRel(-2) },
      { title: `College Holiday – ${human(15)}`, content: `College will remain closed on ${human(15)} on account of the state-level public holiday. All classes and lab sessions on that day stand cancelled.`, category: 'holiday', postedBy: 'Admin', pinned: false, status: 'published', publishedAt: dRel(-1), expiresAt: dRel(16) },
      { title: 'Scholarship Application Open', content: `Applications for the Merit-cum-Means Scholarship ${ACADEMIC_YEAR} are now open. Eligible students (family income below ₹2.5 LPA, GPA ≥ 7.5) can apply. Last date: ${human(20)}.`, category: 'fee', postedBy: 'Admin', pinned: false, status: 'published', publishedAt: dRel(-3), expiresAt: dRel(21) },
    ]);
    console.log('✅ 5 notices seeded (relative dates)');
  } else {
    console.log('ℹ️  Notices already exist, skipping');
  }

  // ── Requests ───────────────────────────────────────────
  const reqCount = await Request.countDocuments({ student: student._id });
  if (reqCount === 0) {
    await Request.create([
      { student: student._id, studentId: student.studentId, type: 'Bonafide Certificate', purpose: 'Bank loan application', urgency: 'Normal', status: 'Completed' },
      { student: student._id, studentId: student.studentId, type: 'Marksheet', purpose: 'Job application', urgency: 'Urgent', status: 'Processing' },
      { student: student._id, studentId: student.studentId, type: 'Conduct Certificate', purpose: 'Scholarship application', urgency: 'Normal', status: 'Submitted' },
    ]);
    console.log('✅ 3 sample requests seeded');
  } else {
    console.log('ℹ️  Requests already exist, skipping');
  }

  // ── Exam Schedules (cohort-specific) ───────────────────
  // Each department gets its OWN published exam so a student only ever sees their
  // cohort's schedule (resolveExamForUser in routes/exam.js scopes by department +
  // semester). No institution-wide (blank-department) exam is seeded, so there is
  // no cross-department leakage. Cohort definitions live in utils/demoExams.js
  // (shared with scripts/refresh-demo-data.js).
  const examHelpers = { ymd, dRel, academicYear: ACADEMIC_YEAR };
  const examCount = await Exam.countDocuments();
  if (examCount === 0) {
    await Exam.insertMany([
      buildExam('IT', examHelpers), buildExam('CSE', examHelpers),
      buildExam('ECE', examHelpers), buildExam('CIVIL', examHelpers),
    ]);
    console.log('✅ 4 cohort exam schedules seeded (IT, CSE, ECE, CIVIL)');
  } else {
    console.log('ℹ️  Exam schedule already exists, skipping');
  }

  // ── Fee Record ─────────────────────────────────────────
  const feeCount = await Fee.countDocuments({ student: student._id });
  if (feeCount === 0) {
    const txnDate = (offset) => dRel(offset).toISOString().slice(0, 10).replace(/-/g, '');
    await Fee.create({
      student: student._id, studentId: student.studentId,
      semester: '5th', academicYear: ACADEMIC_YEAR,
      components: [
        { name: 'Tuition Fee', amount: 45000 },
        { name: 'Lab Fee',     amount: 5000  },
        { name: 'Library Fee', amount: 2000  },
        { name: 'Exam Fee',    amount: 3000  },
      ],
      // Due date is in the near future (upcoming, not overdue).
      total: 55000, dueDate: ymd(21), lateFine: 500,
      history: [
        { date: ymd(-150), description: 'Semester V – Tuition Fee', amount: 45000, mode: 'Online', txn: `TXN${txnDate(-150)}001` },
        { date: ymd(-150), description: 'Semester V – Lab Fee',     amount: 5000,  mode: 'Online', txn: `TXN${txnDate(-150)}002` },
        { date: ymd(-145), description: 'Semester V – Library Fee', amount: 2000,  mode: 'DD',     txn: `DD${txnDate(-145)}001`  },
        { date: ymd(-140), description: 'Semester V – Exam Fee',    amount: 3000,  mode: 'Online', txn: `TXN${txnDate(-140)}001` },
      ],
    });
    console.log('✅ Fee record seeded (relative dates)');
  } else {
    console.log('ℹ️  Fee record already exists, skipping');
  }

  // ── Books ──────────────────────────────────────────────
  const bookCount = await Book.countDocuments();
  if (bookCount === 0) {
    const books = await Book.insertMany([
      { title: 'Introduction to Java',                      author: 'James Gosling',         isbn: '978-0132777681', category: 'Programming',   status: 'Available', copies: 3 },
      { title: 'Database System Concepts',                  author: 'Abraham Silberschatz',  isbn: '978-0078022159', category: 'DBMS',           status: 'Available', copies: 2 },
      { title: 'Artificial Intelligence: A Modern Approach',author: 'Stuart Russell',         isbn: '978-0136042594', category: 'AI / ML',        status: 'Borrowed',  copies: 1 },
      { title: 'Computer Networks',                         author: 'Andrew Tanenbaum',       isbn: '978-0132126953', category: 'Networking',     status: 'Available', copies: 4 },
      { title: 'Python Crash Course',                       author: 'Eric Matthes',           isbn: '978-1593279288', category: 'Python',         status: 'Available', copies: 3 },
      { title: 'Design Patterns',                           author: 'Gang of Four',           isbn: '978-0201633610', category: 'Software Eng.', status: 'Reserved',  copies: 1 },
      { title: 'Clean Code',                                author: 'Robert C. Martin',       isbn: '978-0132350884', category: 'Software Eng.', status: 'Available', copies: 2 },
      { title: 'Machine Learning',                          author: 'Tom Mitchell',           isbn: '978-0070428072', category: 'AI / ML',        status: 'Available', copies: 2 },
    ]);
    console.log('✅ 8 books seeded');

    // ── Borrowed Books ──────────────────────────────────
    const cnBook    = books.find(b => b.title === 'Computer Networks');
    const cleanBook = books.find(b => b.title === 'Clean Code');
    await BorrowedBook.insertMany([
      { student: student._id, studentId: student.studentId, book: cnBook._id,    title: cnBook.title,    author: cnBook.author,    borrowedDate: ymd(-7), dueDate: ymd(7), status: 'Active' },
      { student: student._id, studentId: student.studentId, book: cleanBook._id, title: cleanBook.title, author: cleanBook.author, borrowedDate: ymd(-12), dueDate: ymd(2), status: 'Active' },
    ]);
    console.log('✅ 2 borrowed books seeded (relative dates)');
  } else {
    console.log('ℹ️  Books already exist, skipping');
  }

  // ── Timetable ──────────────────────────────────────────
  const ttCount = await Timetable.countDocuments();
  if (ttCount === 0) {
    await Timetable.create({
      department: 'IT', semester: '5th', academicYear: '2025–2026',
      slots: ['9–10 AM', '10–11 AM', '11–12 PM', '12–1 PM', '1–2 PM', '2–3 PM', '3–4 PM'],
      schedule: {
        Monday:    ['Java', 'DBMS', 'CN', 'Lunch', 'AI', 'Lab', 'Lab'],
        Tuesday:   ['Python', 'Java', 'Maths', 'Lunch', 'AI', 'Lab', 'Lab'],
        Wednesday: ['DBMS', 'CN', 'Java', 'Lunch', 'Python', 'Seminar', 'Seminar'],
        Thursday:  ['Maths', 'AI', 'DBMS', 'Lunch', 'CN', 'Lab', 'Lab'],
        Friday:    ['Java', 'Python', 'Maths', 'Lunch', 'DBMS', 'Project', 'Project'],
        Saturday:  ['Tutorial', 'Tutorial', 'Tutorial', 'Lunch', '-', '-', '-'],
        Sunday:    [],
      },
      subjectDetails: {
        Java:    { name: 'Java Programming',        code: '21CS301', faculty: 'Dr. Anand Kumar',  room: 'Room 201' },
        DBMS:    { name: 'Database Management',     code: '21CS302', faculty: 'Prof. Meena Devi', room: 'Room 204' },
        CN:      { name: 'Computer Networks',       code: '21CS303', faculty: 'Dr. Raj Patel',    room: 'Room 201' },
        AI:      { name: 'Artificial Intelligence', code: '21CS304', faculty: 'Dr. Kavitha S',    room: 'Room 202' },
        Python:  { name: 'Python Programming',      code: '21CS305', faculty: 'Prof. Sundar M',   room: 'Room 203' },
        Maths:   { name: 'Mathematics – III',       code: '21MA301', faculty: 'Dr. Priya R',      room: 'Room 205' },
        Lab:     { name: 'Lab Session',             code: 'LAB',     faculty: 'Lab Instructor',   room: 'Lab 1/2/3' },
        Project: { name: 'Project Work',            code: 'PROJ',    faculty: 'Project Guide',    room: 'Project Lab' },
        Seminar: { name: 'Seminar / Soft Skills',   code: 'SEM',     faculty: 'Training Dept',    room: 'Seminar Hall' },
      },
    });
    console.log('✅ Timetable seeded');
  } else {
    console.log('ℹ️  Timetable already exists, skipping');
  }

  // ── Events (upcoming) ──────────────────────────────────
  // Future-dated so the dashboard "Upcoming Events" panel is always populated.
  const eventCount = await Event.countDocuments();
  if (eventCount === 0) {
    await Event.insertMany([
      { title: 'TechFest 2026 – National Symposium', category: 'Technical', date: dRel(7),  time: '9:00 AM', venue: 'Main Auditorium',  organizer: 'Department of IT',   description: 'A national-level technical symposium with paper presentations, coding contests and project expos.', seats: 300 },
      { title: 'Cultural Night – Rhythms',           category: 'Cultural',  date: dRel(14), time: '5:00 PM', venue: 'Open Air Theatre', organizer: 'Cultural Committee', description: 'An evening of music, dance and drama performances by students across departments.', seats: 500 },
      { title: 'AI & Cloud Hands-on Workshop',       category: 'Workshop',  date: dRel(21), time: '10:00 AM', venue: 'Seminar Hall B',   organizer: 'CSE Department',    description: 'A practical workshop on building and deploying AI applications on the cloud.', seats: 120 },
    ]);
    console.log('✅ 3 upcoming events seeded (relative dates)');
  } else {
    console.log('ℹ️  Events already exist, skipping');
  }

  console.log('\n🎓 Seed complete! You can now start the backend with: npm run dev');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
