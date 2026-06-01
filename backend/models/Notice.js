const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
  title:     { type: String, required: true },
  content:   { type: String, required: true },
  category:  { type: String, enum: ['exam','fee','general','urgent','holiday'], default: 'general' },
  postedBy:  { type: String, required: true },
  isActive:  { type: Boolean, default: true },
  pinned:    { type: Boolean, default: false },
  expiresAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Notice', noticeSchema);
