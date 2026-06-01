const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  category:    { type: String, required: true, enum: ['Technical','Cultural','Sports','Workshop','Seminar','Other'] },
  date:        { type: Date, required: true },
  time:        { type: String, default: '' },
  venue:       { type: String, required: true },
  organizer:   { type: String, required: true },
  description: { type: String, default: '' },
  seats:       { type: Number, default: 100 },
  registrations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);
