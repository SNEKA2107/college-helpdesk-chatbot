const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const Faculty = require('../models/Faculty');
const { logAudit } = require('../utils/audit');

const router = express.Router();

function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// GET /api/faculty — list/search the directory (any authenticated user).
// Filters: ?q= (name/subject/department) &department= &hod=true
router.get('/', protect, async (req, res) => {
  try {
    const { q, department, hod } = req.query;
    const filter = { isActive: { $ne: false } };
    if (department && department !== 'All') filter.department = department;
    if (hod === 'true') filter.isHOD = true;
    if (q && q.trim()) {
      const rx = new RegExp(escapeRegex(q.trim()), 'i');
      filter.$or = [{ name: rx }, { subjects: rx }, { department: rx }, { designation: rx }, { email: rx }];
    }
    const faculty = await Faculty.find(filter).sort({ isHOD: -1, name: 1 });
    res.json({ success: true, count: faculty.length, faculty });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const clean = (s) => (typeof s === 'string' ? s.replace(/<[^>]*>/g, '') : s);

function normalise(body) {
  const out = { ...body };
  ['name', 'designation', 'officeLocation', 'phone', 'department'].forEach(k => { if (out[k] != null) out[k] = clean(out[k]); });
  if (typeof out.subjects === 'string') out.subjects = out.subjects.split(',').map(s => clean(s.trim())).filter(Boolean);
  return out;
}

// POST /api/faculty — add a faculty member (admin).
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const body = normalise(req.body);
    if (!body.name || !body.name.trim()) return res.status(400).json({ success: false, message: 'Faculty name is required.' });
    const faculty = await Faculty.create(body);
    await logAudit(req, 'faculty.create', 'Faculty', faculty._id, { name: faculty.name, department: faculty.department });
    res.status(201).json({ success: true, message: 'Faculty added', faculty });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/faculty/:id (admin).
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const faculty = await Faculty.findByIdAndUpdate(req.params.id, normalise(req.body), { new: true, runValidators: true });
    if (!faculty) return res.status(404).json({ success: false, message: 'Faculty not found' });
    await logAudit(req, 'faculty.update', 'Faculty', faculty._id, { name: faculty.name });
    res.json({ success: true, faculty });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/faculty/:id (admin).
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const faculty = await Faculty.findByIdAndDelete(req.params.id);
    if (faculty) await logAudit(req, 'faculty.delete', 'Faculty', faculty._id, { name: faculty.name });
    res.json({ success: true, message: 'Faculty removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
