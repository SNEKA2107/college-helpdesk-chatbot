const express = require('express');
const { protect } = require('../middleware/auth');
const { generate } = require('../services/aiAgent');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const QueryLog = require('../models/QueryLog');
const { categoryForIntent } = require('../utils/intentCategory');

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
    const { reply, intent, sources, followUps, matched, confidence, category, source } =
      await generate({ message: text, history, user: req.user });
    const latencyMs = Date.now() - t0;

    const assistantMsg = await Message.create({ conversation: convo._id, role: 'assistant', content: reply, intent, sources, followUps, latencyMs });
    await Conversation.updateOne({ _id: convo._id }, { lastMessageAt: new Date(), $inc: { messageCount: 2 } });
    // Phase 7: log a complete (query → response) training example with category + role.
    await QueryLog.create({
      user: req.user._id, query: text, intent, matched, latencyMs, hour: new Date().getHours(),
      // The classifier already knows the knowledge category for its 78 intents;
      // categoryForIntent only covers the 9 legacy keyword intents and would
      // flatten everything else to 'General'.
      response: reply, category: category || categoryForIntent(intent),
      role: req.user.role, message: assistantMsg._id,
      // Which router answered, and how sure it was — this is what makes the
      // live log usable for retraining and for tuning the fallback threshold.
      confidence: typeof confidence === 'number' ? confidence : null,
      source: source || 'keyword',
    });

    res.json({
      success: true,
      conversationId: convo._id,
      messageId: assistantMsg._id,
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

// POST /api/chat/feedback — rate a Copilot answer 👍/👎 (Module 3). Persists the
// rating on the Message and mirrors it onto the QueryLog training example.
router.post('/feedback', protect, async (req, res) => {
  const { messageId, rating } = req.body;
  if (!['up', 'down'].includes(rating)) {
    return res.status(400).json({ success: false, message: 'Rating must be "up" or "down".' });
  }
  try {
    const msg = await Message.findById(messageId);
    if (!msg || msg.role !== 'assistant') {
      return res.status(404).json({ success: false, message: 'Answer not found.' });
    }
    // Ownership check: the conversation must belong to the requester.
    const convo = await Conversation.findOne({ _id: msg.conversation, user: req.user._id });
    if (!convo) return res.status(403).json({ success: false, message: 'Not your conversation.' });

    msg.feedback = rating;
    await msg.save();
    await QueryLog.updateOne({ message: msg._id }, { $set: { rating } });

    res.json({ success: true, rating });
  } catch (err) {
    console.error('Feedback error:', err.message);
    res.status(500).json({ success: false, message: 'Could not save your feedback.' });
  }
});

module.exports = router;
