const express  = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { protect } = require('../middleware/auth');
const Exam   = require('../models/Exam');
const Fee    = require('../models/Fee');
const Notice = require('../models/Notice');

const router = express.Router();

const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt) ? String(d) : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Build live facts from MongoDB so the bot never quotes hardcoded/stale data.
async function buildFacts(user) {
  const facts = {};
  try {
    const exam = (await Exam.findOne({ status: 'published' }).sort({ updatedAt: -1 }))
      || (await Exam.findOne().sort({ createdAt: -1 }));
    if (exam) {
      facts.exam = `Semester ${exam.semester} exams`
        + (exam.theoryStart ? `: theory from ${fmtDate(exam.theoryStart)}` : '')
        + (exam.theoryEnd ? ` to ${fmtDate(exam.theoryEnd)}` : '')
        + (exam.hallTicketAvailable ? `. Hall tickets available from ${fmtDate(exam.hallTicketAvailable)}` : '')
        + '.';
    }
  } catch { /* ignore */ }
  try {
    if (user && user._id) {
      const fee = await Fee.findOne({ student: user._id });
      if (fee) {
        const recorded = fee.history.reduce((s, p) => s + p.amount, 0);
        const balance = fee.total - recorded;
        facts.fees = `Your Semester ${fee.semester} fee is ₹${fee.total.toLocaleString('en-IN')}`
          + `, balance ₹${balance.toLocaleString('en-IN')}`
          + (fee.dueDate ? `, due ${fmtDate(fee.dueDate)}` : '') + '.';
      }
    }
  } catch { /* ignore */ }
  try {
    const notices = await Notice.find({ isActive: true }).sort({ pinned: -1, createdAt: -1 }).limit(3);
    if (notices.length) facts.notices = 'Latest notices: ' + notices.map((n, i) => `(${i + 1}) ${n.title}`).join('; ') + '.';
  } catch { /* ignore */ }
  return facts;
}

// Keyword fallback — now data-driven for exam/fees/notices (no hardcoded dates/amounts).
function getBotResponse(message, facts) {
  const msg = message.toLowerCase();
  const has = (tags) => tags.some(t => msg.includes(t));

  if (has(['exam', 'hall ticket', 'schedule', 'test', 'paper']))
    return facts.exam || 'No exam schedule has been published for your class yet. Check the Exam Info page.';
  if (has(['fee', 'fees', 'payment', 'due', 'tuition']))
    return facts.fees || 'Your fee details appear on the Fees page once the accounts office sets them up.';
  if (has(['notice', 'announcement', 'news', 'circular', 'update']))
    return facts.notices || 'There are no notices right now. Check the Notices page for updates.';
  if (has(['timetable', 'class', 'period', 'timing']))
    return 'Your weekly timetable is on the Timetable page — it is set for your department, year and section.';
  if (has(['leave', 'od', 'medical', 'permission', 'absent']))
    return 'Apply via the Leave / OD page. You can attach a supporting document (PDF/JPG/PNG) and track approval there.';
  if (has(['library', 'book', 'borrow', 'return']))
    return 'Library hours: Mon–Fri 8 AM–6 PM, Sat 9 AM–4 PM. Borrow up to 3 books for 14 days.';
  if (has(['marksheet', 'marks', 'result', 'cgpa', 'gpa']))
    return 'View your marks, SGPA and CGPA on the Marks & CGPA page. Document requests are tracked on the Status page.';
  if (has(['attendance', 'present', 'percentage']))
    return 'Your subject-wise attendance is on the Attendance page. A minimum of 75% per subject is required.';
  if (has(['contact', 'phone', 'office', 'email', 'reach']))
    return 'Use the Contact page to message the admin office directly — your query is logged and you can track its status.';
  if (has(['help', 'what can you', 'topics']))
    return 'I can help with exams, fees, notices, timetable, leave/OD, library, marks, attendance and contacts. Just ask!';
  return "I'm not sure about that. Try asking about exams, fees, notices, timetable, leave, library, marks, attendance, or contact.";
}

// POST /api/chat
router.post('/', protect, async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Message is required' });
  }
  if (message.length > 1000) {
    return res.status(400).json({ success: false, message: 'Message must be 1000 characters or fewer.' });
  }

  const facts = await buildFacts(req.user);

  // Use Claude AI if a key is configured — fed with LIVE facts, not hardcoded ones.
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: `You are CampusAssist Bot, a helpful college helpdesk assistant. Keep answers concise (2–4 sentences), friendly and helpful.
Use ONLY the live facts below when relevant. If a fact is not provided, tell the student to check the relevant page — do NOT invent dates, fees, or numbers.
${facts.exam ? `Exam: ${facts.exam}` : 'Exam: not published yet.'}
${facts.fees ? `Fees: ${facts.fees}` : ''}
${facts.notices ? facts.notices : ''}
Library: Mon–Fri 8 AM–6 PM, Sat 9 AM–4 PM; borrow 3 books for 14 days. Minimum attendance 75% per subject.
For marksheet/certificate requests → Status/Requests page. For leave or OD → Leave/OD page. For contacting the office → Contact page.
Do not invent specific student data (grades, attendance %). Only answer college-related questions.`,
        messages: [{ role: 'user', content: message.trim() }],
      });
      const reply = response.content[0].text;
      return res.json({ success: true, message: reply, timestamp: new Date().toISOString(), ai: true });
    } catch (err) {
      console.error('Claude API error:', err.message);
      // Fall through to keyword matching
    }
  }

  const reply = getBotResponse(message.trim(), facts);
  res.json({ success: true, message: reply, timestamp: new Date().toISOString(), ai: false });
});

module.exports = router;
