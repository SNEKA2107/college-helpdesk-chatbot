/**
 * Intent routing for the Campus Copilot.
 *
 * The classifier decides WHAT is being asked. It never decides what is true —
 * every fact in an answer still comes from Mongo via aiAgent.retrieve(), under
 * the same ownership scoping and business rules as before.
 *
 * Two outputs, deliberately:
 *   intent     fine-grained (78 classes) — for analytics, canned replies and
 *              the out-of-scope guard
 *   retrieval  coarse bucket that retrieve() already understands, so the
 *              retrieval layer did not have to learn 78 new cases
 *
 * The model is never a hard dependency. If it fails to load, or answers below
 * its calibrated confidence threshold, routing falls back to the original
 * keyword rules — which is exactly the behaviour this service had before.
 */
const path = require('path');
const intentModel = require('./intentModel');

const ROUTES = require(path.join(__dirname, 'intent-model', 'retrieval_map.json'));
const RESPONSES = require(path.join(__dirname, 'intent-model', 'responses.json'));

// Buckets aiAgent.retrieve() has a handler for. Anything else degrades to
// 'general' (recent notices + knowledge base), which is what the keyword router
// did for those topics anyway, so nothing regresses.
const RETRIEVAL_BUCKETS = new Set(ROUTES.buckets_supported_today || [
  'performance', 'placement', 'exam', 'fees', 'attendance', 'marks',
  'faculty', 'notice', 'contact', 'general',
]);

// ── Original keyword router, kept verbatim as the fallback path ─────────────
const KEYWORDS = {
  performance:['how am i performing', 'how am i doing', 'success score', 'placement ready', 'am i placement', 'how am i', 'my performance', 'what should i improve', 'improve'],
  exam:       ['exam', 'hall ticket', 'schedule', 'test', 'paper', 'timetable'],
  fees:       ['fee', 'fees', 'payment', 'due', 'tuition', 'balance', 'pay'],
  attendance: ['attendance', 'present', 'absent', 'percentage', '75'],
  marks:      ['marks', 'result', 'cgpa', 'gpa', 'grade', 'sgpa', 'backlog'],
  placement:  ['placement', 'company', 'eligib', 'interview', 'resume', 'ctc', 'package', 'drive'],
  notice:     ['notice', 'announcement', 'news', 'circular', 'update'],
  faculty:    ['faculty', 'professor', 'teacher', 'teaches', 'who teaches', 'taught', 'teaching', 'instructor', 'lecturer', 'hod', 'head of department', 'cabin'],
  contact:    ['contact', 'phone', 'office', 'email', 'reach'],
};

function keywordIntent(message) {
  const m = String(message || '').toLowerCase();
  for (const [intent, kws] of Object.entries(KEYWORDS)) {
    if (kws.some(k => m.includes(k))) return intent;
  }
  return 'general';
}

/** Intents answered from a canned reply — no student record to fetch. */
const CANNED = new Set(['greeting', 'thanks_goodbye', 'bot_capabilities', 'out_of_scope_technical']);

/**
 * @returns {{intent, retrieval, confidence, category, source, canned}}
 *   `source` is 'model' when the classifier was trusted, 'keyword' otherwise.
 */
function classify(message) {
  const fallback = () => {
    const kw = keywordIntent(message);
    return { intent: kw, retrieval: kw, confidence: 0, category: null,
             source: 'keyword', canned: false };
  };

  let pred;
  try {
    pred = intentModel.classify(message);
  } catch (err) {
    console.error('Intent model error:', err.message);
    return fallback();
  }
  // Unavailable, unrecognisable input, or below the calibrated threshold — the
  // conservative keyword rules are a better guess than a low-confidence one.
  if (!pred || pred.lowConfidence) return fallback();

  const route = ROUTES.map && ROUTES.map[pred.intent];
  const bucket = route && RETRIEVAL_BUCKETS.has(route.retrieval) ? route.retrieval : 'general';
  const meta = RESPONSES[pred.intent];

  return {
    intent: pred.intent,
    retrieval: bucket,
    confidence: pred.confidence,
    category: meta ? meta.category : null,
    source: 'model',
    canned: CANNED.has(pred.intent),
  };
}

/** The canned, capability-accurate reply for an intent (no student data in it). */
function cannedReply(intent) {
  const meta = RESPONSES[intent];
  return meta ? meta.response : null;
}

module.exports = { classify, keywordIntent, cannedReply, isModelLoaded: intentModel.isAvailable };
