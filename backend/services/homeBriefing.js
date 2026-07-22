// Personalized Student Home — assembles the landing-dashboard payload by reusing
// the existing Success Engine, exam, attendance, placement, notice and Copilot data.
// The structured widgets are deterministic (so the page always renders); the AI
// Daily Briefing prose layers Claude on top and falls back to a template when
// ANTHROPIC_API_KEY is not configured — same graceful pattern as aiAgent/summarizer.
const Anthropic     = require('@anthropic-ai/sdk');
const Exam          = require('../models/Exam');
const Notice        = require('../models/Notice');
const Conversation  = require('../models/Conversation');
const SuccessMetric = require('../models/SuccessMetric');
const { computeSuccess } = require('./successEngine');

const DAY = 24 * 3600 * 1000;
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

function greetingFor(date = new Date()) {
  // Anchor to IST so the greeting matches the student's clock regardless of server TZ.
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(date));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const gradeFor = (v) =>
  v >= 85 ? 'Excellent' :
  v >= 70 ? 'On Track' :
  v >= 50 ? 'Needs Attention' : 'At Risk';

// ── Exams ────────────────────────────────────────────────────────────────────
// Mirrors routes/exam.js cohort resolution (kept local so exam.js stays untouched).
async function resolveExam(user) {
  const { department, semester } = user;
  const candidates = await Exam.find({
    status: 'published',
    $or: [{ department: '' }, { department }],
  }).sort({ updatedAt: -1 });
  const scoped = candidates.filter(e => !e.semester || !semester || String(e.semester) === String(semester) || e.department === '');
  const pool = scoped.length ? scoped : candidates;
  return pool[0] || null;
}

function examWidget(exam) {
  if (!exam) return { hasData: false, upcoming: [] };
  const today = startOfToday();
  const upcoming = (exam.schedule || [])
    .map(s => {
      const dt = new Date(s.date);
      const valid = !isNaN(dt);
      return {
        subject: s.subject, code: s.code, session: s.session,
        date: s.date,
        daysUntil: valid ? Math.max(0, Math.round((dt - today) / DAY)) : null,
        _ts: valid ? dt.getTime() : Infinity,
        _future: valid ? dt >= today : true,
      };
    })
    .filter(s => s._future)
    .sort((a, b) => a._ts - b._ts)
    .slice(0, 5)
    .map(({ _ts, _future, ...rest }) => rest);
  return {
    hasData: true,
    semester: exam.semester,
    academicYear: exam.academicYear,
    theoryStart: exam.theoryStart || null,
    hallTicketAvailable: exam.hallTicketAvailable || null,
    upcoming,
  };
}

// ── Placement ─────────────────────────────────────────────────────────────────
// Representative campus recruiters with simple CGPA/attendance gates. Deterministic
// so the widget always renders; skills drive the "recommended skills" nudge only.
const COMPANY_POOL = [
  { name: 'TCS',        role: 'Systems Engineer',    minCgpa: 6.0, minAtt: 70 },
  { name: 'Wipro',      role: 'Project Engineer',    minCgpa: 6.0, minAtt: 70 },
  { name: 'Infosys',    role: 'Systems Engineer',    minCgpa: 6.5, minAtt: 75 },
  { name: 'Cognizant',  role: 'Programmer Analyst',  minCgpa: 6.5, minAtt: 75 },
  { name: 'Accenture',  role: 'Associate Engineer',  minCgpa: 6.5, minAtt: 75 },
  { name: 'Zoho',       role: 'Member Technical',    minCgpa: 7.0, minAtt: 75 },
  { name: 'Amazon',     role: 'SDE Intern',          minCgpa: 7.5, minAtt: 80 },
  { name: 'Freshworks', role: 'Software Engineer',   minCgpa: 7.5, minAtt: 80 },
];
const TARGET_SKILLS = ['Data Structures', 'System Design', 'React', 'Node.js', 'Cloud (AWS)', 'SQL', 'Python', 'Docker', 'Aptitude', 'Communication'];

function placementWidget(user, placement, cgpa, attPct) {
  const companies = COMPANY_POOL.map(c => {
    const eligible = cgpa >= c.minCgpa && (attPct ?? 0) >= c.minAtt;
    return {
      name: c.name, role: c.role, eligible,
      reason: eligible ? 'Eligible' : `Needs CGPA ≥ ${c.minCgpa} & attendance ≥ ${c.minAtt}%`,
    };
  });
  const have = new Set((user.skills || []).map(s => s.toLowerCase()));
  const recommendedSkills = TARGET_SKILLS.filter(s => !have.has(s.toLowerCase())).slice(0, 4);
  return {
    readiness: placement.score,
    riskLevel: placement.riskLevel,
    eligibleFor: placement.eligibleFor,
    skills: placement.skills,
    projects: placement.projects,
    eligibleCount: companies.filter(c => c.eligible).length,
    companies,
    recommendedSkills,
  };
}

// ── Smart Notice Feed (AI summaries already stored by the summarizer) ──────────
function audiencesFor(user) {
  const list = ['all', 'student'];
  if (user.department) list.push(user.department);
  return list;
}
async function noticeFeed(user) {
  const now = new Date();
  const notices = await Notice.find({
    status:   { $nin: ['draft', 'archived'] },
    isActive: { $ne: false },
    $and: [
      { $or: [{ audience: { $in: audiencesFor(user) } }, { audience: { $exists: false } }, { audience: null }] },
      { $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }] },
    ],
  }).sort({ pinned: -1, publishedAt: -1, createdAt: -1 }).limit(5);
  return notices.map(n => ({
    id: n._id, title: n.title, category: n.category,
    summary: n.summary || (n.content || '').slice(0, 160),
    aiPriority: n.aiPriority || 'medium',
    keyDates: n.keyDates || [],
    actionItems: (n.actionItems || []).slice(0, 3),
    publishedAt: n.publishedAt || n.createdAt,
    pinned: !!n.pinned,
  }));
}

// ── Recent Copilot activity ───────────────────────────────────────────────────
async function copilotWidget(user, ctx) {
  const conversations = await Conversation.find({ user: user._id })
    .sort({ lastMessageAt: -1 }).limit(4)
    .select('title lastMessageAt messageCount');
  // Context-aware suggested follow-ups derived from the student's current risks.
  const suggested = [];
  if (ctx.attendanceLow) suggested.push('How do I recover my attendance above 75%?');
  if (ctx.hasUpcomingExam) suggested.push('What is my exam schedule?');
  if (ctx.placementReadiness < 70) suggested.push('Am I placement ready?');
  suggested.push('How am I performing this semester?', 'What should I improve next?', 'Any new notices for me?');
  return {
    conversations: conversations.map(c => ({
      id: c._id, title: c.title, lastMessageAt: c.lastMessageAt, messageCount: c.messageCount,
    })),
    suggestedQuestions: [...new Set(suggested)].slice(0, 4),
  };
}

// ── Trends ────────────────────────────────────────────────────────────────────
async function insights(user, attendanceTrend) {
  const snaps = await SuccessMetric.find({ student: user._id }).sort({ snapshotDate: 1 }).limit(30);
  const map = (key) => snaps.map(s => ({ label: (s.snapshotDate || '').slice(5), value: s[key] ?? 0 }));
  return {
    successTrend:    map('successScore'),
    placementTrend:  map('placement'),
    attendanceTrend: snaps.length ? map('attendancePct') : (attendanceTrend || []),
  };
}

// ── Daily Briefing (deterministic structure + optional AI prose) ──────────────
function buildBriefing(student, success, exam) {
  const b = success.breakdown;
  const att = b.attendance, acad = b.academic, plc = b.placement;
  const below = (att.perSubject || []).filter(s => s.pct < 75);

  const academicStatus = acad.hasData
    ? `CGPA ${acad.cgpa} across ${acad.semesters.length} semester(s)` + (acad.backlogs ? `, ${acad.backlogs} backlog(s) to clear` : ', no backlogs')
    : 'No academic records yet.';

  let attendanceWarning = null;
  if (att.hasData && att.currentPct < 75)
    attendanceWarning = `Overall attendance is ${att.currentPct}% — below the 75% requirement. Attend every upcoming class.`;
  else if (below.length)
    attendanceWarning = `${below.length} subject(s) below 75%: ${below.map(s => `${s.subject} (${s.pct}%)`).join(', ')}.`;
  else if (att.hasData && att.currentPct < 85)
    attendanceWarning = `Attendance ${att.currentPct}% — keep it above 85% for a safety margin.`;

  const next = exam.upcoming?.[0];
  const upcomingExam = next
    ? `${next.subject}${next.daysUntil != null ? ` in ${next.daysUntil} day(s)` : ''}${next.date ? ` (${next.date})` : ''}.`
    : (exam.hasData ? 'No exams scheduled in the near term.' : null);

  const placementOpportunity = `Placement readiness ${plc.score}/100 — eligible for ${plc.eligibleFor.toLowerCase()}.`;

  // Recommended actions: top items from the success engine, capped.
  const actions = (success.recommendations || []).slice(0, 4);

  return { academicStatus, attendanceWarning, upcomingExam, placementOpportunity, actions };
}

function templateSummary(student, success, briefing) {
  const name = (student.name || 'there').split(' ')[0];
  const grade = gradeFor(success.successScore);
  const bits = [`${greetingFor()}, ${name}! Your success score is ${success.successScore}/100 (${grade}).`];
  if (briefing.attendanceWarning) bits.push(briefing.attendanceWarning);
  if (briefing.upcomingExam && success.breakdown.attendance.hasData) bits.push(`Up next: ${briefing.upcomingExam}`);
  bits.push(briefing.placementOpportunity);
  return bits.join(' ');
}

async function aiSummary(student, success, briefing) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { summary: templateSummary(student, success, briefing), aiGenerated: false };
  }
  try {
    const facts = [
      `Name: ${student.name}`,
      `Department: ${student.department || 'N/A'} | Semester: ${student.semester || 'N/A'}`,
      `Success score: ${success.successScore}/100 (${gradeFor(success.successScore)})`,
      `Academics: ${briefing.academicStatus}`,
      briefing.attendanceWarning ? `Attendance: ${briefing.attendanceWarning}` : 'Attendance: healthy (≥85%).',
      briefing.upcomingExam ? `Exams: ${briefing.upcomingExam}` : 'Exams: none scheduled.',
      `Placement: ${briefing.placementOpportunity}`,
    ].join('\n');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 220,
      system:
`You are CampusAssist Copilot writing a personalized daily briefing for a student.
Use ONLY the facts provided. Start with "${greetingFor()}, ${(student.name || '').split(' ')[0]}".
Write 2-3 warm, motivating sentences that summarize where they stand and what to focus on today.
Do not invent numbers, dates or companies. Output plain text only — no headings or bullet points.`,
      messages: [{ role: 'user', content: `FACTS:\n${facts}` }],
    });
    const text = (resp.content[0]?.text || '').trim();
    return text
      ? { summary: text, aiGenerated: true }
      : { summary: templateSummary(student, success, briefing), aiGenerated: false };
  } catch (err) {
    console.error('Home briefing AI error:', err.message);
    return { summary: templateSummary(student, success, briefing), aiGenerated: false };
  }
}

// ── Assemble the full home payload ────────────────────────────────────────────
async function buildHome(student) {
  const success = await computeSuccess(student);
  const b = success.breakdown;
  const exam = examWidget(await resolveExam(student));
  const briefing = buildBriefing(student, success, exam);
  const { summary, aiGenerated } = await aiSummary(student, success, briefing);

  const ctx = {
    attendanceLow: !!briefing.attendanceWarning,
    hasUpcomingExam: !!exam.upcoming.length,
    placementReadiness: b.placement.score,
  };

  const [notices, copilot, trends] = await Promise.all([
    noticeFeed(student),
    copilotWidget(student, ctx),
    insights(student, b.attendance.trend),
  ]);

  const below = (b.attendance.perSubject || []).filter(s => s.pct < 75);

  // Split the engine's flat recommendation list into the three requested buckets.
  const recs = success.recommendations || [];
  const pick = (kws) => recs.filter(r => kws.some(k => r.toLowerCase().includes(k)));
  const recommendations = {
    academic:   pick(['cgpa', 'backlog', 'assessment', 'semester', 'grade']),
    attendance: pick(['attendance', 'class', 'present', '75%']),
    placement:  pick(['skill', 'project', 'resume', 'interview', 'placement', 'copilot']),
  };

  return {
    student: {
      name: student.name, studentId: student.studentId,
      department: student.department, semester: student.semester || '',
      year: student.year || '',
    },
    greeting: greetingFor(),
    successScore: success.successScore,
    grade: gradeFor(success.successScore),
    briefing: { ...briefing, summary, aiGenerated },
    exams: exam,
    attendance: {
      overall: b.attendance.currentPct,
      riskLevel: b.attendance.riskLevel,
      prediction: b.attendance.prediction,
      hasData: b.attendance.hasData,
      belowThreshold: below,
      perSubject: b.attendance.perSubject,
    },
    placement: placementWidget(student, b.placement, b.academic.cgpa || 0, b.attendance.currentPct),
    notices,
    copilot,
    recommendations,
    insights: trends,
    risks: success.risks,
  };
}

module.exports = { buildHome };
