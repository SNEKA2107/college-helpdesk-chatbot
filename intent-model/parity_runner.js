/**
 * Parity harness runner (development only — not loaded by the server).
 *
 * Reads a JSON array of questions, scores each with the pure-JS port in
 * backend/services/intentModel.js, and writes the predictions out for
 * verify_parity.py to compare against scikit-learn.
 *
 *   node intent-model/parity_runner.js <input.json> <output.json> [--analyzers]
 *
 * With --analyzers it also emits the tokenised word and char_wb n-grams, so a
 * mismatch can be traced to the exact analyzer that diverged rather than
 * guessed at.
 */
const fs = require('fs');
const path = require('path');

const model = require(path.join(__dirname, '..', 'backend', 'services', 'intentModel.js'));

const [inPath, outPath] = process.argv.slice(2);
const withAnalyzers = process.argv.includes('--analyzers');

if (!inPath || !outPath) {
  console.error('usage: node parity_runner.js <input.json> <output.json> [--analyzers]');
  process.exit(2);
}
if (!model.isAvailable()) {
  console.error('intent model failed to load — cannot run parity');
  process.exit(3);
}

const questions = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const t0 = Date.now();

const results = questions.map((q) => {
  const r = model.classifyFull(q);
  if (!r) return { intent: null, confidence: 0, nActive: 0 };
  const out = { intent: r.intent, confidence: r.confidence, nActive: r.nActive };
  if (withAnalyzers) {
    const doc = model._internals.preprocess(q);
    out.word = model._internals.wordNgrams(doc);
    out.char = model._internals.charWbNgrams(doc);
  }
  return out;
});

const ms = Date.now() - t0;
fs.writeFileSync(outPath, JSON.stringify(results));
console.error(`scored ${questions.length} questions in ${ms} ms (${(ms / questions.length).toFixed(3)} ms each)`);
