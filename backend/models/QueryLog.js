const mongoose = require('mongoose');

// One row per student question to the Copilot. Powers the AI Analytics /
// Insights screens (top questions, intent mix, peak hours, knowledge gaps).
const queryLogSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  query:     { type: String, required: true },
  intent:    { type: String, default: 'general', index: true },
  // false when retrieval found no grounding facts → surfaces as a knowledge-base gap.
  matched:   { type: Boolean, default: true },
  latencyMs: { type: Number },
  hour:      { type: Number },   // 0-23, for the peak-usage heatmap

  // ── Phase 7: AI training-data collection ────────────────────────────────────
  // Each row is a labelled (query → response) training example. All optional so
  // existing rows and code paths stay valid.
  response:  { type: String, default: '' },                                  // the Copilot answer
  rating:    { type: String, enum: ['up', 'down', null], default: null, index: true }, // 👍 / 👎 feedback
  category:  { type: String, default: 'General' },                            // knowledge category (from intent)
  role:      { type: String, default: 'student' },                           // asker's role
  message:   { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },       // assistant message rated

  // ── Intent classifier telemetry ─────────────────────────────────────────────
  // Which router produced `intent`, and how confident it was. Rows with
  // source 'keyword' are the ones the model declined (below its calibrated
  // threshold) — together with the 👎 rows they are the shortlist of real
  // questions worth relabelling and feeding into the next training run.
  confidence: { type: Number, default: null },
  source:     { type: String, enum: ['model', 'keyword'], default: 'keyword', index: true },
}, { timestamps: true });

// ── Retention ───────────────────────────────────────────────────────────────
// Every row pairs a student's question text with their identity, and the rows
// were kept forever. A defined retention window bounds how much personal data
// the analytics feature accumulates: MongoDB's TTL monitor removes documents
// once `createdAt` passes the window, with no application code to run.
//
// The analytics screens read the last 14-30 days, so the default comfortably
// covers every dashboard. Override with QUERYLOG_RETENTION_DAYS.
const RETENTION_DAYS = Number(process.env.QUERYLOG_RETENTION_DAYS || 180);
queryLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

const QueryLog = mongoose.model('QueryLog', queryLogSchema);
QueryLog.RETENTION_DAYS = RETENTION_DAYS;

module.exports = QueryLog;
