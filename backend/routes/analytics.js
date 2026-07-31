const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const QueryLog = require('../models/QueryLog');
const Conversation = require('../models/Conversation');
const { fail } = require('../utils/apiError');
const { redactLabels } = require('../utils/redact');

const router = express.Router();

// GET /api/analytics — AI usage analytics for admins, computed from QueryLog.
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const since30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const [total, topQuestions, byIntent, byHour, byDay, unanswered, conversations, activeUsers] = await Promise.all([
      QueryLog.countDocuments(),
      QueryLog.aggregate([
        { $group: { _id: { $toLower: '$query' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 10 },
      ]),
      QueryLog.aggregate([
        { $group: { _id: '$intent', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      QueryLog.aggregate([
        { $group: { _id: '$hour', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      QueryLog.aggregate([
        { $match: { createdAt: { $gte: since30 } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      QueryLog.aggregate([
        { $match: { matched: false } },
        { $group: { _id: { $toLower: '$query' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 10 },
      ]),
      Conversation.countDocuments(),
      QueryLog.distinct('user'),
    ]);

    // Fill all 24 hours so the peak-usage chart has no gaps.
    const hourMap = Object.fromEntries(byHour.map(h => [h._id, h.count]));
    const peakHours = Array.from({ length: 24 }, (_, h) => ({ label: String(h).padStart(2, '0'), value: hourMap[h] || 0 }));

    const resolved = total ? Math.round((100 * (total - unanswered.reduce((s, u) => s + u.count, 0))) / total) : 100;

    res.json({
      success: true,
      kpis: {
        totalQueries: total,
        conversations,
        activeUsers: activeUsers.filter(Boolean).length,
        resolutionRate: resolved,
      },
      // Redacted: these labels are student-written text shown to an admin, and
      // routinely contain register numbers, phone numbers or email addresses.
      topQuestions:  redactLabels(topQuestions.map(q => ({ label: q._id, value: q.count }))),
      categories:    byIntent.map(i => ({ label: i._id || 'general', value: i.count })),
      peakHours,
      dailyUsage:    byDay.map(d => ({ label: d._id.slice(5), value: d.count })),
      knowledgeGaps: redactLabels(unanswered.map(u => ({ label: u._id, value: u.count }))),
    });
  } catch (err) {
    console.error('Analytics error:', err.message);
    return fail(res, err, 'Could not load analytics.');
  }
});

module.exports = router;
