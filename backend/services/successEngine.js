// Student Success Engine — turns the existing attendance/marks/fee/skill data
// into a weighted Success Score, sub-scores, risk indicators, recommendations
// and trend series. Deterministic (no external API) so it always demos.
const Attendance   = require('../models/Attendance');
const Marks        = require('../models/Marks');
const Fee          = require('../models/Fee');
const QueryLog     = require('../models/QueryLog');
const SuccessMetric= require('../models/SuccessMetric');

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));
const ymd   = (d) => new Date(d).toISOString().slice(0, 10);

// ── Attendance ──────────────────────────────────────────────────────────────
async function attendanceBlock(user) {
  const recs = await Attendance.find({ student: user._id }).sort({ date: 1 });
  if (!recs.length) {
    return { score: 0, currentPct: null, perSubject: [], trend: [], riskLevel: 'unknown', prediction: null, hasData: false };
  }
  const present = recs.filter(r => r.status !== 'Absent').length;
  const currentPct = Math.round((100 * present) / recs.length);

  // Per-subject percentages
  const subj = {};
  recs.forEach(r => {
    subj[r.subject] = subj[r.subject] || { total: 0, present: 0 };
    subj[r.subject].total++;
    if (r.status !== 'Absent') subj[r.subject].present++;
  });
  const perSubject = Object.entries(subj)
    .map(([subject, s]) => ({ subject, pct: Math.round((100 * s.present) / s.total) }))
    .sort((a, b) => a.pct - b.pct);

  // Monthly trend
  const byMonth = {};
  recs.forEach(r => {
    const k = ymd(r.date).slice(0, 7);
    byMonth[k] = byMonth[k] || { total: 0, present: 0 };
    byMonth[k].total++;
    if (r.status !== 'Absent') byMonth[k].present++;
  });
  const trend = Object.entries(byMonth)
    .map(([month, s]) => ({ label: month, value: Math.round((100 * s.present) / s.total) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Simple linear projection from the monthly trend → predicted end value.
  let prediction = currentPct;
  if (trend.length >= 2) {
    const slope = trend[trend.length - 1].value - trend[0].value;
    prediction = clamp(trend[trend.length - 1].value + slope / Math.max(1, trend.length - 1));
  }
  const riskLevel = currentPct < 75 ? 'high' : currentPct < 85 ? 'medium' : 'low';
  return { score: clamp(currentPct), currentPct, perSubject, trend, riskLevel, prediction, hasData: true };
}

// ── Academics ────────────────────────────────────────────────────────────────
async function academicBlock(user) {
  const marks = await Marks.find({ student: user._id });
  if (!marks.length) return { score: 0, cgpa: null, backlogs: 0, semesters: [], riskLevel: 'unknown', hasData: false };

  const bySem = {};
  let credits = 0, points = 0;
  marks.forEach(m => {
    bySem[m.semester] = bySem[m.semester] || { credits: 0, points: 0 };
    bySem[m.semester].credits += m.credits;
    bySem[m.semester].points  += m.credits * m.gradePoint;
    credits += m.credits;
    points  += m.credits * m.gradePoint;
  });
  const semesters = Object.entries(bySem)
    .map(([semester, s]) => ({ label: `Sem ${semester}`, value: s.credits ? +(s.points / s.credits).toFixed(2) : 0 }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const cgpa = credits ? +(points / credits).toFixed(2) : 0;
  const backlogs = marks.filter(m => m.gradePoint === 0).length;
  const riskLevel = backlogs > 0 ? 'high' : cgpa < 6 ? 'medium' : 'low';
  return { score: clamp(cgpa * 10), cgpa, backlogs, semesters, riskLevel, hasData: true };
}

// ── Placement readiness ──────────────────────────────────────────────────────
function placementBlock(user, attPct, cgpa) {
  const skills = (user.skills || []).length;
  const projects = (user.projects || []).length;
  const cgpaScore  = cgpa ? clamp((cgpa / 10) * 100) : 0;       // 40%
  const skillScore = clamp((skills / 8) * 100);                  // 25% (target ~8 skills)
  const attScore   = attPct != null ? clamp(attPct) : 0;         // 20%
  const projScore  = clamp((projects / 3) * 100);                // 15% (target ~3 projects)
  const score = clamp(cgpaScore * 0.40 + skillScore * 0.25 + attScore * 0.20 + projScore * 0.15);
  const riskLevel = score < 50 ? 'high' : score < 70 ? 'medium' : 'low';
  return { score, skills, projects, riskLevel, eligibleFor: cgpa >= 7 && attPct >= 75 ? 'Most companies' : 'Limited (raise CGPA/attendance)' };
}

// ── Engagement (uses Copilot usage as a proxy) ───────────────────────────────
async function engagementBlock(user) {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const logs = await QueryLog.find({ user: user._id, createdAt: { $gte: since } });
  const activeDays = new Set(logs.map(l => ymd(l.createdAt))).size;
  const score = clamp(logs.length * 4 + activeDays * 6);
  return { score, queries: logs.length, activeDays };
}

// ── Aggregate ────────────────────────────────────────────────────────────────
async function computeSuccess(user) {
  const attendance = await attendanceBlock(user);
  const academic   = await academicBlock(user);
  const placement  = placementBlock(user, attendance.currentPct, academic.cgpa || 0);
  const engagement = await engagementBlock(user);

  const successScore = clamp(
    attendance.score * 0.30 + academic.score * 0.40 + placement.score * 0.20 + engagement.score * 0.10
  );

  // Risk indicators
  const risks = [];
  const lowSubjects = (attendance.perSubject || []).filter(s => s.pct < 75);
  if (attendance.hasData && attendance.currentPct < 75)
    risks.push({ type: 'attendance', level: 'high', message: `Overall attendance ${attendance.currentPct}% is below the 75% requirement.` });
  else if (lowSubjects.length)
    risks.push({ type: 'attendance', level: 'high', message: `${lowSubjects.length} subject(s) below 75%: ${lowSubjects.map(s => `${s.subject} (${s.pct}%)`).join(', ')}.` });
  else if (attendance.hasData && attendance.currentPct < 85)
    risks.push({ type: 'attendance', level: 'medium', message: `Attendance ${attendance.currentPct}% — keep above 85% for safety.` });
  if (academic.backlogs > 0)
    risks.push({ type: 'academic', level: 'high', message: `${academic.backlogs} backlog(s) pending — clear them to protect your CGPA.` });
  else if (academic.cgpa && academic.cgpa < 7)
    risks.push({ type: 'academic', level: 'medium', message: `CGPA ${academic.cgpa} — aim for ≥7 to unlock more placement drives.` });
  if (placement.score < 60)
    risks.push({ type: 'placement', level: placement.score < 50 ? 'high' : 'medium', message: `Placement readiness ${placement.score}/100 — build skills and projects.` });

  // Recommendations
  const recommendations = [];
  if (lowSubjects.length)
    recommendations.push(`Prioritise ${lowSubjects[0].subject} — attendance is ${lowSubjects[0].pct}%, below the 75% minimum.`);
  if (attendance.hasData && attendance.currentPct < 75)
    recommendations.push('Attend every class this month — you need consistent presence to recover above 75%.');
  if (academic.backlogs > 0)
    recommendations.push('Register for re-exams and meet the subject faculty for backlog subjects.');
  if (academic.cgpa && academic.cgpa < 7)
    recommendations.push('Focus internal-assessment effort on low-scoring subjects to push CGPA past 7.0.');
  if (placement.skills < 8)
    recommendations.push(`Add ${8 - placement.skills} more technical skill(s) (e.g. DSA, a framework, cloud basics) to your profile.`);
  if (placement.projects < 3)
    recommendations.push(`Build ${3 - placement.projects} more project(s) to strengthen your resume.`);
  if (engagement.score < 30)
    recommendations.push('Use Campus Copilot regularly to stay on top of deadlines and notices.');
  if (!recommendations.length)
    recommendations.push("You're on track across the board — keep maintaining attendance and CGPA, and start interview prep.");

  return {
    successScore,
    breakdown: {
      attendance: { weight: 30, ...attendance },
      academic:   { weight: 40, ...academic },
      placement:  { weight: 20, ...placement },
      engagement: { weight: 10, ...engagement },
    },
    risks,
    recommendations,
  };
}

// Persist a daily snapshot (idempotent per student/day) for trend history.
async function saveSnapshot(user, result) {
  const snapshotDate = ymd(new Date());
  const b = result.breakdown;
  await SuccessMetric.findOneAndUpdate(
    { student: user._id, snapshotDate },
    { $set: {
      successScore: result.successScore,
      attHealth: b.attendance.score, academic: b.academic.score,
      placement: b.placement.score, engagement: b.engagement.score,
      cgpa: b.academic.cgpa, attendancePct: b.attendance.currentPct, backlogs: b.academic.backlogs,
    } },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

async function successTrend(user) {
  const snaps = await SuccessMetric.find({ student: user._id }).sort({ snapshotDate: 1 }).limit(30);
  return snaps.map(s => ({ label: s.snapshotDate.slice(5), value: s.successScore }));
}

module.exports = { computeSuccess, saveSnapshot, successTrend };
