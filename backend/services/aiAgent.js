// Campus Copilot engine: intent classification → grounded retrieval (with source
// tracking) → Claude generation with conversation memory. Falls back gracefully
// to a retrieval-only answer when ANTHROPIC_API_KEY is not configured.
const Anthropic  = require('@anthropic-ai/sdk');
const Exam       = require('../models/Exam');
const Fee        = require('../models/Fee');
const Notice     = require('../models/Notice');
const Attendance = require('../models/Attendance');
const Marks      = require('../models/Marks');
const KB         = require('../models/KnowledgeArticle');
const { computeSuccess } = require('./successEngine');

const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt) ? String(d) : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ── 1. Intent classification ──────────────────────────────────────────────
// Deterministic keyword routing — cheap, predictable, and logged for analytics.
const INTENTS = {
  performance:['how am i performing', 'how am i doing', 'success score', 'placement ready', 'am i placement', 'how am i', 'my performance', 'what should i improve', 'improve'],
  exam:       ['exam', 'hall ticket', 'schedule', 'test', 'paper', 'timetable'],
  fees:       ['fee', 'fees', 'payment', 'due', 'tuition', 'balance', 'pay'],
  attendance: ['attendance', 'present', 'absent', 'percentage', '75'],
  marks:      ['marks', 'result', 'cgpa', 'gpa', 'grade', 'sgpa', 'backlog'],
  placement:  ['placement', 'company', 'eligib', 'interview', 'resume', 'ctc', 'package', 'drive'],
  notice:     ['notice', 'announcement', 'news', 'circular', 'update'],
  faculty:    ['faculty', 'professor', 'teacher', 'hod', 'cabin'],
  contact:    ['contact', 'phone', 'office', 'email', 'reach'],
};

function classifyIntent(message) {
  const m = message.toLowerCase();
  for (const [intent, kws] of Object.entries(INTENTS)) {
    if (kws.some(k => m.includes(k))) return intent;
  }
  return 'general';
}

// ── 2. Retrieval ──────────────────────────────────────────────────────────
// Returns { context, sources } scoped to the detected intent AND the student.
// Every fact pushed to `context` also records a citation in `sources`.
async function retrieve(intent, user) {
  const sources = [];
  const ctx = [];
  const add = (type, refId, label, text) => { sources.push({ type, refId, label }); ctx.push(text); };

  try {
    if (intent === 'performance') {
      const s = await computeSuccess(user);
      const b = s.breakdown;
      add('success', null, 'Success score',
        `Student Success Score ${s.successScore}/100. Attendance health ${b.attendance.score}`
        + (b.attendance.currentPct != null ? ` (${b.attendance.currentPct}%)` : '')
        + `, academic ${b.academic.score}` + (b.academic.cgpa ? ` (CGPA ${b.academic.cgpa})` : '')
        + `, placement readiness ${b.placement.score}/100`
        + (b.academic.backlogs ? `, ${b.academic.backlogs} backlog(s)` : '') + '. '
        + (s.recommendations.length ? `Top recommendation: ${s.recommendations[0]}` : ''));
    }

    if (intent === 'exam' || intent === 'general') {
      const exam = await Exam.findOne({
        status: 'published',
        $or: [{ department: '' }, { department: user.department }],
      }).sort({ updatedAt: -1 });
      if (exam) {
        add('exam', exam._id, `Exam: Sem ${exam.semester}`,
          `Semester ${exam.semester} exams`
          + (exam.theoryStart ? `: theory from ${fmtDate(exam.theoryStart)}` : '')
          + (exam.theoryEnd ? ` to ${fmtDate(exam.theoryEnd)}` : '')
          + (exam.hallTicketAvailable ? `. Hall tickets from ${fmtDate(exam.hallTicketAvailable)}` : '') + '.');
      }
    }

    if (intent === 'fees' || intent === 'general') {
      const fee = await Fee.findOne({ student: user._id });
      if (fee) {
        add('fee', fee._id, `Fees: Sem ${fee.semester}`,
          `Fee total ₹${fee.total.toLocaleString('en-IN')}, balance ₹${fee.balance.toLocaleString('en-IN')}, `
          + `status ${fee.status}` + (fee.dueDate ? `, due ${fee.dueDate}` : '') + '.');
      }
    }

    if (intent === 'attendance') {
      const recs = await Attendance.find({ student: user._id });
      if (recs.length) {
        const present = recs.filter(r => r.status !== 'Absent').length;
        const pct = Math.round((100 * present) / recs.length);
        add('attendance', null, 'Attendance record',
          `Overall attendance ${pct}% across ${recs.length} sessions (minimum 75% required per subject).`);
      }
    }

    if (intent === 'marks') {
      const marks = await Marks.find({ student: user._id });
      if (marks.length) {
        const credits = marks.reduce((s, m) => s + m.credits, 0);
        const weighted = marks.reduce((s, m) => s + m.gradePoint * m.credits, 0);
        const cgpa = credits ? (weighted / credits).toFixed(2) : 'N/A';
        const backlogs = marks.filter(m => m.gradePoint === 0).length;
        add('marks', null, 'Marks record',
          `CGPA ${cgpa} across ${marks.length} subjects` + (backlogs ? `, ${backlogs} backlog(s)` : '') + '.');
      }
    }

    // Always pull recent notices so answers stay source-backed and current.
    const notices = await Notice.find({ status: { $nin: ['draft', 'archived'] }, isActive: { $ne: false } })
      .sort({ pinned: -1, publishedAt: -1, createdAt: -1 }).limit(3);
    notices.forEach(n => add('notice', n._id, `Notice: ${n.title}`,
      `Notice "${n.title}": ${(n.summary || n.content || '').slice(0, 200)}`));

    // Knowledge base (keyword search until embeddings land). Non-fatal if no text index/docs.
    const kb = await KB.find({ $text: { $search: intent }, status: 'published' }).limit(2).catch(() => []);
    kb.forEach(k => add('kb', k._id, `KB: ${k.title}`, `${k.title}: ${k.body.slice(0, 300)}`));
  } catch (err) {
    console.error('Retrieval error:', err.message);
  }

  return { context: ctx.join('\n'), sources };
}

// ── 3. Generation ───────────────────────────────────────────────────────────
// Grounds Claude on retrieved facts + conversation memory; parses out follow-ups.
async function generate({ message, history = [], user }) {
  const intent = classifyIntent(message);
  const { context, sources } = await retrieve(intent, user);
  const matched = sources.length > 0;

  if (!process.env.ANTHROPIC_API_KEY) {
    const reply = context
      ? `Here's what I found:\n${context}`
      : "I couldn't find that in your records yet — please check the relevant page in the menu.";
    return { reply, intent, sources, followUps: [], matched };
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system:
`You are CampusAssist Copilot, the AI assistant for ${user.name} (${user.department || 'student'}).
Answer ONLY from the FACTS below. Keep it concise (2-4 sentences), friendly and helpful.
If a needed fact is missing, say so and name the page to check — never invent dates, fees, grades or numbers.
At the very end, output one line exactly "FOLLOWUPS: q1 | q2 | q3" with 3 short, relevant follow-up questions the student might ask next.

FACTS:
${context || '(no records retrieved)'}`,
      messages: [
        ...history.slice(-8).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message },
      ],
    });

    let text = resp.content[0].text || '';
    let followUps = [];
    const fm = text.match(/FOLLOWUPS:\s*(.+)$/s);
    if (fm) {
      followUps = fm[1].split('|').map(s => s.trim()).filter(Boolean).slice(0, 3);
      text = text.replace(fm[0], '').trim();
    }
    return { reply: text, intent, sources, followUps, matched };
  } catch (err) {
    console.error('Claude API error:', err.message);
    const reply = context ? `Here's what I found:\n${context}` : "Sorry, I'm having trouble right now. Please try again.";
    return { reply, intent, sources, followUps: [], matched };
  }
}

module.exports = { generate, classifyIntent, retrieve };
