/**
 * Pure-JS inference for the CampusAssist intent classifier.
 *
 * TF-IDF followed by a linear model is a sparse dot product, so the model that
 * was trained in scikit-learn is executed here directly by the Node service.
 * No Python runtime, no sidecar, no cold start — and no network hop that can
 * time out mid-conversation.
 *
 * Parameters come from backend/services/intent-model/, written by
 * intent-model/export_to_js.py. The analyzers below reproduce scikit-learn's
 * `word` (1-2 gram) and `char_wb` (3-5 gram) tokenisation exactly; the port is
 * gated by intent-model/verify_parity.py, which requires an identical predicted
 * intent on all 5,070 dataset rows before this file is allowed to ship.
 *
 * Everything here is defensive: if the model files are missing or malformed the
 * module reports unavailable and the caller falls back to keyword routing, so a
 * bad deploy degrades the assistant instead of breaking it.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'intent-model');

let state = null;      // null = not loaded yet, false = unavailable, object = ready

// ── scikit-learn analyzer reproduction ──────────────────────────────────────

// sklearn strip_accents_unicode: pure-ASCII input is returned untouched;
// anything else is NFKD-normalised with combining marks removed.
const ASCII_ONLY = /^[\x00-\x7F]*$/;
function stripAccents(s) {
  if (ASCII_ONLY.test(s)) return s;
  return s.normalize('NFKD').replace(/\p{M}/gu, '');
}

// sklearn preprocessing order is lowercase FIRST, then accent folding.
function preprocess(s) {
  return stripAccents(String(s).toLowerCase());
}

// token_pattern r"(?u)\b\w\w+\b" — words of two or more word characters.
const TOKEN = /\b\w\w+\b/g;
function tokenize(doc) {
  return doc.match(TOKEN) || [];
}

/** sklearn _word_ngrams for ngram_range=(1,2): unigrams, then space-joined bigrams. */
function wordNgrams(doc) {
  const tokens = tokenize(doc);
  const out = tokens.slice();
  for (let i = 0; i + 1 < tokens.length; i++) out.push(tokens[i] + ' ' + tokens[i + 1]);
  return out;
}

/**
 * sklearn _char_wb_ngrams for ngram_range=(3,5).
 *
 * Runs of whitespace collapse to one space, each word is padded with a single
 * space either side, and n-grams are taken within that padded word only — which
 * is what makes the features word-boundary aware. The `offset === 0` break
 * reproduces sklearn's rule that a word shorter than n contributes exactly one
 * n-gram and no longer n is attempted.
 */
function charWbNgrams(doc) {
  const text = doc.replace(/\s\s+/g, ' ');
  const words = text.split(/\s+/).filter(Boolean);
  const out = [];
  for (const raw of words) {
    const w = ' ' + raw + ' ';
    const wLen = w.length;
    for (let n = 3; n <= 5; n++) {
      let offset = 0;
      out.push(w.slice(0, n));
      while (offset + n < wLen) {
        offset += 1;
        out.push(w.slice(offset, offset + n));
      }
      if (offset === 0) break;
    }
  }
  return out;
}

/**
 * TF-IDF for one sub-vectorizer: term counts -> sublinear tf -> x idf -> L2.
 * Terms outside the fitted vocabulary are dropped, exactly as transform() does.
 * Accumulates into `sink` at the given feature offset.
 */
function tfidfInto(terms, vocab, idf, offset, sink) {
  const counts = new Map();
  for (const t of terms) {
    const j = vocab[t];
    if (j !== undefined) counts.set(j, (counts.get(j) || 0) + 1);
  }
  if (counts.size === 0) return;

  let sumSq = 0;
  const staged = [];
  for (const [j, c] of counts) {
    const v = (1 + Math.log(c)) * idf[j];   // sublinear_tf + idf
    staged.push([j, v]);
    sumSq += v * v;
  }
  // sklearn's normalize leaves an all-zero row alone rather than dividing by 0.
  const norm = sumSq > 0 ? Math.sqrt(sumSq) : 1;
  for (const [j, v] of staged) sink.push([offset + j, v / norm]);
}

// ── Loading ─────────────────────────────────────────────────────────────────
function load() {
  if (state !== null) return state;
  try {
    // A big-endian host would reinterpret the little-endian coefficient dump as
    // garbage. Detect it rather than serve silently wrong predictions.
    const probe = new Uint8Array(new Uint16Array([1]).buffer);
    if (probe[0] !== 1) throw new Error('big-endian host: model.bin is little-endian');

    const meta = JSON.parse(fs.readFileSync(path.join(DIR, 'model.json'), 'utf8'));
    const buf = fs.readFileSync(path.join(DIR, 'model.bin'));
    const expected = meta.nFeatures * meta.nClasses * 4;
    if (buf.length !== expected) {
      throw new Error(`model.bin is ${buf.length} bytes, expected ${expected}`);
    }
    // Copy out of the Buffer: its ArrayBuffer is pooled and may not be 4-byte
    // aligned, which Float32Array will not accept as a view.
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);

    state = {
      coef: new Float32Array(ab),
      classes: meta.classes,
      nClasses: meta.nClasses,
      wordVocab: meta.wordVocab,
      wordIdf: Float64Array.from(meta.wordIdf),
      charVocab: meta.charVocab,
      charIdf: Float64Array.from(meta.charIdf),
      charOffset: meta.charOffset,
      intercept: Float64Array.from(meta.intercept),
      calA: Float64Array.from(meta.calA),
      calB: Float64Array.from(meta.calB),
      threshold: meta.threshold,
      provenance: meta.provenance,
    };
    console.log(
      `✅ Intent model loaded — ${state.nClasses} intents, ${meta.nFeatures} features, ` +
      `threshold ${state.threshold} (${meta.provenance.algorithm}, ` +
      `test macro-F1 ${meta.provenance.testMacroF1})`
    );
  } catch (err) {
    console.warn(`⚠️  Intent model unavailable (${err.message}) — falling back to keyword routing.`);
    state = false;
  }
  return state;
}

// ── Inference ───────────────────────────────────────────────────────────────
/**
 * @param {string} text
 * @param {number} topK how many alternatives to return alongside the winner
 * @returns {{intent,confidence,lowConfidence,threshold,alternatives}|null}
 *          null when the model is unavailable or the text has no known features.
 */
function classify(text, topK = 3) {
  const m = load();
  if (!m) return null;

  const doc = preprocess(text);
  const active = [];
  tfidfInto(wordNgrams(doc), m.wordVocab, m.wordIdf, 0, active);
  tfidfInto(charWbNgrams(doc), m.charVocab, m.charIdf, m.charOffset, active);
  // Nothing recognisable in the message — say so rather than return the model's
  // intercept-only prior, which is a confident-looking answer to noise.
  if (active.length === 0) return null;

  const n = m.nClasses;
  const scores = new Float64Array(n);
  for (const [f, val] of active) {
    const off = f * n;                                  // model.bin is feature-major
    for (let k = 0; k < n; k++) scores[k] += val * m.coef[off + k];
  }
  for (let k = 0; k < n; k++) scores[k] += m.intercept[k];

  // CalibratedClassifierCV(method='sigmoid'): per-class sigmoid over the
  // decision function, then normalised across classes to sum to 1.
  const proba = new Float64Array(n);
  let sum = 0;
  for (let k = 0; k < n; k++) {
    proba[k] = 1 / (1 + Math.exp(m.calA[k] * scores[k] + m.calB[k]));
    sum += proba[k];
  }
  if (sum > 0) { for (let k = 0; k < n; k++) proba[k] /= sum; }
  else { proba.fill(1 / n); }

  const order = Array.from({ length: n }, (_, k) => k).sort((a, b) => proba[b] - proba[a]);
  const best = order[0];

  return {
    intent: m.classes[best],
    confidence: proba[best],
    lowConfidence: proba[best] < m.threshold,
    threshold: m.threshold,
    alternatives: order.slice(1, Math.max(1, topK)).map(k => ({
      intent: m.classes[k], confidence: proba[k],
    })),
  };
}

/** Full probability vector — used by the parity harness, not by the app. */
function classifyFull(text) {
  const m = load();
  if (!m) return null;
  const doc = preprocess(text);
  const active = [];
  tfidfInto(wordNgrams(doc), m.wordVocab, m.wordIdf, 0, active);
  tfidfInto(charWbNgrams(doc), m.charVocab, m.charIdf, m.charOffset, active);

  const n = m.nClasses;
  const scores = new Float64Array(n);
  for (const [f, val] of active) {
    const off = f * n;
    for (let k = 0; k < n; k++) scores[k] += val * m.coef[off + k];
  }
  for (let k = 0; k < n; k++) scores[k] += m.intercept[k];

  const proba = new Float64Array(n);
  let sum = 0;
  for (let k = 0; k < n; k++) {
    proba[k] = 1 / (1 + Math.exp(m.calA[k] * scores[k] + m.calB[k]));
    sum += proba[k];
  }
  if (sum > 0) { for (let k = 0; k < n; k++) proba[k] /= sum; }
  else { proba.fill(1 / n); }

  let best = 0;
  for (let k = 1; k < n; k++) if (proba[k] > proba[best]) best = k;
  return { intent: m.classes[best], confidence: proba[best],
           proba: Array.from(proba), nActive: active.length };
}

function isAvailable() { return Boolean(load()); }
function info() { const m = load(); return m ? m.provenance : null; }

module.exports = {
  classify, classifyFull, isAvailable, info,
  // exported for the parity harness
  _internals: { preprocess, wordNgrams, charWbNgrams },
};
