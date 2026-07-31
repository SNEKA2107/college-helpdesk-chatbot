const express = require('express');
const Notice  = require('../models/Notice');
const { protect, adminOnly } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { summarizeNotice } = require('../services/summarizer');
const { fail, notFound } = require('../utils/apiError');
const { pick, coerceQuery } = require('../utils/sanitize');
const { resolveDepartment } = require('../services/departments');

const router = express.Router();

// What an admin may change on an existing notice.
const NOTICE_UPDATE_FIELDS = ['title', 'content', 'category', 'pinned',
                              'expiresAt', 'status', 'audience', 'isActive'];

// GET /api/notices — notices visible to the requester.
//  • Students/faculty: only published, active, non-expired notices addressed to them.
//  • Admins:           the full management view (every status), optionally filtered by ?status / ?category.
router.get('/', protect, async (req, res) => {
  try {
    // Coerced: Express parses ?status[$ne]=draft into a Mongo operator object.
    const category = coerceQuery(req.query.category);
    const status   = coerceQuery(req.query.status);

    let filter;
    if (req.user.role === 'admin') {
      // Management view — admins can see drafts/archived too.
      filter = {};
      if (status) filter.status = status;
    } else {
      // Shared visibility rules (published + active + unexpired + audience match)
      // live on the model so every reader-facing query stays in step.
      filter = Notice.liveFilter(req.user);
    }
    if (category) filter.category = category;

    // Students sort by publishedAt DESC; pinned floats to the top. createdAt is the
    // tiebreaker for legacy rows whose publishedAt has not been backfilled yet.
    const notices = await Notice.find(filter).sort({ pinned: -1, publishedAt: -1, createdAt: -1 });
    res.json({ success: true, count: notices.length, notices });
  } catch (err) {
    return fail(res, err, 'Could not complete the notice request.');
  }
});

// Strip HTML tags to prevent stored XSS
function stripHtml(str) {
  return typeof str === 'string' ? str.replace(/<[^>]*>/g, '') : str;
}

// Validate/normalise an audience value; defaults to 'all' when missing or invalid.
// A notice may target everyone, a role, or any ACTIVE department — department
// codes now come from the Department collection, not a hardcoded list, so a
// newly created department can be targeted immediately (audit finding H-1).
async function normaliseAudience(value) {
  if (!value) return 'all';
  if (Notice.ROLE_AUDIENCES.includes(value)) return value;
  const dept = await resolveDepartment(value);
  return dept.ok ? dept.code : 'all';
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
      audience:    await normaliseAudience(audience),
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
    return fail(res, err, 'Could not complete the notice request.');
  }
});

// PUT /api/notices/:id — Edit/transition notice (admin). Handles draft→published,
// published→archived, expiry/audience edits, etc.
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    // Allowlist instead of spreading the body: createdBy, postedBy, publishedAt
    // and the AI summary fields are server-owned, and a spread also supplied the
    // sink for the mongoose update-casting prototype-pollution advisory.
    const update = pick(req.body, NOTICE_UPDATE_FIELDS);
    if (update.title)    update.title    = stripHtml(update.title);
    if (update.content)  update.content  = stripHtml(update.content);
    if (update.audience) update.audience = await normaliseAudience(update.audience);
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
    return fail(res, err, 'Could not complete the notice request.');
  }
});

// DELETE /api/notices/:id — Delete notice (admin)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const notice = await Notice.findByIdAndDelete(req.params.id);
    if (!notice) return notFound(res, 'Notice');   // audit finding L-1
    await logAudit(req, 'notice.delete', 'Notice', notice._id, { title: notice.title });
    res.json({ success: true, message: 'Notice deleted' });
  } catch (err) {
    return fail(res, err, 'Could not delete the notice.');
  }
});

module.exports = router;
