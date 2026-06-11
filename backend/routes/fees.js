const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const Fee = require('../models/Fee');

const router = express.Router();

// GET /api/fees — Student's own fee record
router.get('/', protect, async (req, res) => {
  try {
    const fee = await Fee.findOne({ student: req.user._id });
    if (!fee) return res.status(404).json({ success: false, message: 'No fee record found.' });

    const amountPaid = fee.history.reduce((sum, p) => sum + p.amount, 0);
    res.json({
      success: true,
      fees: {
        _id:          fee._id,
        semester:     fee.semester,
        academicYear: fee.academicYear,
        components:   fee.components,
        total:        fee.total,
        dueDate:      fee.dueDate,
        lateFine:     fee.lateFine,
        amountPaid,
        balance:      fee.total - amountPaid,
        status:       amountPaid >= fee.total ? 'Paid' : 'Pending',
        history:      fee.history,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/fees/payment — Record a payment for the logged-in student
router.post('/payment', protect, async (req, res) => {
  const { amount, mode, txn } = req.body;
  if (!amount || !mode) {
    return res.status(400).json({ success: false, message: 'Amount and mode are required.' });
  }
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 500000) {
    return res.status(400).json({ success: false, message: 'Amount must be a positive number not exceeding ₹5,00,000.' });
  }
  try {
    const fee = await Fee.findOne({ student: req.user._id });
    if (!fee) return res.status(404).json({ success: false, message: 'No fee record found.' });

    const payment = {
      date:        new Date().toISOString().split('T')[0],
      description: `Semester ${fee.semester} – Payment`,
      amount:      Number(amount),
      mode,
      txn:         txn || 'MANUAL',
    };
    fee.history.push(payment);
    await fee.save();

    res.json({ success: true, message: 'Payment recorded successfully.', payment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/fees/all — Admin: all student fee records
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const fees = await Fee.find().populate('student', 'name studentId department');
    res.json({ success: true, count: fees.length, fees });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
