const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  message: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['Alert', 'Info', 'Warning', 'Missed', 'Reminder', 'Success'], 
    default: 'Info' 
  },
  category: { 
    type: String, 
    enum: ['missed_dose', 'reminder', 'dose_taken', 'medicine_added', 'low_stock', 'caregiver_alert', 'general'],
    default: 'general',
    index: true
  },
  priority: { 
    type: String, 
    enum: ['high', 'medium', 'low'], 
    default: 'medium' 
  },
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
  medicineName: { type: String },
  dosage: { type: String },
  scheduledTime: { type: String },
  actionUrl: { type: String, default: '/dashboard' },
  readStatus: { type: Boolean, default: false, index: true }
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);

