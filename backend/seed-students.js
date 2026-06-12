/**
 * seed-students.js
 * Generates 1000 realistic Indian students across 5 departments × 4 batches.
 *
 * Roll-number format:  19[YY][DD][NNN]
 *   19  = college prefix (fixed)
 *   YY  = 2-digit joining year  (22 / 23 / 24 / 25)
 *   DD  = department code       (20=BIO | 21=IT | 22=CSE | 24=AIDS | 25=AIML)
 *   NNN = 3-digit serial        (001–050 per batch-dept group)
 *
 * Examples
 *   192325010  → AIML, batch 2023, serial 010  (Kanish-style)
 *   192221001  → IT,   batch 2022, serial 001
 *
 * Credentials for every generated student
 *   Password : student123
 *
 * Usage:  node seed-students.js
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('./models/User');

// ── Name pools ──────────────────────────────────────────────────────────────

const MALE_FIRST = [
  'Aarav',        'Aakash',        'Abimanyu',      'Aditya',        'Ajay',
  'Akash',        'Aravind',       'Arjun',          'Arun',          'Ashwin',
  'Balaji',       'Bharath',       'Bharathwaj',     'Bhuvanesh',     'Deepak',
  'Dhanush',      'Dinesh',        'Ezhil',          'Ganesh',        'Gokul',
  'Gopinath',     'Gowtham',       'Guru',           'Hariharan',     'Hari',
  'Hemanth',      'Inbam',         'Jagadeesh',      'Jeevan',        'Kaarthik',
  'Karthik',      'Kathirvel',     'Kishore',        'Krishnamurthy', 'Kumaresan',
  'Lakshmanan',   'Lokesh',        'Mani',           'Manikandan',    'Manoj',
  'Mohan',        'Murugan',       'Muthu',          'Nithish',       'Pavan',
  'Prabhu',       'Prasanth',      'Praveen',        'Rajan',         'Rajesh',
  'Rajkumar',     'Ram',           'Ramesh',         'Rishi',         'Rohith',
  'Sachin',       'Santhosh',      'Saran',          'Selvam',        'Senthil',
  'Shanmugam',    'Siva',          'Srikanth',       'Suresh',        'Surya',
  'Tamil',        'Thiru',         'Udhay',          'Vignesh',       'Vijay',
  'Vikram',       'Vinoth',        'Vishnu',         'Vivek',         'Yuvaraj',
  'Harish',       'Karthikeyan',   'Madhan',         'Naveen',        'Saravanan',
  'Sivakumar',    'Soundar',       'Subash',         'Thirumaran',    'Venkatesh',
  'Bala',         'Chandru',       'Durai',          'Elanchezhian',  'Guhan',
  'Ilayaraja',    'Jagan',         'Kalyan',         'Logesh',        'Monish',
  'Narayanan',    'Palani',        'Pandian',        'Perumal',       'Prakash',
];

const FEMALE_FIRST = [
  'Abinaya',       'Akshaya',        'Akshara',        'Amritha',       'Ananya',
  'Anitha',        'Aswini',         'Bhavani',        'Bhavya',        'Brindha',
  'Deepika',       'Dharani',        'Dhivya',         'Divya',         'Geetha',
  'Gomathi',       'Harini',         'Hema',           'Indhu',         'Indhumathi',
  'Janani',        'Jansi',          'Jayalakshmi',    'Jeya',          'Jeyanthi',
  'Kalpana',       'Kavitha',        'Kavya',          'Keerthana',     'Kiruthika',
  'Komala',        'Kousalya',       'Lavanya',        'Logambal',      'Madhumitha',
  'Magalakshmi',   'Maheswari',      'Malarvizhi',     'Meenakshi',     'Mohana',
  'Nandhini',      'Nivetha',        'Nithya',         'Oviya',         'Padmavathi',
  'Pavithra',      'Poorni',         'Preethi',        'Prema',         'Priyadharshini',
  'Radha',         'Rajasri',        'Ranjani',        'Rekha',         'Revathi',
  'Sadhana',       'Sahana',         'Sandhya',        'Sangeetha',     'Sathya',
  'Shruthi',       'Sindhu',         'Sneka',          'Subashini',     'Suganya',
  'Sumathi',       'Suriya',         'Swetha',         'Tamilarasi',    'Tamilselvi',
  'Thamarai',      'Thenmozhi',      'Uma',            'Umayal',        'Vanitha',
  'Vasantha',      'Vidhya',         'Vijayalakshmi',  'Yamini',        'Yuvarani',
  'Aarthi',        'Bhagyalakshmi',  'Chandralekha',   'Devika',        'Eswari',
  'Gayathri',      'Ilavarasi',      'Jothika',        'Kalaiselvi',    'Lakshmi',
  'Manimegalai',   'Narmadha',       'Poongothai',     'Rajalakshmi',   'Saranya',
  'Thilagavathi',  'Vasuki',         'Vidhyalakshmi',  'Zara',          'Kanimozhi',
];

const SURNAMES = [
  'Arumugam',       'Balasubramanian', 'Chandran',       'Durai',         'Ezhilarasan',
  'Govindarajan',   'Ilayaraja',       'Jayaraman',      'Karthikeyan',   'Kumar',
  'Lakshmi',        'Manikandan',      'Murugan',        'Narayanan',     'Palaniswami',
  'Pandian',        'Perumal',         'Pillai',         'Prakash',       'Rajendran',
  'Raman',          'Ramachandran',    'Sakthi',         'Shankar',       'Subramanian',
  'Sundaram',       'Thirumalai',      'Veerasamy',      'Venkataraman',  'Annamalai',
  'Balakrishnan',   'Chinnaswamy',     'Devarajan',      'Elango',        'Ganesan',
  'Hariharan',      'Iyer',            'Jayakumar',      'Krishnaswamy',  'Lakshmanan',
  'Muthukrishnan',  'Natarajan',       'Palani',         'Ramalingam',    'Selvaraj',
  'Thangavel',      'Udayakumar',      'Vasudevan',      'Xavier',        'Yuvaraj',
];

// ── Department config ────────────────────────────────────────────────────────

const DEPTS = [
  { code: '21', name: 'IT',             label: 'Information Technology'       },
  { code: '22', name: 'CSE',            label: 'Computer Science Engineering' },
  { code: '24', name: 'AIDS',           label: 'AI and Data Science'          },
  { code: '25', name: 'AIML',           label: 'AI and Machine Learning'      },
  { code: '20', name: 'Bioinformatics', label: 'Bioinformatics'               },
];

const BATCHES = [
  { year: '22', joinYear: 2022, semester: '8th' },
  { year: '23', joinYear: 2023, semester: '6th' },
  { year: '24', joinYear: 2024, semester: '4th' },
  { year: '25', joinYear: 2025, semester: '2nd' },
];

const COLLEGE_PREFIX   = '19';
const STUDENTS_PER_GROUP = 50;   // 4 batches × 5 depts × 50 = 1000 total

// ── Helper utilities ─────────────────────────────────────────────────────────

/**
 * Returns a deterministic { firstName, surname } for a given global index.
 * Serials 1–25 in every group → male; 26–50 → female.
 */
function resolveName(serial, groupIndex) {
  const isMale = serial <= 25;
  const pool   = isMale ? MALE_FIRST : FEMALE_FIRST;
  // Use group index and serial so each group gets different names
  const firstIdx = ((groupIndex * 7) + (serial - 1)) % pool.length;
  const surIdx   = ((groupIndex * 13) + (serial - 1)) % SURNAMES.length;
  return { firstName: pool[firstIdx], surname: SURNAMES[surIdx] };
}

function buildRollNo(batchYear, deptCode, serial) {
  return `${COLLEGE_PREFIX}${batchYear}${deptCode}${String(serial).padStart(3, '0')}`;
}

function buildEmail(firstName, surname, roll) {
  const slug = `${firstName}.${surname}`.toLowerCase().replace(/[^a-z.]/g, '');
  return `${slug}.${roll}@college.edu`;
}

function randomPhone() {
  const prefix  = ['6', '7', '8', '9'][Math.floor(Math.random() * 4)];
  let num = prefix;
  for (let i = 0; i < 9; i++) num += Math.floor(Math.random() * 10);
  return num;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function seedStudents() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB Atlas\n');

  // Pre-hash the shared password once (bcrypt with 12 rounds = ~250 ms)
  console.log('🔐 Pre-hashing shared password …');
  const hashedPassword = await bcrypt.hash('student123', 12);
  console.log('   Done.\n');

  // Build documents
  const docs = [];
  let groupIndex = 0;

  for (const batch of BATCHES) {
    for (const dept of DEPTS) {
      for (let serial = 1; serial <= STUDENTS_PER_GROUP; serial++) {
        const { firstName, surname } = resolveName(serial, groupIndex);
        const fullName = `${firstName} ${surname}`;
        const roll     = buildRollNo(batch.year, dept.code, serial);

        docs.push({
          name:       fullName,
          studentId:  roll,
          email:      buildEmail(firstName, surname, roll),
          password:   hashedPassword,
          department: dept.name,
          semester:   batch.semester,
          role:       'student',
          phone:      randomPhone(),
          isActive:   true,
        });
      }
      groupIndex++;
    }
  }

  // Skip any roll numbers already present in the database
  const existing = await User.find({ role: 'student' }).select('studentId').lean();
  const existingSet = new Set(existing.map(u => u.studentId));
  const toInsert = docs.filter(d => !existingSet.has(d.studentId));

  const skipped = docs.length - toInsert.length;
  console.log(`📊 Total students built : ${docs.length}`);
  console.log(`   Already in DB        : ${skipped}`);
  console.log(`   To be inserted       : ${toInsert.length}\n`);

  if (toInsert.length === 0) {
    console.log('ℹ️  All 1000 students already exist. Nothing to insert.');
    await mongoose.disconnect();
    process.exit(0);
  }

  // insertMany bypasses Mongoose pre-save hooks intentionally —
  // password was hashed above before building the documents.
  const result = await User.insertMany(toInsert, { ordered: false });
  console.log(`✅ Successfully inserted ${result.length} students!\n`);

  // ── Summary table ──────────────────────────────────────────────────────────
  console.log('── Batch × Department Distribution ──────────────────────────────────');
  console.log(
    '  Batch'.padEnd(10) +
    'Dept'.padEnd(18) +
    'Semester'.padEnd(12) +
    'Roll Range'.padEnd(26) +
    'Count'
  );
  console.log('  ' + '─'.repeat(72));

  for (const batch of BATCHES) {
    for (const dept of DEPTS) {
      const first = buildRollNo(batch.year, dept.code, 1);
      const last  = buildRollNo(batch.year, dept.code, STUDENTS_PER_GROUP);
      console.log(
        `  ${batch.joinYear}`.padEnd(10) +
        dept.name.padEnd(18) +
        batch.semester.padEnd(12) +
        `${first} – ${last}`.padEnd(26) +
        `${STUDENTS_PER_GROUP}`
      );
    }
    console.log('  ' + '─'.repeat(72));
  }

  console.log(`\n  GRAND TOTAL : ${result.length} students across ${BATCHES.length} batches × ${DEPTS.length} departments`);
  console.log('\n🔑 Default password for all students : student123');
  console.log('👤 Admin login remains                : ADMIN01 / admin@123');
  console.log('\n🎓 Student seed complete!\n');

  await mongoose.disconnect();
  process.exit(0);
}

seedStudents().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
