/**
 * Shared demo exam cohort definitions — used by seed.js (fresh DB) and
 * scripts/refresh-demo-data.js (live DB) so both produce identical,
 * department-accurate, relative-dated exams. Single source of truth.
 */
const EXAM_INSTRUCTIONS = [
  'Carry your Hall Ticket and College ID Card to every exam. Entry is denied without both.',
  'Reach the exam hall at least 30 minutes before the scheduled time.',
  'Mobile phones, smartwatches and electronic devices are strictly prohibited.',
  'Only blue or black ball-point pens are allowed. Pencils only for diagrams.',
  'Follow all college examination regulations as per the student handbook.',
  'Any malpractice results in immediate disqualification and disciplinary action.',
];

const CS_SUBJECTS = [
  { subject: 'Java Programming', code: '21CS301' }, { subject: 'Database Management Systems', code: '21CS302' },
  { subject: 'Computer Networks', code: '21CS303' }, { subject: 'Operating Systems', code: '21CS304' },
  { subject: 'Theory of Computation', code: '21CS305' }, { subject: 'Mathematics – III', code: '21MA301' },
  { subject: 'Open Elective', code: '21OE301' },
];
const CS_PRACTICALS = [
  { subject: 'Java Programming Lab', lab: 'Lab 1' }, { subject: 'DBMS Lab', lab: 'Lab 2' }, { subject: 'Networks Lab', lab: 'Lab 3' },
];
const ECE_SUBJECTS = [
  { subject: 'Digital Signal Processing', code: '21EC301' }, { subject: 'Analog Communication', code: '21EC302' },
  { subject: 'Microprocessors & Controllers', code: '21EC303' }, { subject: 'Electromagnetic Fields', code: '21EC304' },
  { subject: 'Control Systems', code: '21EC305' }, { subject: 'Mathematics – III', code: '21MA301' },
  { subject: 'Open Elective', code: '21OE301' },
];
const ECE_PRACTICALS = [
  { subject: 'DSP Lab', lab: 'Lab 1' }, { subject: 'Communication Lab', lab: 'Lab 2' }, { subject: 'Microprocessor Lab', lab: 'Lab 3' },
];
const CIVIL_SUBJECTS = [
  { subject: 'Structural Analysis', code: '21CE301' }, { subject: 'Surveying – II', code: '21CE302' },
  { subject: 'Concrete Technology', code: '21CE303' }, { subject: 'Fluid Mechanics', code: '21CE304' },
  { subject: 'Geotechnical Engineering', code: '21CE305' }, { subject: 'Mathematics – III', code: '21MA301' },
  { subject: 'Open Elective', code: '21OE301' },
];
const CIVIL_PRACTICALS = [
  { subject: 'Survey Field Lab', lab: 'Field' }, { subject: 'Concrete & Materials Lab', lab: 'Materials Lab' }, { subject: 'Geotechnical Lab', lab: 'Soil Lab' },
];

const COHORTS = {
  IT:    { subjects: CS_SUBJECTS,    practicals: CS_PRACTICALS },
  CSE:   { subjects: CS_SUBJECTS,    practicals: CS_PRACTICALS },
  ECE:   { subjects: ECE_SUBJECTS,   practicals: ECE_PRACTICALS },
  CIVIL: { subjects: CIVIL_SUBJECTS, practicals: CIVIL_PRACTICALS },
};
const DEMO_EXAM_DEPARTMENTS = Object.keys(COHORTS);

/**
 * Build a published, relative-dated exam doc for one department.
 * @param department  one of DEMO_EXAM_DEPARTMENTS
 * @param helpers     { ymd(offset)→'YYYY-MM-DD', dRel(offset)→Date, academicYear }
 */
function buildExam(department, { ymd, dRel, academicYear }) {
  const { subjects, practicals } = COHORTS[department];
  return {
    department, semester: '5th', academicYear,
    status: 'published', publishedAt: dRel(-1),
    theoryStart: ymd(14), theoryEnd: ymd(14 + (subjects.length - 1) * 2), hallTicketAvailable: ymd(9),
    schedule: subjects.map((s, i) => ({ date: ymd(14 + i * 2), subject: s.subject, code: s.code, session: i % 2 ? 'Afternoon (2 PM)' : 'Morning (10 AM)' })),
    practicals: practicals.map((p, i) => ({ date: ymd(9 + i), subject: p.subject, lab: p.lab, time: i % 2 ? '2 PM' : '9 AM' })),
    instructions: EXAM_INSTRUCTIONS,
  };
}

module.exports = { COHORTS, DEMO_EXAM_DEPARTMENTS, EXAM_INSTRUCTIONS, buildExam };
