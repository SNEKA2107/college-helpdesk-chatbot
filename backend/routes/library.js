const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const Book         = require('../models/Book');
const BorrowedBook = require('../models/BorrowedBook');
const { fail, badRequest } = require('../utils/apiError');
const { coerceQuery, searchRegex, pick } = require('../utils/sanitize');

const router = express.Router();

// Fields an admin may set on a book. Anything else in the body is discarded.
const BOOK_FIELDS = ['title', 'author', 'isbn', 'category', 'status', 'copies'];

// GET /api/library — All books with optional search/filter
router.get('/', protect, async (req, res) => {
  try {
    const query = {};
    // searchRegex escapes metacharacters and caps the length. Building the
    // pattern from the raw parameter let any logged-in student send (a+)+$ and
    // burn minutes of CPU per document — Mongo evaluates it server-side.
    const rx = searchRegex(req.query.search);
    if (rx) query.$or = [{ title: rx }, { author: rx }];
    // coerceQuery rejects ?category[$ne]=x, which Express parses into a Mongo
    // operator object and which would otherwise land straight in the filter.
    const category = coerceQuery(req.query.category);
    const status   = coerceQuery(req.query.status);
    if (category) query.category = category;
    if (status)   query.status = status;

    const books = await Book.find(query).sort({ title: 1 });
    res.json({ success: true, count: books.length, books });
  } catch (err) {
    return fail(res, err, 'Could not complete the library request.');
  }
});

// GET /api/library/borrowed — Student's borrowed books
router.get('/borrowed', protect, async (req, res) => {
  try {
    const borrowed = await BorrowedBook.find({ student: req.user._id, status: { $ne: 'Returned' } })
      .populate('book', 'isbn category');
    res.json({ success: true, count: borrowed.length, borrowed });
  } catch (err) {
    return fail(res, err, 'Could not complete the library request.');
  }
});

// GET /api/library/hours
router.get('/hours', protect, (req, res) => {
  res.json({
    success: true,
    hours: {
      'Monday–Friday': '8:00 AM – 6:00 PM',
      'Saturday':      '9:00 AM – 4:00 PM',
      'Sunday':        'Closed',
      'Holidays':      'Closed',
    }
  });
});

// POST /api/library/renew/:borrowId — Renew a borrowed book
router.post('/renew/:borrowId', protect, async (req, res) => {
  try {
    const record = await BorrowedBook.findOne({ _id: req.params.borrowId, student: req.user._id });
    if (!record) return res.status(404).json({ success: false, message: 'Borrowed book not found.' });
    res.json({ success: true, message: 'Book renewal requested. Librarian will confirm within 24 hours.' });
  } catch (err) {
    return fail(res, err, 'Could not complete the library request.');
  }
});

// POST /api/library — Admin: add a book
router.post('/', protect, adminOnly, async (req, res) => {
  // Audit finding M-2: a bad body is a client error, not a server fault.
  const { title, author } = req.body || {};
  if (!title || !String(title).trim())  return badRequest(res, 'Book title is required.');
  if (!author || !String(author).trim()) return badRequest(res, 'Book author is required.');

  try {
    // Explicit allowlist: spreading req.body let a caller set fields the UI never
    // offers, and supplied the sink for the mongoose update-casting advisory.
    const book = await Book.create(pick(req.body, BOOK_FIELDS));
    res.status(201).json({ success: true, book });
  } catch (err) {
    return fail(res, err, 'Could not add the book.');
  }
});

// PUT /api/library/:id — Admin: update a book
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const book = await Book.findByIdAndUpdate(req.params.id, pick(req.body, BOOK_FIELDS), { new: true, runValidators: true });
    if (!book) return res.status(404).json({ success: false, message: 'Book not found.' });
    res.json({ success: true, book });
  } catch (err) {
    return fail(res, err, 'Could not complete the library request.');
  }
});

module.exports = router;
