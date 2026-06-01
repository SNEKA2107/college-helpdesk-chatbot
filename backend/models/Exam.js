const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  semester:             { type: String, required: true },
  academicYear:         { type: String, required: true },
  theoryStart:          { type: String },
  theoryEnd:            { type: String },
  hallTicketAvailable:  { type: String },
  schedule: [{
    date:    { type: String, required: true },
    subject: { type: String, required: true },
    code:    { type: String, required: true },
    session: { type: String, required: true },
  }],
  practicals: [{
    date:    { type: String, required: true },
    subject: { type: String, required: true },
    lab:     { type: String, required: true },
    time:    { type: String, required: true },
  }],
  instructions: [String],
}, { timestamps: true });

module.exports = mongoose.model('Exam', examSchema);
