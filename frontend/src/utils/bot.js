export const botReplies = {
  exam:      '📘 Semester exams start June 15, 2026. Check the Exam Info page for the full schedule.',
  fees:      '💳 Fee payment deadline is May 25, 2026. Total: ₹55,000. Check Fees page for details.',
  marksheet: '📄 Your marksheet request is currently in Processing stage. Est. 3-5 working days.',
  library:   '📚 Library is open Mon–Sat, 8 AM to 6 PM. You can borrow up to 3 books at once.',
  timetable: '📅 Your weekly timetable is available on the Timetable page.',
  leave:     '📝 Submit a leave application via the Leave Application page in the menu.',
  notice:    '🔔 Latest notices are available on the Notices page.',
  contact:   '☎ Contact the college office at +91 98765 43210 or admin@campusassist.edu',
  help:      '💡 I can help with: exam info, fees, marksheet, library, timetable, leave, notices, and contact.',
  hello:     "👋 Hello! I'm your CampusAssist bot. How can I help you today?",
  hi:        '👋 Hi there! What do you need help with?',
  thanks:    "😊 You're welcome! Anything else I can help with?",
  bye:       '👋 Goodbye! Have a great day!',
};

export function getBotReply(message) {
  const msg = message.toLowerCase().trim();
  for (const key in botReplies) {
    if (msg.includes(key)) return botReplies[key];
  }
  return "🤔 I'm not sure about that. Try asking about exams, fees, marksheet, library, timetable, leave, or contact. Type help to see all topics.";
}
