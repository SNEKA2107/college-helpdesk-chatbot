const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title:    { type: String, required: true, trim: true },
  author:   { type: String, required: true, trim: true },
  isbn:     { type: String, required: true, unique: true, trim: true },
  category: { type: String, required: true },
  status:   { type: String, enum: ['Available', 'Borrowed', 'Reserved'], default: 'Available' },
  copies:   { type: Number, default: 1, min: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Book', bookSchema);
