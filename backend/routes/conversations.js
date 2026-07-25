const express = require('express');
const { protect } = require('../middleware/auth');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { fail } = require('../utils/apiError');

const router = express.Router();

// GET /api/conversations[?q=] — sidebar list for the current user.
// With ?q=, returns only conversations whose messages match the search text.
router.get('/', protect, async (req, res) => {
  try {
    const { q } = req.query;
    let extra = {};
    if (q && q.trim()) {
      const ids = await Message.find({ content: new RegExp(escapeRegex(q.trim()), 'i') }).distinct('conversation');
      extra = { _id: { $in: ids } };
    }
    const conversations = await Conversation.find({ user: req.user._id, ...extra })
      .sort({ lastMessageAt: -1 }).limit(50);
    res.json({ success: true, conversations });
  } catch (err) {
    return fail(res, err, 'Could not load the conversation.');
  }
});

// GET /api/conversations/:id — resume a conversation (full transcript).
router.get('/:id', protect, async (req, res) => {
  try {
    const conversation = await Conversation.findOne({ _id: req.params.id, user: req.user._id });
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });
    const messages = await Message.find({ conversation: conversation._id }).sort({ createdAt: 1 });
    res.json({ success: true, conversation, messages });
  } catch (err) {
    return fail(res, err, 'Could not load the conversation.');
  }
});

// DELETE /api/conversations/:id — remove a thread and its messages.
router.delete('/:id', protect, async (req, res) => {
  try {
    const convo = await Conversation.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (convo) await Message.deleteMany({ conversation: convo._id });
    res.json({ success: true });
  } catch (err) {
    return fail(res, err, 'Could not load the conversation.');
  }
});

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

module.exports = router;
