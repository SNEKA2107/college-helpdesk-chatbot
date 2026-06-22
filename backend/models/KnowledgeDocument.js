const mongoose = require('mongoose');

// Phase 7 — admin-managed knowledge documents (regulations, handbooks, policies,
// academic rules, FAQs, faculty info). Richer than KnowledgeArticle: carries
// document metadata, an optional uploaded file (base64) and usage counters that
// power Knowledge Analytics. The Copilot retrieval layer text-searches `content`
// so answers can cite a document + section.
const CATEGORIES = ['Admissions', 'Attendance', 'Marks', 'Exams', 'Fees', 'Placements', 'Faculty', 'Hostel', 'Transport', 'Scholarships', 'General'];
const DOC_TYPES  = ['regulation', 'handbook', 'placement-policy', 'academic-rule', 'faculty-info', 'faq', 'general'];

const knowledgeDocSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  category:    { type: String, enum: CATEGORIES, default: 'General', index: true },
  docType:     { type: String, enum: DOC_TYPES, default: 'general' },
  description: { type: String, default: '' },
  // Searchable body text (extracted from the PDF or typed by the admin). Drives retrieval.
  content:     { type: String, default: '' },
  // Optional section/reference label surfaced in citations (e.g. "§4 Attendance Policy").
  section:     { type: String, default: '' },
  tags:        { type: [String], default: [] },

  // Optional uploaded file kept inline (base64) — same approach as User.photo. Excluded
  // from list queries via projection so the metadata grid stays light.
  fileName:    { type: String, default: '' },
  fileType:    { type: String, default: '' },
  fileSize:    { type: Number, default: 0 },
  fileData:    { type: String, default: '' },

  status:      { type: String, enum: ['draft', 'published'], default: 'published', index: true },

  // Knowledge Analytics counters (Module 6).
  accessCount: { type: Number, default: 0 },   // times cited/retrieved by the Copilot
  searchCount: { type: Number, default: 0 },   // times surfaced in an admin search

  uploadedBy:  { type: String, default: '' },
  version:     { type: Number, default: 1 },
}, { timestamps: true });

// Keyword retrieval until embeddings land (mirrors KnowledgeArticle).
knowledgeDocSchema.index({ title: 'text', content: 'text', description: 'text', tags: 'text' });

const KnowledgeDocument = mongoose.model('KnowledgeDocument', knowledgeDocSchema);
KnowledgeDocument.CATEGORIES = CATEGORIES;
KnowledgeDocument.DOC_TYPES = DOC_TYPES;

module.exports = KnowledgeDocument;
