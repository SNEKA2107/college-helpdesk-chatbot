/**
 * dev-local.js  —  Full offline dev server (no Atlas needed)
 * Uses mongodb-memory-server. Data resets on every restart.
 * Usage: node dev-local.js
 */
'use strict';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose  = require('mongoose');
const bcrypt    = require('bcryptjs');

// ── Name pools (same as seed-students.js) ──────────────────────────────────
const MALE_FIRST = [
  'Aarav','Aakash','Abimanyu','Aditya','Ajay','Akash','Aravind','Arjun','Arun','Ashwin',
  'Balaji','Bharath','Bharathwaj','Bhuvanesh','Deepak','Dhanush','Dinesh','Ezhil','Ganesh','Gokul',
  'Gopinath','Gowtham','Guru','Hariharan','Hari','Hemanth','Inbam','Jagadeesh','Jeevan','Kaarthik',
  'Karthik','Kathirvel','Kishore','Krishnamurthy','Kumaresan','Lakshmanan','Lokesh','Mani','Manikandan','Manoj',
  'Mohan','Murugan','Muthu','Nithish','Pavan','Prabhu','Prasanth','Praveen','Rajan','Rajesh',
  'Rajkumar','Ram','Ramesh','Rishi','Rohith','Sachin','Santhosh','Saran','Selvam','Senthil',
  'Shanmugam','Siva','Srikanth','Suresh','Surya','Tamil','Thiru','Udhay','Vignesh','Vijay',
  'Vikram','Vinoth','Vishnu','Vivek','Yuvaraj','Harish','Karthikeyan','Madhan','Naveen','Saravanan',
  'Sivakumar','Soundar','Subash','Thirumaran','Venkatesh','Bala','Chandru','Durai','Elanchezhian','Guhan',
  'Ilayaraja','Jagan','Kalyan','Logesh','Monish','Narayanan','Palani','Pandian','Perumal','Prakash',
];
const FEMALE_FIRST = [
  'Abinaya','Akshaya','Akshara','Amritha','Ananya','Anitha','Aswini','Bhavani','Bhavya','Brindha',
  'Deepika','Dharani','Dhivya','Divya','Geetha','Gomathi','Harini','Hema','Indhu','Indhumathi',
  'Janani','Jansi','Jayalakshmi','Jeya','Jeyanthi','Kalpana','Kavitha','Kavya','Keerthana','Kiruthika',
  'Komala','Kousalya','Lavanya','Logambal','Madhumitha','Magalakshmi','Maheswari','Malarvizhi','Meenakshi','Mohana',
  'Nandhini','Nivetha','Nithya','Oviya','Padmavathi','Pavithra','Poorni','Preethi','Prema','Priyadharshini',
  'Radha','Rajasri','Ranjani','Rekha','Revathi','Sadhana','Sahana','Sandhya','Sangeetha','Sathya',
  'Shruthi','Sindhu','Sneka','Subashini','Suganya','Sumathi','Suriya','Swetha','Tamilarasi','Tamilselvi',
  'Thamarai','Thenmozhi','Uma','Umayal','Vanitha','Vasantha','Vidhya','Vijayalakshmi','Yamini','Yuvarani',
  'Aarthi','Bhagyalakshmi','Chandralekha','Devika','Eswari','Gayathri','Ilavarasi','Jothika','Kalaiselvi','Lakshmi',
  'Manimegalai','Narmadha','Poongothai','Rajalakshmi','Saranya','Thilagavathi','Vasuki','Vidhyalakshmi','Zara','Kanimozhi',
];
const SURNAMES = [
  'Arumugam','Balasubramanian','Chandran','Durai','Ezhilarasan','Govindarajan','Ilayaraja','Jayaraman','Karthikeyan','Kumar',
  'Lakshmi','Manikandan','Murugan','Narayanan','Palaniswami','Pandian','Perumal','Pillai','Prakash','Rajendran',
  'Raman','Ramachandran','Sakthi','Shankar','Subramanian','Sundaram','Thirumalai','Veerasamy','Venkataraman','Annamalai',
  'Balakrishnan','Chinnaswamy','Devarajan','Elango','Ganesan','Hariharan','Iyer','Jayakumar','Krishnaswamy','Lakshmanan',
  'Muthukrishnan','Natarajan','Palani','Ramalingam','Selvaraj','Thangavel','Udayakumar','Vasudevan','Xavier','Yuvaraj',
];

const DEPTS   = [
  { code:'21', name:'IT'            },
  { code:'22', name:'CSE'           },
  { code:'24', name:'AIDS'          },
  { code:'25', name:'AIML'          },
  { code:'20', name:'Bioinformatics'},
];
const BATCHES = [
  { year:'22', semester:'8th' },
  { year:'23', semester:'6th' },
  { year:'24', semester:'4th' },
  { year:'25', semester:'2nd' },
];

function resolveName(serial, groupIndex) {
  const isMale = serial <= 25;
  const pool   = isMale ? MALE_FIRST : FEMALE_FIRST;
  return {
    firstName: pool[((groupIndex * 7) + (serial - 1)) % pool.length],
    surname:   SURNAMES[((groupIndex * 13) + (serial - 1)) % SURNAMES.length],
  };
}
function roll(by, dc, s) { return `19${by}${dc}${String(s).padStart(3,'0')}`; }
function phone() {
  const p = ['6','7','8','9'][Math.floor(Math.random()*4)];
  let n = p; for(let i=0;i<9;i++) n+=Math.floor(Math.random()*10); return n;
}

// ── Seed ────────────────────────────────────────────────────────────────────
async function seed() {
  const User     = require('./models/User');
  const Notice   = require('./models/Notice');
  const Request  = require('./models/Request');
  const Leave    = require('./models/Leave');
  const Exam     = require('./models/Exam');
  const Fee      = require('./models/Fee');
  const Book     = require('./models/Book');
  const BorrowedBook = require('./models/BorrowedBook');
  const Timetable = require('./models/Timetable');

  console.log('🌱 Seeding data…');

  // ── Admin + demo student ─────────────────────────────────────────────────
  const admin = await User.create({
    name:'Admin User', studentId:'ADMIN01', email:'admin@college.edu',
    password:'admin@123', department:'Admin', semester:'', role:'admin',
  });
  const demoStudent = await User.create({
    name:'Sneka S', studentId:'22IT101', email:'sneka@college.edu',
    password:'student123', department:'IT', semester:'5th', role:'student', phone:'9876543210',
  });
  console.log('  ✅ Admin + demo student created');

  // ── 1000 students (pre-hash once, insertMany) ────────────────────────────
  console.log('  🔐 Pre-hashing password for bulk insert…');
  const hashed = await bcrypt.hash('student123', 12);
  const studentDocs = [];
  let gi = 0;
  for (const b of BATCHES) {
    for (const d of DEPTS) {
      for (let s = 1; s <= 50; s++) {
        const { firstName, surname } = resolveName(s, gi);
        const r = roll(b.year, d.code, s);
        studentDocs.push({
          name: `${firstName} ${surname}`,
          studentId:  r,
          email:      `${firstName.toLowerCase()}.${surname.toLowerCase()}.${r}@college.edu`,
          password:   hashed,
          department: d.name,
          semester:   b.semester,
          role:       'student',
          phone:      phone(),
          isActive:   true,
        });
      }
      gi++;
    }
  }
  await User.insertMany(studentDocs, { ordered: false });
  console.log(`  ✅ 1000 students inserted`);

  // ── A few ECE/MECH students (6th sem) so those faculty have a class to teach ──
  const extraStudents = [];
  [['ECE', 'ECE'], ['MECH', 'MEC']].forEach(([dept, tag], di) => {
    for (let s = 1; s <= 15; s++) {
      const { firstName, surname } = resolveName(s, 41 + di);
      const r = `23${tag}6${String(s).padStart(3, '0')}`.toUpperCase();
      extraStudents.push({
        name: `${firstName} ${surname}`, studentId: r,
        email: `${firstName.toLowerCase()}.${r.toLowerCase()}@college.edu`,
        password: hashed, department: dept, semester: '6th', role: 'student', phone: phone(), isActive: true,
      });
    }
  });
  await User.insertMany(extraStudents, { ordered: false });

  // ── Sample faculty (portal login) — one per requested department ─────────────
  const FACULTY = [
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
  for (const f of FACULTY) await User.create({ ...f, password: 'faculty123', role: 'faculty', semester: '' });
  console.log('  ✅ 4 faculty (FAC01–FAC04, pw: faculty123) + ECE/MECH students created');

  // ── Notices ──────────────────────────────────────────────────────────────
  await Notice.insertMany([
    { title:'Fee Payment Deadline – Final Reminder', content:'Last date for Semester V fee payment is May 25 2026. Students who fail to pay will not be allowed to write exams.', category:'urgent', postedBy:'Admin', pinned:true },
    { title:'Semester V Examination Schedule Released', content:'Theory exams begin June 15 2026. Hall tickets downloadable from June 10.', category:'exam', postedBy:'Exam Cell', pinned:false },
    { title:'Internal Marks Published', content:'Semester V internal marks published. Re-evaluation requests within 3 working days.', category:'general', postedBy:'Academic Section', pinned:false },
    { title:'College Holiday – May 30 2026', content:'College closed on May 30 2026. All classes and labs cancelled.', category:'holiday', postedBy:'Admin', pinned:false },
    { title:'Scholarship Application Open', content:'Merit-cum-Means Scholarship 2026–27 open. Last date June 5 2026.', category:'fee', postedBy:'Admin', pinned:false },
  ]);
  console.log('  ✅ Notices seeded');

  // ── Requests ─────────────────────────────────────────────────────────────
  await Request.create([
    { student:demoStudent._id, studentId:demoStudent.studentId, type:'Bonafide Certificate', purpose:'Bank loan application', urgency:'Normal',  status:'Completed'  },
    { student:demoStudent._id, studentId:demoStudent.studentId, type:'Marksheet',            purpose:'Job application',        urgency:'Urgent',  status:'Processing' },
    { student:demoStudent._id, studentId:demoStudent.studentId, type:'Conduct Certificate',  purpose:'Scholarship application',urgency:'Normal',  status:'Submitted'  },
  ]);
  console.log('  ✅ Requests seeded');

  // ── Leave applications ────────────────────────────────────────────────────
  await Leave.create([
    { student:demoStudent._id, studentId:demoStudent.studentId, name:demoStudent.name, department:'IT', semester:'5th', leaveType:'Medical Leave',  fromDate:new Date('2026-05-29'), toDate:new Date('2026-05-30'), reason:'Fever and cold, doctor advised rest.', status:'Pending' },
    { student:demoStudent._id, studentId:demoStudent.studentId, name:demoStudent.name, department:'IT', semester:'5th', leaveType:'Personal Leave', fromDate:new Date('2026-06-02'), toDate:new Date('2026-06-03'), reason:'Family function attendance.', status:'Pending' },
  ]);
  console.log('  ✅ Leave applications seeded');

  // ── Exam schedule ─────────────────────────────────────────────────────────
  await Exam.create({
    semester:'V', academicYear:'2025–2026',
    theoryStart:'2026-06-15', theoryEnd:'2026-06-28', hallTicketAvailable:'2026-06-10',
    schedule:[
      { date:'2026-06-15', subject:'Java Programming',        code:'21CS301', session:'Morning (10 AM)' },
      { date:'2026-06-17', subject:'Database Management',     code:'21CS302', session:'Morning (10 AM)' },
      { date:'2026-06-19', subject:'Computer Networks',       code:'21CS303', session:'Afternoon (2 PM)'},
      { date:'2026-06-21', subject:'Artificial Intelligence', code:'21CS304', session:'Morning (10 AM)' },
      { date:'2026-06-23', subject:'Mathematics – III',       code:'21MA301', session:'Morning (10 AM)' },
      { date:'2026-06-25', subject:'Python Programming',      code:'21CS305', session:'Afternoon (2 PM)'},
      { date:'2026-06-28', subject:'Open Elective',           code:'21OE301', session:'Morning (10 AM)' },
    ],
    practicals:[
      { date:'2026-06-10', subject:'Computer Networks Lab', lab:'Lab 3', time:'9 AM' },
      { date:'2026-06-11', subject:'Java Programming Lab',  lab:'Lab 1', time:'9 AM' },
      { date:'2026-06-12', subject:'DBMS Lab',              lab:'Lab 2', time:'2 PM' },
    ],
    instructions:[
      'Carry your Hall Ticket and College ID to every exam.',
      'Arrive at least 30 minutes before scheduled time.',
      'Mobile phones strictly prohibited.',
    ],
  });
  console.log('  ✅ Exam schedule seeded');

  // ── Fee record ────────────────────────────────────────────────────────────
  await Fee.create({
    student:demoStudent._id, studentId:demoStudent.studentId,
    semester:'V', academicYear:'2025–2026',
    components:[
      { name:'Tuition Fee', amount:45000 },
      { name:'Lab Fee',     amount:5000  },
      { name:'Library Fee', amount:2000  },
      { name:'Exam Fee',    amount:3000  },
    ],
    total:55000, dueDate:'2026-05-25', lateFine:500,
    history:[
      { date:'2026-01-05', description:'Semester V – Tuition Fee', amount:45000, mode:'Online', txn:'TXN202601050001' },
      { date:'2026-01-05', description:'Semester V – Lab Fee',     amount:5000,  mode:'Online', txn:'TXN202601050002' },
      { date:'2026-01-10', description:'Semester V – Library Fee', amount:2000,  mode:'DD',     txn:'DD202601100001'  },
      { date:'2026-01-15', description:'Semester V – Exam Fee',    amount:3000,  mode:'Online', txn:'TXN202601150001' },
    ],
  });
  console.log('  ✅ Fee record seeded');

  // ── Books ─────────────────────────────────────────────────────────────────
  const books = await Book.insertMany([
    { title:'Introduction to Java',                       author:'James Gosling',        isbn:'978-0132777681', category:'Programming',   status:'Available', copies:3 },
    { title:'Database System Concepts',                   author:'Abraham Silberschatz', isbn:'978-0078022159', category:'DBMS',           status:'Available', copies:2 },
    { title:'Artificial Intelligence: A Modern Approach', author:'Stuart Russell',       isbn:'978-0136042594', category:'AI / ML',        status:'Borrowed',  copies:1 },
    { title:'Computer Networks',                          author:'Andrew Tanenbaum',     isbn:'978-0132126953', category:'Networking',     status:'Available', copies:4 },
    { title:'Python Crash Course',                        author:'Eric Matthes',         isbn:'978-1593279288', category:'Python',         status:'Available', copies:3 },
    { title:'Clean Code',                                 author:'Robert C. Martin',     isbn:'978-0132350884', category:'Software Eng.', status:'Available', copies:2 },
  ]);
  const cnBook = books.find(b => b.title === 'Computer Networks');
  await BorrowedBook.create({ student:demoStudent._id, studentId:demoStudent.studentId, book:cnBook._id, title:cnBook.title, author:cnBook.author, borrowedDate:'2026-06-08', dueDate:'2026-06-22', status:'Active' });
  console.log('  ✅ Books seeded');

  // ── Timetable ─────────────────────────────────────────────────────────────
  await Timetable.create({
    department:'IT', semester:'5th', academicYear:'2025–2026',
    slots:['9–10 AM','10–11 AM','11–12 PM','12–1 PM','1–2 PM','2–3 PM','3–4 PM'],
    schedule:{
      Monday:   ['Java','DBMS','CN','Lunch','AI','Lab','Lab'],
      Tuesday:  ['Python','Java','Maths','Lunch','AI','Lab','Lab'],
      Wednesday:['DBMS','CN','Java','Lunch','Python','Seminar','Seminar'],
      Thursday: ['Maths','AI','DBMS','Lunch','CN','Lab','Lab'],
      Friday:   ['Java','Python','Maths','Lunch','DBMS','Project','Project'],
      Saturday: ['Tutorial','Tutorial','Tutorial','Lunch','-','-','-'],
      Sunday:   [],
    },
    subjectDetails:{
      Java:   { name:'Java Programming',        code:'21CS301', faculty:'Dr. Anand Kumar',  room:'Room 201' },
      DBMS:   { name:'Database Management',     code:'21CS302', faculty:'Prof. Meena Devi', room:'Room 204' },
      CN:     { name:'Computer Networks',       code:'21CS303', faculty:'Dr. Raj Patel',    room:'Room 201' },
      AI:     { name:'Artificial Intelligence', code:'21CS304', faculty:'Dr. Kavitha S',    room:'Room 202' },
      Python: { name:'Python Programming',      code:'21CS305', faculty:'Prof. Sundar M',   room:'Room 203' },
      Maths:  { name:'Mathematics – III',       code:'21MA301', faculty:'Dr. Priya R',      room:'Room 205' },
    },
  });
  console.log('  ✅ Timetable seeded');

  console.log('\n🎓 All data seeded successfully!\n');
}

// ── Start ────────────────────────────────────────────────────────────────────
async function start() {
  console.log('🗄️  Starting in-memory MongoDB…');
  const mongod = await MongoMemoryServer.create();
  const uri    = mongod.getUri() + 'campusassist';
  process.env.MONGO_URI   = uri;
  process.env.JWT_SECRET  = 'local-dev-secret-2026';
  process.env.NODE_ENV       = 'development';
  process.env.PORT           = '5000';
  process.env.FRONTEND_URL   = 'http://localhost:5000';
  process.env.AUTH_RATE_LIMIT = '200';

  await mongoose.connect(uri);
  console.log('✅ In-memory MongoDB ready\n');

  await seed();
  require('./server');
}

start().catch(err => { console.error('❌ Failed to start:', err); process.exit(1); });
