const express = require('express');
const Notice  = require('../models/Notice');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/notices — Get active notices
router.get('/', protect, async (req, res) => {
  try {
    const { category } = req.query;
    const filter = req.user.role === 'admin' ? {} : { isActive: true };
    if (category) filter.category = category;
    const notices = await Notice.find(filter).sort({ pinned: -1, createdAt: -1 });
    res.json({ success: true, count: notices.length, notices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/notices — Create notice (admin)
router.post('/', protect, adminOnly, async (req, res) => {
  const { title, content, category, pinned, expiresAt } = req.body;
  if (!title || !content) {
    return res.status(400).json({ success: false, message: 'Title and content are required.' });
  }
  try {
    const notice = await Notice.create({
      title, content,
      category: category || 'general',
      postedBy: req.user.name,
      pinned: !!pinned,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined
    });
    res.status(201).json({ success: true, message: 'Notice created', notice });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/notices/:id — Edit notice (admin)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const notice = await Notice.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!notice) return res.status(404).json({ success: false, message: 'Notice not found' });
    res.json({ success: true, notice });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/notices/:id — Delete notice (admin)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Notice.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Notice deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
