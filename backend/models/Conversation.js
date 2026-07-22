const mongoose = require('mongoose');

// A Campus Copilot chat thread owned by one user. Lightweight header row;
// the actual turns live in the Message collection (keyed by `conversation`).
const conversationSchema = new mongoose.Schema({
  user:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title:         { type: String, default: 'New chat' },
  lastMessageAt: { type: Date, default: Date.now },
  messageCount:  { type: Number, default: 0 },
}, { timestamps: true });

// Sidebar query: a user's conversations, most-recently-active first.
conversationSchema.index({ user: 1, lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
