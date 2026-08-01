// Drop-in replacement for the keyword `classifyIntent` in services/aiAgent.js.
//
// Copy this file to backend/services/intentClassifier.js.
//
// Design rules this file follows:
//   1. It ONLY classifies. Retrieval and generation are untouched — the database
//      and the existing business logic remain the single source of truth for
//      every real fact the assistant states.
//   2. It never becomes a hard dependency. If the model service is down, slow or
//      not configured, we fall back to the existing keyword rules, so the
//      assistant degrades to today's behaviour instead of failing.
//   3. It returns BOTH the fine-grained intent (for analytics) and the coarse
//      retrieval bucket (for aiAgent.retrieve), so QueryLog gets richer data
//      without retrieve() having to learn 78 new cases.

const RETRIEVAL_MAP = require('./retrieval_map.json');

const SERVICE_URL = process.env.INTENT_SERVICE_URL || '';        // unset => keywords only
const TIMEOUT_MS  = Number(process.env.INTENT_TIMEOUT_MS || 600);
const THRESHOLD   = Number(process.env.INTENT_THRESHOLD || 0.40);

// ── Existing keyword router, kept verbatim as the fallback path ──────────────
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

// ── Model-backed classification ─────────────────────────────────────────────
/**
 * @returns {Promise<{intent:string, retrieval:string, confidence:number,
 *                    entities:object, source:'model'|'keyword'}>}
 *   `retrieval` is always one of the buckets aiAgent.retrieve() understands.
 */
async function classify(message) {
  const fallback = () => ({
    intent: keywordIntent(message), retrieval: keywordIntent(message),
    confidence: 0, entities: {}, source: 'keyword',
  });

  if (!SERVICE_URL) return fallback();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(`${SERVICE_URL}/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      signal: controller.signal,
    });
    if (!resp.ok) return fallback();
    const data = await resp.json();

    // Below the threshold the classifier is guessing — prefer the keyword rules,
    // which are conservative and well understood.
    if (data.low_confidence || data.confidence < THRESHOLD) return fallback();

    const route = RETRIEVAL_MAP.map[data.intent];
    return {
      intent: data.intent,
      // retrieve() only knows the coarse buckets; anything else degrades to
      // 'general', which is precisely today's behaviour for those topics.
      retrieval: RETRIEVAL_MAP.buckets_supported_today.includes(route && route.retrieval)
        ? route.retrieval : 'general',
      confidence: data.confidence,
      entities: data.entities || {},
      category: data.category,
      source: 'model',
    };
  } catch (err) {
    // Timeout, connection refused, malformed body — never surface to the user.
    return fallback();
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { classify, keywordIntent };
