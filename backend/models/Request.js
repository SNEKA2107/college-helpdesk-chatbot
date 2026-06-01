const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  student:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentId:  { type: String, required: true },
  type:       {
    type: String, required: true,
    enum: ['Marksheet','Bonafide Certificate','Transfer Certificate','Migration Certificate','Conduct Certificate','Provisional Certificate','Other']
  },
  purpose:    { type: String, required: true },
  urgency:    { type: String, enum: ['Normal','Urgent','Emergency'], default: 'Normal' },
  status:     {
    type: String,
    enum: ['Submitted','Under Review','Processing','Ready for Collection','Completed','Rejected'],
    default: 'Submitted'
  },
  refNumber:  { type: String, unique: true },
  remarks:    { type: String, default: '' },
  completedAt: { type: Date },
}, { timestamps: true });

requestSchema.pre('save', function(next) {
  if (!this.refNumber) {
    const prefix = this.type.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
    this.refNumber = `${prefix}-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`;
  }
  next();
});

module.exports = mongoose.model('Request', requestSchema);
