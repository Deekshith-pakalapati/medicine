const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  dosage: { type: String, required: true },
  frequency: { type: String, required: true },
  notes: { type: String, default: '' },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  reminderTimes: [{ type: String, required: true }], // e.g. "08:00", "14:30"
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  takenLogs: [{ date: String, time: String }], // To track adherence and stop alarm repeats
  missedLogs: [{ date: String, time: String }], // To track missed dose alerts and avoid duplicate emails
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
}, { timestamps: true });

module.exports = mongoose.model('Medicine', medicineSchema);
