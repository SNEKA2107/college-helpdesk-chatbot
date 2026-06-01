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

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // ── Users ──────────────────────────────────────────────
  const existingStudent = await User.findOne({ studentId: '22IT101' });
  let student;
  if (!existingStudent) {
    student = await User.create({
      name: 'Sneka S', studentId: '22IT101', email: 'sneka@college.edu',
      password: 'student123', department: 'IT', semester: '5th', role: 'student'
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
      password: 'admin@123', department: 'Admin', semester: '', role: 'admin'
    });
    console.log('✅ Admin account created  →  ID: ADMIN01 | Password: admin@123');
  } else {
    console.log('ℹ️  Admin already exists');
  }

  // ── Notices ────────────────────────────────────────────
  const noticeCount = await Notice.countDocuments();
  if (noticeCount === 0) {
    await Notice.insertMany([
      { title: 'Fee Payment Deadline – Final Reminder', content: 'This is the final reminder for Semester V fee payment. The last date is May 25, 2026. Students who fail to pay will not be allowed to write semester examinations. Contact the accounts office immediately.', category: 'urgent', postedBy: 'Admin', pinned: true },
      { title: 'Semester V Examination Schedule Released', content: 'The official semester V examination schedule has been published. Theory exams begin June 15, 2026. Hall tickets can be downloaded from the student portal from June 10 onwards.', category: 'exam', postedBy: 'Exam Cell', pinned: false },
      { title: 'Internal Marks Published', content: 'Internal assessment marks for Semester V have been published. Students who wish to apply for re-evaluation must submit a request to the department within 3 working days.', category: 'general', postedBy: 'Academic Section', pinned: false },
      { title: 'College Holiday – May 30, 2026', content: 'College will remain closed on May 30, 2026 on account of the state-level public holiday. All classes and lab sessions on that day stand cancelled.', category: 'holiday', postedBy: 'Admin', pinned: false },
      { title: 'Scholarship Application Open', content: 'Applications for Merit-cum-Means Scholarship 2026–27 are now open. Eligible students (income below ₹2.5 LPA, GPA ≥ 7.5) can apply. Last date: June 5, 2026.', category: 'fee', postedBy: 'Admin', pinned: false },
    ]);
    console.log('✅ 5 notices seeded');
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

  // ── Exam Schedule ──────────────────────────────────────
  const examCount = await Exam.countDocuments();
  if (examCount === 0) {
    await Exam.create({
      semester: 'V', academicYear: '2025–2026',
      theoryStart: '2026-06-15', theoryEnd: '2026-06-28', hallTicketAvailable: '2026-06-10',
      schedule: [
        { date: '2026-06-15', subject: 'Java Programming',       code: '21CS301', session: 'Morning (10 AM)' },
        { date: '2026-06-17', subject: 'Database Management',    code: '21CS302', session: 'Morning (10 AM)' },
        { date: '2026-06-19', subject: 'Computer Networks',      code: '21CS303', session: 'Afternoon (2 PM)' },
        { date: '2026-06-21', subject: 'Artificial Intelligence', code: '21CS304', session: 'Morning (10 AM)' },
        { date: '2026-06-23', subject: 'Mathematics – III',      code: '21MA301', session: 'Morning (10 AM)' },
        { date: '2026-06-25', subject: 'Python Programming',     code: '21CS305', session: 'Afternoon (2 PM)' },
        { date: '2026-06-28', subject: 'Open Elective',          code: '21OE301', session: 'Morning (10 AM)' },
      ],
      practicals: [
        { date: '2026-06-10', subject: 'Computer Networks Lab', lab: 'Lab 3', time: '9 AM' },
        { date: '2026-06-11', subject: 'Java Programming Lab',  lab: 'Lab 1', time: '9 AM' },
        { date: '2026-06-12', subject: 'DBMS Lab',              lab: 'Lab 2', time: '2 PM' },
        { date: '2026-06-13', subject: 'Data Science Lab',      lab: 'Lab 4', time: '9 AM' },
        { date: '2026-06-14', subject: 'AI Lab',                lab: 'Lab 1', time: '2 PM' },
      ],
      instructions: [
        'Carry your Hall Ticket and College ID Card to every exam.',
        'Reach the exam hall at least 30 minutes before scheduled time.',
        'Mobile phones and electronic devices are strictly prohibited.',
        'Only blue or black ball-point pens are allowed. Pencils only for diagrams.',
        'Follow all college examination regulations.',
        'Any malpractice results in immediate disqualification.',
      ],
    });
    console.log('✅ Exam schedule seeded');
  } else {
    console.log('ℹ️  Exam schedule already exists, skipping');
  }

  // ── Fee Record ─────────────────────────────────────────
  const feeCount = await Fee.countDocuments({ student: student._id });
  if (feeCount === 0) {
    await Fee.create({
      student: student._id, studentId: student.studentId,
      semester: 'V', academicYear: '2025–2026',
      components: [
        { name: 'Tuition Fee', amount: 45000 },
        { name: 'Lab Fee',     amount: 5000  },
        { name: 'Library Fee', amount: 2000  },
        { name: 'Exam Fee',    amount: 3000  },
      ],
      total: 55000, dueDate: '2026-05-25', lateFine: 500,
      history: [
        { date: '2026-01-05', description: 'Semester V – Tuition Fee', amount: 45000, mode: 'Online', txn: 'TXN202601050001' },
        { date: '2026-01-05', description: 'Semester V – Lab Fee',     amount: 5000,  mode: 'Online', txn: 'TXN202601050002' },
        { date: '2026-01-10', description: 'Semester V – Library Fee', amount: 2000,  mode: 'DD',     txn: 'DD202601100001'  },
        { date: '2026-01-15', description: 'Semester V – Exam Fee',    amount: 3000,  mode: 'Online', txn: 'TXN202601150001' },
      ],
    });
    console.log('✅ Fee record seeded');
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
      { student: student._id, studentId: student.studentId, book: cnBook._id,    title: cnBook.title,    author: cnBook.author,    borrowedDate: '2026-06-08', dueDate: '2026-06-22', status: 'Active' },
      { student: student._id, studentId: student.studentId, book: cleanBook._id, title: cleanBook.title, author: cleanBook.author, borrowedDate: '2026-06-01', dueDate: '2026-06-15', status: 'Active' },
    ]);
    console.log('✅ 2 borrowed books seeded');
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

  console.log('\n🎓 Seed complete! You can now start the backend with: npm run dev');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
