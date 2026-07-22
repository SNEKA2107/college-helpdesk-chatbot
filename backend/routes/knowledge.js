const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const KnowledgeDocument = require('../models/KnowledgeDocument');
const QueryLog = require('../models/QueryLog');
const { logAudit } = require('../utils/audit');

const router = express.Router();

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
      mostSearchedTopics: mostSearched.map(q => ({ label: q._id, value: q.count })),
      missingKnowledgeAreas: missingAreas.map(m => ({ label: m._id || 'General', value: m.count })),
      queryTrends: queryTrends.map(d => ({ label: d._id.slice(5), value: d.count })),
      training: {
        datasetSize, ratedCount, helpful, notHelpful,
        helpfulRate: ratedCount ? Math.round((100 * helpful) / ratedCount) : 0,
        intentDistribution: intentDistribution.map(i => ({ label: i._id || 'general', value: i.count })),
        mostHelpful: mostHelpful.map(q => ({ label: q._id, value: q.count })),
        leastHelpful: leastHelpful.map(q => ({ label: q._id, value: q.count })),
      },
    });
  } catch (err) {
    console.error('Knowledge analytics error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/knowledge — list documents (admin). Filters: ?category= &status= &q=
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { category, status, q } = req.query;
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
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/knowledge/:id — single document incl. file (admin).
router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await KnowledgeDocument.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
    res.json({ success: true, document: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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

    const doc = await KnowledgeDocument.create({
      title: clean(title.trim()),
      category: category || 'General',
      docType: docType || 'general',
      description: clean(description || ''),
      content: clean(content || ''),
      section: clean(section || ''),
      tags: Array.isArray(tags) ? tags.map(clean) : String(tags || '').split(',').map(t => clean(t.trim())).filter(Boolean),
      status: status === 'draft' ? 'draft' : 'published',
      fileName: fileName || '', fileType: fileType || '', fileSize: fileSize || 0, fileData: fileData || '',
      uploadedBy: req.user.name,
    });
    await logAudit(req, 'knowledge.create', 'KnowledgeDocument', doc._id, { title: doc.title, category: doc.category });
    const out = doc.toObject(); delete out.fileData;
    res.status(201).json({ success: true, message: 'Document saved', document: out });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/knowledge/:id — edit metadata/content (admin).
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const update = { ...req.body };
    ['title', 'description', 'content', 'section'].forEach(k => { if (update[k] != null) update[k] = clean(update[k]); });
    if (typeof update.tags === 'string') update.tags = update.tags.split(',').map(t => clean(t.trim())).filter(Boolean);
    update.$inc = { version: 1 };
    const doc = await KnowledgeDocument.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select(LIGHT);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
    await logAudit(req, 'knowledge.update', 'KnowledgeDocument', doc._id, { title: doc.title });
    res.json({ success: true, document: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/knowledge/:id (admin).
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const doc = await KnowledgeDocument.findByIdAndDelete(req.params.id);
    if (doc) await logAudit(req, 'knowledge.delete', 'KnowledgeDocument', doc._id, { title: doc.title });
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
