const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  student:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  studentId:  String,
  name:       String,
  email:      String,
  department: { type: String, required: true },
  subject:    { type: String, required: true },
  message:    { type: String, required: true },
  status:     { type: String, enum: ['Open', 'Resolved'], default: 'Open' },
}, { timestamps: true });

module.exports = mongoose.model('Contact', contactSchema);
