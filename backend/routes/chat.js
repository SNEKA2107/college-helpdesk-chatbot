const express = require('express');
const { protect } = require('../middleware/auth');
const { generate } = require('../services/aiAgent');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const QueryLog = require('../models/QueryLog');

const router = express.Router();

// POST /api/chat — ask the Campus Copilot. Persists the turn, returns the answer
// with its source citations and suggested follow-ups, and logs the query.
router.post('/', protect, async (req, res) => {
  const { message, conversationId } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Message is required' });
  }
  if (message.length > 1000) {
    return res.status(400).json({ success: false, message: 'Message must be 1000 characters or fewer.' });
  }
  const text = message.trim();

  try {
    // Resume an existing conversation (owned by this user) or start a new one.
    let convo = conversationId
      ? await Conversation.findOne({ _id: conversationId, user: req.user._id })
      : null;
    if (!convo) {
      convo = await Conversation.create({ user: req.user._id, title: text.slice(0, 48) });
    }

    // Conversation memory: prior turns feed back into the model.
    const history = await Message.find({ conversation: convo._id }).sort({ createdAt: 1 }).limit(20);
    await Message.create({ conversation: convo._id, role: 'user', content: text });

    const t0 = Date.now();
    const { reply, intent, sources, followUps, matched } = await generate({ message: text, history, user: req.user });
    const latencyMs = Date.now() - t0;

    await Message.create({ conversation: convo._id, role: 'assistant', content: reply, intent, sources, followUps, latencyMs });
    await Conversation.updateOne({ _id: convo._id }, { lastMessageAt: new Date(), $inc: { messageCount: 2 } });
    await QueryLog.create({ user: req.user._id, query: text, intent, matched, latencyMs, hour: new Date().getHours() });

    res.json({
      success: true,
      conversationId: convo._id,
      message: reply,
      sources,
      followUps,
      intent,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ success: false, message: 'Could not process your message. Please try again.' });
  }
});

module.exports = router;
