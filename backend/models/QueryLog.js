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
}, { timestamps: true });

module.exports = mongoose.model('QueryLog', queryLogSchema);
