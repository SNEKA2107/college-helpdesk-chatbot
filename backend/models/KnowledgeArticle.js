const mongoose = require('mongoose');

// Editable knowledge base used to ground the Copilot beyond live DB records
// (policies, FAQs, scholarship rules, etc.). Admin-managed in Phase 5; the
// retrieval layer already reads from it so answers can cite KB articles.
const kbSchema = new mongoose.Schema({
  title:    { type: String, required: true },
  body:     { type: String, required: true },
  category: { type: String, default: 'general' },
  tags:     [String],
  status:   { type: String, enum: ['draft', 'published'], default: 'published', index: true },
  // Reserved for the Phase 6 semantic-search upgrade (cosine similarity / Atlas Vector Search).
  embedding:{ type: [Number], default: undefined },
  updatedBy:{ type: String, default: '' },
}, { timestamps: true });

// Keyword retrieval until embeddings land.
kbSchema.index({ title: 'text', body: 'text', tags: 'text' });

module.exports = mongoose.model('KnowledgeArticle', kbSchema);
