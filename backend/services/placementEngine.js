// Placement Hub engine (Phase 6) — turns the existing success/profile/CGPA/
// attendance/skills data into placement readiness, company eligibility, skill-gap
// analysis, resume strength, ranked recommendations, an interview-prep plan and
// trend series. Deterministic core (always demos) with an optional Claude layer
// for the interview plan — same graceful-fallback pattern as aiAgent/summarizer.
const Anthropic     = require('@anthropic-ai/sdk');
const SuccessMetric = require('../models/SuccessMetric');
const { computeSuccess } = require('./successEngine');

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

// ── Recruiter catalog ─────────────────────────────────────────────────────────
// Representative on-campus recruiters with eligibility gates + the skills each
// drive screens for. Used by the eligibility checker, skill-gap and recommender.
const COMPANIES = [
  { name: 'TCS',        role: 'Systems Engineer',   sector: 'IT Services', ctc: 3.6,  minCgpa: 6.0, minAtt: 70, maxBacklogs: 1, skills: ['Java', 'SQL', 'Operating Systems'] },
  { name: 'Wipro',      role: 'Project Engineer',   sector: 'IT Services', ctc: 3.5,  minCgpa: 6.0, minAtt: 70, maxBacklogs: 1, skills: ['Java', 'SQL', 'Communication'] },
  { name: 'Capgemini',  role: 'Analyst',            sector: 'IT Services', ctc: 3.8,  minCgpa: 6.0, minAtt: 70, maxBacklogs: 0, skills: ['Java', 'SQL', 'Aptitude'] },
  { name: 'Infosys',    role: 'Systems Engineer',   sector: 'IT Services', ctc: 4.0,  minCgpa: 6.5, minAtt: 75, maxBacklogs: 0, skills: ['Java', 'Python', 'DBMS'] },
  { name: 'Cognizant',  role: 'Programmer Analyst', sector: 'IT Services', ctc: 4.0,  minCgpa: 6.5, minAtt: 75, maxBacklogs: 0, skills: ['Java', 'React', 'SQL'] },
  { name: 'Accenture',  role: 'Associate SE',       sector: 'Consulting',  ctc: 4.5,  minCgpa: 6.5, minAtt: 75, maxBacklogs: 0, skills: ['Cloud (AWS)', 'SQL', 'Communication'] },
  { name: 'Zoho',       role: 'Member Technical',   sector: 'Product',     ctc: 6.5,  minCgpa: 7.0, minAtt: 75, maxBacklogs: 0, skills: ['Data Structures', 'Python', 'DBMS'] },
  { name: 'Freshworks', role: 'Software Engineer',  sector: 'Product',     ctc: 9.0,  minCgpa: 7.5, minAtt: 80, maxBacklogs: 0, skills: ['React', 'Node.js', 'Data Structures'] },
  { name: 'Amazon',     role: 'SDE Intern',         sector: 'Product',     ctc: 12.0, minCgpa: 7.5, minAtt: 80, maxBacklogs: 0, skills: ['Data Structures', 'System Design', 'Java'] },
  { name: 'Microsoft',  role: 'Software Engineer',  sector: 'Product',     ctc: 16.0, minCgpa: 8.0, minAtt: 80, maxBacklogs: 0, skills: ['Data Structures', 'System Design', 'C++'] },
];

// Industry-relevant skills grouped for the skill-gap matrix.
const SKILL_CATALOG = {
  'Programming':      ['Java', 'Python', 'C++', 'JavaScript'],
  'CS Fundamentals':  ['Data Structures', 'Algorithms', 'Operating Systems', 'DBMS', 'Computer Networks'],
  'Web & Cloud':      ['React', 'Node.js', 'SQL', 'Cloud (AWS)', 'Docker'],
  'Aptitude & Soft':  ['Aptitude', 'System Design', 'Communication'],
};
const ALL_TARGET_SKILLS = Object.values(SKILL_CATALOG).flat();

const norm = (s) => String(s).toLowerCase().trim();
const hasSkill = (set, skill) => set.has(norm(skill));

// ── Readiness score (reuses the Success Engine placement block) ───────────────
function readinessBlock(success, cgpa, attPct) {
  const p = success.breakdown.placement;
  // Expose the same component sub-scores the engine uses, for a transparent gauge.
  const cgpaScore  = cgpa ? clamp((cgpa / 10) * 100) : 0;
  const skillScore = clamp((p.skills / 8) * 100);
  const attScore   = attPct != null ? clamp(attPct) : 0;
  const projScore  = clamp((p.projects / 3) * 100);
  return {
    score: p.score,
    riskLevel: p.riskLevel,
    eligibleFor: p.eligibleFor,
    components: [
      { label: 'Academics (CGPA)', weight: 40, value: cgpaScore },
      { label: 'Technical Skills', weight: 25, value: skillScore },
      { label: 'Attendance',       weight: 20, value: attScore },
      { label: 'Projects',         weight: 15, value: projScore },
    ],
  };
}

// ── Company eligibility checker ───────────────────────────────────────────────
function eligibilityList(cgpa, attPct, backlogs, skillSet) {
  return COMPANIES.map(c => {
    const reasons = [];
    if (cgpa < c.minCgpa)            reasons.push(`CGPA ${cgpa} < ${c.minCgpa}`);
    if ((attPct ?? 0) < c.minAtt)    reasons.push(`Attendance ${attPct ?? 0}% < ${c.minAtt}%`);
    if (backlogs > c.maxBacklogs)    reasons.push(`${backlogs} backlog(s) > ${c.maxBacklogs} allowed`);
    const matched = c.skills.filter(s => hasSkill(skillSet, s));
    const missingSkills = c.skills.filter(s => !hasSkill(skillSet, s));
    return {
      name: c.name, role: c.role, sector: c.sector, ctc: c.ctc,
      minCgpa: c.minCgpa, minAtt: c.minAtt,
      eligible: reasons.length === 0,
      reasons,
      skillMatchPct: Math.round((matched.length / c.skills.length) * 100),
      missingSkills,
    };
  });
}

// ── Skill-gap analysis ────────────────────────────────────────────────────────
function skillGap(skillSet) {
  const categories = Object.entries(SKILL_CATALOG).map(([category, skills]) => {
    const items = skills.map(s => ({ skill: s, have: hasSkill(skillSet, s) }));
    const haveCount = items.filter(i => i.have).length;
    return { category, items, coverage: Math.round((haveCount / skills.length) * 100) };
  });
  const haveTotal = ALL_TARGET_SKILLS.filter(s => hasSkill(skillSet, s)).length;
  const missing = ALL_TARGET_SKILLS.filter(s => !hasSkill(skillSet, s));
  return {
    overallCoverage: Math.round((haveTotal / ALL_TARGET_SKILLS.length) * 100),
    haveCount: haveTotal,
    totalTracked: ALL_TARGET_SKILLS.length,
    categories,
    topMissing: missing.slice(0, 6),
  };
}

// ── Resume strength score ─────────────────────────────────────────────────────
function resumeStrength(user, cgpa, attPct, skillsCount, projectsCount) {
  const profileFields = [user.phone, user.email, user.photo, user.parentName, user.department, user.semester];
  const filled = profileFields.filter(Boolean).length;
  const profileScore = clamp((filled / profileFields.length) * 100);

  const factors = [
    { label: 'Technical skills', weight: 25, value: clamp((skillsCount / 8) * 100), hint: skillsCount < 8 ? `Add ${8 - skillsCount} more skill(s)` : 'Strong skill set' },
    { label: 'Projects',         weight: 20, value: clamp((projectsCount / 3) * 100), hint: projectsCount < 3 ? `Add ${3 - projectsCount} more project(s)` : 'Good project depth' },
    { label: 'Academics (CGPA)', weight: 25, value: cgpa ? clamp((cgpa / 10) * 100) : 0, hint: cgpa < 7 ? 'Raise CGPA towards 7.0+' : 'Competitive CGPA' },
    { label: 'Attendance',       weight: 15, value: attPct != null ? clamp(attPct) : 0, hint: (attPct ?? 0) < 75 ? 'Recover attendance above 75%' : 'Healthy attendance' },
    { label: 'Profile completeness', weight: 15, value: profileScore, hint: profileScore < 100 ? 'Complete your profile details' : 'Profile complete' },
  ];
  const score = clamp(factors.reduce((s, f) => s + f.value * (f.weight / 100), 0));
  const tier = score >= 80 ? 'Strong' : score >= 60 ? 'Competitive' : score >= 40 ? 'Developing' : 'Needs work';
  const tips = factors.filter(f => f.value < 80).map(f => f.hint);
  return { score, tier, factors, tips: tips.slice(0, 4) };
}

// ── Company recommendation engine ─────────────────────────────────────────────
// Ranks companies by a blended fit score: eligibility (gating) + skill overlap +
// CGPA headroom. Returns the best matches with a match% and what to close.
function recommendations(eligibility, cgpa) {
  const scored = eligibility.map(c => {
    const headroom = clamp((cgpa - c.minCgpa + 1) * 25, 0, 100);   // comfort above the bar
    const fit = c.eligible
      ? clamp(55 + c.skillMatchPct * 0.30 + headroom * 0.15)
      : clamp(c.skillMatchPct * 0.45 + headroom * 0.15);            // aspirational
    return { ...c, fit };
  }).sort((a, b) => b.fit - a.fit);
  return scored.slice(0, 5).map(c => ({
    name: c.name, role: c.role, sector: c.sector, ctc: c.ctc,
    eligible: c.eligible, matchPct: c.fit,
    action: c.eligible
      ? (c.missingSkills.length ? `Sharpen: ${c.missingSkills.join(', ')}` : 'Apply — you meet every criterion')
      : (c.reasons[0] ? `Close the gap: ${c.reasons[0]}` : 'Build the listed skills'),
  }));
}

// ── Interview preparation assistant ───────────────────────────────────────────
const PREP_TRACKS = [
  { track: 'Aptitude & Reasoning', icon: '🧮', topics: ['Quantitative aptitude', 'Logical reasoning', 'Data interpretation'], samples: ['Trains/time-speed-distance problems', 'Probability & permutations', 'Series and pattern questions'] },
  { track: 'Coding & DSA',         icon: '💻', topics: ['Arrays & strings', 'Hashing', 'Trees & graphs', 'Dynamic programming'], samples: ['Two-sum / sliding window', 'Reverse a linked list', 'BFS/DFS on a graph'] },
  { track: 'CS Fundamentals',      icon: '🧠', topics: ['OS', 'DBMS', 'Computer Networks', 'OOP'], samples: ['Explain deadlock & prevention', 'Normalization & indexing', 'TCP vs UDP'] },
  { track: 'HR & Communication',   icon: '🤝', topics: ['Tell me about yourself', 'Strengths/weaknesses', 'Why this company'], samples: ['Walk through your best project', 'Handle a conflict scenario', 'Where do you see yourself in 5 years'] },
];

function templatePrepPlan(name, gap, readiness) {
  const first = (name || 'there').split(' ')[0];
  const focus = gap.topMissing.length ? gap.topMissing.slice(0, 3).join(', ') : 'advanced DSA and system design';
  return `${first}, your placement readiness is ${readiness}/100. Spend the next two weeks closing skill gaps in ${focus}, solve 3-4 DSA problems daily, revise OS/DBMS/CN fundamentals, and run two mock HR interviews. Track progress on the Success Dashboard.`;
}

async function interviewPrep(user, gap, readiness) {
  let plan = templatePrepPlan(user.name, gap, readiness);
  let aiGenerated = false;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const resp = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 260,
        system:
`You are CampusAssist Copilot, a placement coach. Write a short, motivating 2-week interview-prep plan (3-4 sentences) for a student.
Use ONLY these facts — do not invent numbers. Plain text, no headings or bullets.`,
        messages: [{ role: 'user', content:
`Name: ${user.name}
Placement readiness: ${readiness}/100
Top missing skills: ${gap.topMissing.join(', ') || 'none — focus on advanced topics'}
Skill coverage: ${gap.overallCoverage}%` }],
      });
      const text = (resp.content[0]?.text || '').trim();
      if (text) { plan = text; aiGenerated = true; }
    } catch (err) {
      console.error('Interview prep AI error:', err.message);
    }
  }
  return { plan, aiGenerated, tracks: PREP_TRACKS };
}

// ── Trends ────────────────────────────────────────────────────────────────────
async function trends(user) {
  const snaps = await SuccessMetric.find({ student: user._id }).sort({ snapshotDate: 1 }).limit(30);
  const map = (key) => snaps.map(s => ({ label: (s.snapshotDate || '').slice(5), value: s[key] ?? 0 }));
  return {
    readinessTrend: map('placement'),
    cgpaTrend: snaps.map(s => ({ label: (s.snapshotDate || '').slice(5), value: s.cgpa ?? 0 })),
  };
}

// ── Concise summary for Campus Copilot grounding ──────────────────────────────
async function copilotSummary(user) {
  const success = await computeSuccess(user);
  const cgpa = success.breakdown.academic.cgpa || 0;
  const attPct = success.breakdown.attendance.currentPct;
  const backlogs = success.breakdown.academic.backlogs || 0;
  const skillSet = new Set((user.skills || []).map(norm));
  const elig = eligibilityList(cgpa, attPct, backlogs, skillSet);
  const eligibleCount = elig.filter(c => c.eligible).length;
  const gap = skillGap(skillSet);
  const recs = recommendations(elig, cgpa);
  const top = recs[0];
  return `Placement readiness ${success.breakdown.placement.score}/100. Eligible for ${eligibleCount} of ${COMPANIES.length} listed companies`
    + (top ? `; best match ${top.name} (${top.role}, ${top.matchPct}% fit)` : '')
    + (gap.topMissing.length ? `. Top skill gaps: ${gap.topMissing.slice(0, 3).join(', ')}.` : '.');
}

// ── Assemble the full Placement Hub payload ───────────────────────────────────
async function buildPlacement(user) {
  const success = await computeSuccess(user);
  const cgpa = success.breakdown.academic.cgpa || 0;
  const attPct = success.breakdown.attendance.currentPct;
  const backlogs = success.breakdown.academic.backlogs || 0;
  const skillsCount = (user.skills || []).length;
  const projectsCount = (user.projects || []).length;
  const skillSet = new Set((user.skills || []).map(norm));

  const readiness = readinessBlock(success, cgpa, attPct);
  const eligibility = eligibilityList(cgpa, attPct, backlogs, skillSet);
  const gap = skillGap(skillSet);
  const resume = resumeStrength(user, cgpa, attPct, skillsCount, projectsCount);
  const recommended = recommendations(eligibility, cgpa);
  const prep = await interviewPrep(user, gap, readiness.score);
  const trend = await trends(user);

  return {
    student: { name: user.name, studentId: user.studentId, department: user.department, semester: user.semester || '' },
    profile: { cgpa, attendancePct: attPct, backlogs, skills: user.skills || [], projects: user.projects || [] },
    readiness,
    eligibility: {
      total: eligibility.length,
      eligibleCount: eligibility.filter(c => c.eligible).length,
      companies: eligibility,
    },
    skillGap: gap,
    resume,
    recommendations: recommended,
    interviewPrep: prep,
    trends: trend,
    copilotPrompts: [
      'Am I placement ready?',
      'Which companies am I eligible for?',
      'What skills should I add for placements?',
      'How do I improve my resume strength?',
    ],
  };
}

module.exports = { buildPlacement, copilotSummary, COMPANIES, SKILL_CATALOG };
