const mongoose = require('mongoose');

// A single retrieved source backing an assistant answer (AI Source Citations).
// `refId` is optional because some sources (aggregated attendance/marks) are
// computed from many rows rather than one document.
const sourceSchema = new mongoose.Schema({
  type:  { type: String, enum: ['notice', 'exam', 'attendance', 'fee', 'marks', 'kb', 'faculty', 'success'] },
  refId: { type: mongoose.Schema.Types.ObjectId },
  label: { type: String, default: '' },
}, { _id: false });

const messageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  role:      { type: String, enum: ['user', 'assistant'], required: true },
  content:   { type: String, required: true },
  intent:    { type: String, default: '' },
  sources:   [sourceSchema],
  followUps: [String],
  // Per-message thumbs feedback (Feedback Monitoring, Phase 4). Null = no rating yet.
  feedback:  { type: String, enum: ['up', 'down', null], default: null },
  latencyMs: { type: Number },
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
