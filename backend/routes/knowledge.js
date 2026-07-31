const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const KnowledgeDocument = require('../models/KnowledgeDocument');
const QueryLog = require('../models/QueryLog');
const { logAudit } = require('../utils/audit');
const { fail, notFound } = require('../utils/apiError');
const { redactLabels } = require('../utils/redact');
const { validateUpload, DOCUMENT_TYPES } = require('../utils/upload');
const { pick, coerceQuery } = require('../utils/sanitize');

const router = express.Router();

// What an admin may change on a knowledge document. The analytics counters and
// uploadedBy are server-owned and absent by design.
const KB_UPDATE_FIELDS = ['title', 'category', 'docType', 'description', 'content',
                          'section', 'tags', 'status', 'fileName', 'fileType',
                          'fileSize', 'fileData'];

// Never ship the (potentially large) base64 file blob in list/CRUD responses.
const LIGHT = '-fileData';

function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// GET /api/knowledge/meta — category & doc-type vocab (keeps the admin UI in sync).
router.get('/meta', protect, adminOnly, (req, res) => {
  res.json({ success: true, categories: KnowledgeDocument.CATEGORIES, docTypes: KnowledgeDocument.DOC_TYPES });
});

// GET /api/knowledge/analytics — Knowledge + Training analytics (Modules 4 & 6).
router.get('/analytics', protect, adminOnly, async (req, res) => {
  try {
    const since14 = new Date(Date.now() - 14 * 24 * 3600 * 1000);
    const [
      docTotal, publishedTotal, byCategory, mostAccessed,
      datasetSize, ratedCount, byRating, intentDistribution,
      mostSearched, missingAreas, queryTrends, mostHelpful, leastHelpful,
    ] = await Promise.all([
      KnowledgeDocument.countDocuments(),
      KnowledgeDocument.countDocuments({ status: 'published' }),
      KnowledgeDocument.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      KnowledgeDocument.find().sort({ accessCount: -1 }).limit(8).select('title category accessCount'),
      QueryLog.countDocuments(),
      QueryLog.countDocuments({ rating: { $ne: null } }),
      QueryLog.aggregate([{ $match: { rating: { $ne: null } } }, { $group: { _id: '$rating', count: { $sum: 1 } } }]),
      QueryLog.aggregate([{ $group: { _id: '$intent', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      QueryLog.aggregate([{ $group: { _id: { $toLower: '$query' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
      QueryLog.aggregate([{ $match: { matched: false } }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
      QueryLog.aggregate([
        { $match: { createdAt: { $gte: since14 } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      QueryLog.aggregate([{ $match: { rating: 'up' } }, { $group: { _id: { $toLower: '$query' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
      QueryLog.aggregate([{ $match: { rating: 'down' } }, { $group: { _id: { $toLower: '$query' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
    ]);

    const ratingMap = Object.fromEntries(byRating.map(r => [r._id, r.count]));
    const helpful = ratingMap.up || 0;
    const notHelpful = ratingMap.down || 0;

    res.json({
      success: true,
      documents: { total: docTotal, published: publishedTotal, byCategory: byCategory.map(c => ({ label: c._id || 'General', value: c.count })) },
      mostAccessedDocuments: mostAccessed.map(d => ({ label: d.title, value: d.accessCount, category: d.category })),
      // Redacted for the same reason as the AI analytics panels.
      mostSearchedTopics: redactLabels(mostSearched.map(q => ({ label: q._id, value: q.count }))),
      missingKnowledgeAreas: missingAreas.map(m => ({ label: m._id || 'General', value: m.count })),
      queryTrends: queryTrends.map(d => ({ label: d._id.slice(5), value: d.count })),
      training: {
        datasetSize, ratedCount, helpful, notHelpful,
        helpfulRate: ratedCount ? Math.round((100 * helpful) / ratedCount) : 0,
        intentDistribution: intentDistribution.map(i => ({ label: i._id || 'general', value: i.count })),
        mostHelpful: redactLabels(mostHelpful.map(q => ({ label: q._id, value: q.count }))),
        leastHelpful: redactLabels(leastHelpful.map(q => ({ label: q._id, value: q.count }))),
      },
    });
  } catch (err) {
    console.error('Knowledge analytics error:', err.message);
    return fail(res, err, 'Could not complete the knowledge-base request.');
  }
});

// GET /api/knowledge — list documents (admin). Filters: ?category= &status= &q=
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const category = coerceQuery(req.query.category);
    const status   = coerceQuery(req.query.status);
    const q        = coerceQuery(req.query.q);
    const filter = {};
    if (category && category !== 'All') filter.category = category;
    if (status) filter.status = status;
    if (q && q.trim()) {
      const rx = new RegExp(escapeRegex(q.trim()), 'i');
      filter.$or = [{ title: rx }, { description: rx }, { tags: rx }, { content: rx }];
    }
    const documents = await KnowledgeDocument.find(filter).sort({ updatedAt: -1 }).select(LIGHT);
    res.json({ success: true, count: documents.length, documents });
  } catch (err) {
    return fail(res, err, 'Could not complete the knowledge-base request.');
  }
});

// GET /api/knowledge/:id — single document incl. file (admin).
router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await KnowledgeDocument.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
    res.json({ success: true, document: doc });
  } catch (err) {
    return fail(res, err, 'Could not complete the knowledge-base request.');
  }
});

// Strip HTML to prevent stored XSS in the searchable text fields.
const clean = (s) => (typeof s === 'string' ? s.replace(/<[^>]*>/g, '') : s);

// POST /api/knowledge — create/upload a document (admin).
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { title, category, docType, description, content, section, tags, status, fileName, fileType, fileSize, fileData } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ success: false, message: 'Document title is required.' });
    if (!content && !fileData) return res.status(400).json({ success: false, message: 'Provide document text or upload a file.' });

    // fileData was persisted with no size and no type check at all.
    let file = null;
    if (fileData) {
      const r = validateUpload(fileData, fileName, fileType, {
        allowed: DOCUMENT_TYPES, maxBytes: 5 * 1024 * 1024, label: 'Document',
      });
      if (!r.ok) return res.status(400).json({ success: false, message: r.error });
      file = r.fields;
    }

    const doc = await KnowledgeDocument.create({
      title: clean(title.trim()),
      category: category || 'General',
      docType: docType || 'general',
      description: clean(description || ''),
      content: clean(content || ''),
      section: clean(section || ''),
      tags: Array.isArray(tags) ? tags.map(clean) : String(tags || '').split(',').map(t => clean(t.trim())).filter(Boolean),
      status: status === 'draft' ? 'draft' : 'published',
      fileName: file ? file.name : '', fileType: file ? file.type : '',
      fileSize: file ? file.size : 0, fileData: file ? file.data : '',
      uploadedBy: req.user.name,
    });
    await logAudit(req, 'knowledge.create', 'KnowledgeDocument', doc._id, { title: doc.title, category: doc.category });
    const out = doc.toObject(); delete out.fileData;
    res.status(201).json({ success: true, message: 'Document saved', document: out });
  } catch (err) {
    return fail(res, err, 'Could not complete the knowledge-base request.');
  }
});

// PUT /api/knowledge/:id — edit metadata/content (admin).
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    // Allowlist: a spread let an admin overwrite accessCount, searchCount,
    // uploadedBy and version, and fed unfiltered keys to the update caster.
    const update = pick(req.body, KB_UPDATE_FIELDS);
    if (update.fileData) {
      const r = validateUpload(update.fileData, update.fileName, update.fileType, {
        allowed: DOCUMENT_TYPES, maxBytes: 5 * 1024 * 1024, label: 'Document',
      });
      if (!r.ok) return res.status(400).json({ success: false, message: r.error });
      update.fileData = r.fields.data;
      update.fileName = r.fields.name;
      update.fileType = r.fields.type;
      update.fileSize = r.fields.size;
    }
    ['title', 'description', 'content', 'section'].forEach(k => { if (update[k] != null) update[k] = clean(update[k]); });
    if (typeof update.tags === 'string') update.tags = update.tags.split(',').map(t => clean(t.trim())).filter(Boolean);
    update.$inc = { version: 1 };
    const doc = await KnowledgeDocument.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select(LIGHT);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
    await logAudit(req, 'knowledge.update', 'KnowledgeDocument', doc._id, { title: doc.title });
    res.json({ success: true, document: doc });
  } catch (err) {
    return fail(res, err, 'Could not complete the knowledge-base request.');
  }
});

// DELETE /api/knowledge/:id (admin).
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await KnowledgeDocument.findByIdAndDelete(req.params.id);
    if (!doc) return notFound(res, 'Document');   // audit finding L-1
    await logAudit(req, 'knowledge.delete', 'KnowledgeDocument', doc._id, { title: doc.title });
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    return fail(res, err, 'Could not complete the knowledge-base request.');
  }
});

module.exports = router;
