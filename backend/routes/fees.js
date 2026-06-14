const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const Fee = require('../models/Fee');

const router = express.Router();

// GET /api/fees — Student's own fee record
router.get('/', protect, async (req, res) => {
  try {
    const fee = await Fee.findOne({ student: req.user._id });
    if (!fee) return res.status(404).json({ success: false, message: 'No fee record found.' });

    const amountPaid   = fee.history.reduce((sum, p) => sum + p.amount, 0);
    const verifiedPaid = fee.history.reduce((sum, p) => sum + (p.verified ? p.amount : 0), 0);
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
        verifiedPaid,
        balance:      fee.total - amountPaid,
        status:       verifiedPaid >= fee.total ? 'Paid' : 'Pending',
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

    // CRIT-05: reject overpayment — a student can never record more than the balance due.
    const amountPaid = fee.history.reduce((sum, p) => sum + p.amount, 0);
    const balance    = fee.total - amountPaid;
    if (balance <= 0) {
      return res.status(400).json({ success: false, message: 'Your fees are fully recorded. No further payment is required.' });
    }
    if (parsedAmount > balance) {
      return res.status(400).json({ success: false, message: `Amount exceeds the balance due of ₹${balance.toLocaleString('en-IN')}.` });
    }

    const payment = {
      date:        new Date().toISOString().split('T')[0],
      description: `Semester ${fee.semester} – Payment`,
      amount:      parsedAmount,
      mode,
      txn:         txn || 'MANUAL',
      verified:    false,                 // pending admin verification
      recordedBy:  req.user.name || 'Student',
    };
    fee.history.push(payment);
    await fee.save();

    res.status(201).json({ success: true, message: 'Payment recorded. It is pending verification by the admin office.', payment });
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

// PUT /api/fees/:feeId/payments/:index/verify — Admin: confirm a recorded payment (CRIT-05)
router.put('/:feeId/payments/:index/verify', protect, adminOnly, async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.feeId);
    if (!fee) return res.status(404).json({ success: false, message: 'Fee record not found.' });

    const idx = Number(req.params.index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= fee.history.length) {
      return res.status(400).json({ success: false, message: 'Invalid payment index.' });
    }

    fee.history[idx].verified = true;
    fee.history[idx].recordedBy = fee.history[idx].recordedBy || 'Student';
    fee.markModified('history');
    await fee.save();

    res.json({ success: true, message: 'Payment verified.', payment: fee.history[idx] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
