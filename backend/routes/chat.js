const express  = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Fallback keyword-based responses when Claude API is unavailable
const knowledgeBase = {
  exam:      { reply: 'Semester V exams start June 15, 2026 and end June 28, 2026. Hall tickets available from June 10. Report 30 mins early with Hall Ticket and ID card.', tags: ['exam','hall ticket','schedule','paper','test'] },
  fees:      { reply: 'Semester V total fee: ₹55,000 (Tuition ₹45k + Lab ₹5k + Library ₹2k + Exam ₹3k). Payment deadline: May 25, 2026. Modes: Net Banking, UPI, Debit/Credit card.', tags: ['fees','fee','payment','due','tuition','lab fee'] },
  marksheet: { reply: 'Marksheet requests take 5–7 working days (urgent: 2–3 days). Submit via the Requests page. Collect from Room 101, Admin Block with your ID card.', tags: ['marksheet','marks','result'] },
  bonafide:  { reply: 'Bonafide certificates are issued by the Admin Office. Submit a request via the Requests page under "Bonafide Certificate". It will be ready within 2–3 working days. Collect from Room 101, Admin Block with your ID card. It\'s required for bank accounts, scholarships, and passport applications.', tags: ['bonafide','bona fide','bonafied','genuine','enrollment','enrolment','studying','student certificate'] },
  library:   { reply: 'Library hours: Mon–Fri 8 AM–6 PM, Sat 9 AM–4 PM. Borrowing limit: 3 books for 14 days. Fine: ₹2/book/day after due date.', tags: ['library','book','borrow','return'] },
  timetable: { reply: 'Your weekly timetable is on the Timetable page. This semester: Java, DBMS, CN, AI, Python, and Maths III.', tags: ['timetable','class','schedule','timing','period'] },
  leave:     { reply: 'Apply via the Leave Application page. Medical leave needs a doctor\'s certificate. OD leave needs event participation proof.', tags: ['leave','absent','od','medical','permission'] },
  notice:    { reply: 'Latest notices: (1) Exam schedule released — starts June 15. (2) Fee deadline May 25. (3) Internal marks published. Visit the Notices page for all updates.', tags: ['notice','announcement','news','update','circular'] },
  contact:   { reply: 'Admin Office: +91 98765 43210, admin@campusassist.edu (Mon–Fri 9–5). Exam Cell: +91 98765 43211. Accounts: +91 98765 43212. Emergency: +91 98765 43200 (24/7).', tags: ['contact','phone','email','office','help','address'] },
  attendance:{ reply: 'Check your attendance on the Attendance page. Minimum 75% attendance is required per subject to sit for exams.', tags: ['attendance','present','absent','percentage'] },
  help:      { reply: 'I can help with:\n📘 Exam Info  💳 Fees  📄 Marksheet\n📚 Library  📅 Timetable  📝 Leave\n🔔 Notices  ☎ Contact  ✅ Attendance\n\nJust type your question!', tags: ['help','topics','what can you do'] },
};

function getBotResponse(message) {
  const msg = message.toLowerCase();
  for (const [, data] of Object.entries(knowledgeBase)) {
    if (data.tags.some(tag => msg.includes(tag))) return data.reply;
  }
  return 'I\'m not sure about that. Try asking about exams, fees, marksheet, library, timetable, leave, attendance, or contact. Type "help" to see all topics.';
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

  // Use Claude AI if API key is configured
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: `You are CampusAssist Bot, a helpful college helpdesk assistant for a South Indian engineering college.
Keep answers concise (2–4 sentences). Be friendly and helpful.
Key facts:
- Semester V exams: June 15–28, 2026. Hall tickets from June 10.
- Fee deadline: May 25, 2026. Total: ₹55,000.
- Library: Mon–Fri 8AM–6PM, Sat 9AM–4PM. Borrow limit: 3 books / 14 days.
- Admin: +91 98765 43210, admin@campusassist.edu.
- Minimum attendance: 75% per subject.
- For marksheet/certificate requests, direct to the Requests page.
- For bonafide certificate, direct to the Requests page. Ready in 2–3 working days. Collect from Room 101, Admin Block.
- For leave, direct to the Leave Application page.
- Do not invent specific student data (grades, attendance %). Only answer college-related questions.`,
        messages: [{ role: 'user', content: message.trim() }],
      });
      const reply = response.content[0].text;
      return res.json({ success: true, message: reply, timestamp: new Date().toISOString(), ai: true });
    } catch (err) {
      console.error('Claude API error:', err.message);
      // Fall through to keyword matching
    }
  }

  const reply = getBotResponse(message.trim());
  res.json({ success: true, message: reply, timestamp: new Date().toISOString(), ai: false });
});

module.exports = router;
