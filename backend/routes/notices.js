const express = require('express');
const Notice  = require('../models/Notice');
const { protect, adminOnly } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { summarizeNotice } = require('../services/summarizer');

const router = express.Router();

// Audiences a given user is allowed to receive. Students get 'all', 'student'
// and their own department; admins get everything role-targeted at them.
function audiencesFor(user) {
  if (user.role === 'admin') return ['all', 'admin'];
  const list = ['all', 'student'];
  if (user.department) list.push(user.department);
  return list;
}

// GET /api/notices — notices visible to the requester.
//  • Students: only published, non-expired notices whose audience matches them.
//  • Admins:   the full management view (every status), optionally filtered by ?status / ?category.
router.get('/', protect, async (req, res) => {
  try {
    const { category, status } = req.query;

    let filter;
    if (req.user.role === 'admin') {
      // Management view — admins can see drafts/archived too.
      filter = {};
      if (status) filter.status = status;
    } else {
      const now = new Date();
      filter = {
        // $nin matches 'published' AND legacy rows with no status field (backward compatible).
        status:   { $nin: ['draft', 'archived'] },
        isActive: { $ne: false },
        // $and of two OR-groups: audience match (legacy rows with no audience are treated as 'all'),
        // and not-expired (no expiry set, or expiry in the future).
        $and: [
          { $or: [{ audience: { $in: audiencesFor(req.user) } }, { audience: { $exists: false } }, { audience: null }] },
          { $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }] },
        ],
      };
    }
    if (category) filter.category = category;

    // Students sort by publishedAt DESC; pinned floats to the top. createdAt is the
    // tiebreaker for legacy rows whose publishedAt has not been backfilled yet.
    const notices = await Notice.find(filter).sort({ pinned: -1, publishedAt: -1, createdAt: -1 });
    res.json({ success: true, count: notices.length, notices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Strip HTML tags to prevent stored XSS
function stripHtml(str) {
  return typeof str === 'string' ? str.replace(/<[^>]*>/g, '') : str;
}

// Validate/normalise an audience value; defaults to 'all' when missing or invalid.
function normaliseAudience(value) {
  return Notice.AUDIENCES.includes(value) ? value : 'all';
}

// POST /api/notices — Create notice (admin). Supports saving as draft or publishing.
router.post('/', protect, adminOnly, async (req, res) => {
  const { title, content, category, pinned, expiresAt, status, audience } = req.body;
  if (!title || !content) {
    return res.status(400).json({ success: false, message: 'Title and content are required.' });
  }
  const lifecycle = status === 'draft' ? 'draft' : 'published';
  try {
    const cleanTitle = stripHtml(title);
    const cleanContent = stripHtml(content);
    // Smart Notice Summarizer — graceful: returns a heuristic fallback if AI is unavailable.
    const ai = await summarizeNotice({ title: cleanTitle, content: cleanContent, category: category || 'general' });
    const notice = await Notice.create({
      title:       cleanTitle,
      content:     cleanContent,
      category:    category || 'general',
      postedBy:    req.user.name,
      createdBy:   req.user._id,
      status:      lifecycle,
      audience:    normaliseAudience(audience),
      pinned:      !!pinned,
      summary:     ai.summary,
      keyDates:    ai.keyDates,
      actionItems: ai.actionItems,
      aiPriority:  ai.priority,
      // Stamp the publish time only when it actually goes live.
      publishedAt: lifecycle === 'published' ? new Date() : null,
      expiresAt:   expiresAt ? new Date(expiresAt) : undefined,
    });
    await logAudit(req, lifecycle === 'draft' ? 'notice.draft' : 'notice.create', 'Notice', notice._id, { title: notice.title, category: notice.category, audience: notice.audience });
    res.status(201).json({ success: true, message: lifecycle === 'draft' ? 'Draft saved' : 'Notice published', notice });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/notices/:id — Edit/transition notice (admin). Handles draft→published,
// published→archived, expiry/audience edits, etc.
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.title)    update.title    = stripHtml(update.title);
    if (update.content)  update.content  = stripHtml(update.content);
    if (update.audience) update.audience = normaliseAudience(update.audience);
    if ('expiresAt' in update) update.expiresAt = update.expiresAt ? new Date(update.expiresAt) : null;

    const current = await Notice.findById(req.params.id);
    if (!current) return res.status(404).json({ success: false, message: 'Notice not found' });

    // Stamp publishedAt the first time a notice transitions into 'published'.
    if (update.status === 'published' && !current.publishedAt && !update.publishedAt) {
      update.publishedAt = new Date();
    }

    // Regenerate the AI summary when the wording changes.
    if (update.title || update.content) {
      const ai = await summarizeNotice({
        title: update.title || current.title,
        content: update.content || current.content,
        category: update.category || current.category,
      });
      update.summary = ai.summary;
      update.keyDates = ai.keyDates;
      update.actionItems = ai.actionItems;
      update.aiPriority = ai.priority;
    }

    const notice = await Notice.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (update.status && update.status !== current.status) {
      await logAudit(req, `notice.${update.status}`, 'Notice', notice._id, { title: notice.title });
    }
    res.json({ success: true, notice });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/notices/:id — Delete notice (admin)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const notice = await Notice.findByIdAndDelete(req.params.id);
    if (notice) await logAudit(req, 'notice.delete', 'Notice', notice._id, { title: notice.title });
    res.json({ success: true, message: 'Notice deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
