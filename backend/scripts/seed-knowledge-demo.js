// Seeds Phase 7 demo data: Faculty Directory + Knowledge Documents (idempotent).
// Run: node scripts/seed-knowledge-demo.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Faculty = require('../models/Faculty');
const KnowledgeDocument = require('../models/KnowledgeDocument');

const FACULTY = [
  { name: 'Dr. Meera Krishnan', department: 'IT', designation: 'Professor', isHOD: true,
    email: 'meera.hod@college.edu', phone: '044-2345-1001', officeLocation: 'Block A, Room 201',
    subjects: ['Computer Networks', 'Cloud Computing'] },
  { name: 'Dr. Arun Prakash', department: 'IT', designation: 'Associate Professor',
    email: 'arun.ml@college.edu', officeLocation: 'Block B, Room 105',
    subjects: ['Machine Learning', 'Artificial Intelligence', 'Deep Learning'] },
  { name: 'Prof. Divya Ramesh', department: 'IT', designation: 'Assistant Professor',
    email: 'divya.ds@college.edu', officeLocation: 'Block B, Room 110',
    subjects: ['Data Structures', 'Algorithms', 'Python Programming'] },
  { name: 'Dr. Karthik Subramanian', department: 'CSE', designation: 'Professor',
    email: 'karthik@college.edu', officeLocation: 'Block C, Room 304',
    subjects: ['Database Systems', 'Operating Systems'] },
];

const DOCUMENTS = [
  { title: 'Attendance Regulations 2026', category: 'Attendance', docType: 'regulation', section: '§4 Condonation Policy',
    description: 'Minimum attendance rules and medical condonation procedure.',
    tags: ['attendance', 'condonation', '75%'],
    content: 'Students must maintain a minimum of 75% attendance in every subject to be eligible to write the end-semester examination. Students with attendance between 65% and 74% may apply for condonation by submitting a medical certificate and paying the condonation fee. Attendance below 65% will result in the student being detained and required to repeat the course.' },
  { title: 'Campus Placement Policy 2026', category: 'Placements', docType: 'placement-policy', section: 'Eligibility & One-Offer Rule',
    description: 'Eligibility criteria and conduct rules for campus recruitment.',
    tags: ['placement', 'eligibility', 'offer'],
    content: 'To participate in campus placements, a student must have a CGPA of at least 6.0 with no standing arrears at the time of the drive. Once a student accepts an offer, they are not eligible for further placement drives (one-offer rule), except for dream companies with a package above 10 LPA. Formal dress code is mandatory for all interviews.' },
  { title: 'Student Handbook — Examinations', category: 'Exams', docType: 'handbook', section: 'Chapter 3: Examinations',
    description: 'Hall ticket, revaluation and supplementary exam rules.',
    tags: ['exam', 'hall ticket', 'revaluation'],
    content: 'Hall tickets are issued only to students who have cleared their fees and met the attendance requirement. Hall tickets can be downloaded from the student portal one week before the examination. Students may apply for revaluation within seven working days of result publication. Supplementary examinations for arrear subjects are conducted in the subsequent semester.' },
  { title: 'Merit Scholarship FAQ', category: 'Scholarships', docType: 'faq', section: 'Merit Scholarships',
    description: 'Common questions about merit and need-based scholarships.',
    tags: ['scholarship', 'merit', 'financial aid'],
    content: 'Merit scholarships are awarded to the top 5% of students in each department based on the previous semester CGPA. The application window opens at the start of every academic year and closes on 31 August. Need-based scholarships require an income certificate. Scholarship amounts are credited directly to the student bank account after verification.' },
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { tls: true });
  console.log('Connected. Seeding Phase 7 knowledge demo data…');

  for (const f of FACULTY) {
    await Faculty.findOneAndUpdate({ name: f.name }, f, { upsert: true, setDefaultsOnInsert: true });
  }
  console.log(`  ✓ ${FACULTY.length} faculty members`);

  for (const d of DOCUMENTS) {
    await KnowledgeDocument.findOneAndUpdate(
      { title: d.title },
      { ...d, status: 'published', uploadedBy: 'Seed' },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }
  console.log(`  ✓ ${DOCUMENTS.length} knowledge documents`);

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(e => { console.error('Seed failed:', e.message); process.exit(1); });
