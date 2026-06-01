const mongoose = require('mongoose');

const borrowedBookSchema = new mongoose.Schema({
  student:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentId:    { type: String, required: true, uppercase: true },
  book:         { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  title:        { type: String, required: true },
  author:       { type: String, required: true },
  borrowedDate: { type: String, required: true },
  dueDate:      { type: String, required: true },
  returnDate:   { type: String, default: null },
  status:       { type: String, enum: ['Active', 'Returned', 'Overdue'], default: 'Active' },
}, { timestamps: true });

module.exports = mongoose.model('BorrowedBook', borrowedBookSchema);
