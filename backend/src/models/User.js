const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  clerkId: { type: String, sparse: true, index: true },
  name: { type: String, default: 'User' },
  email: { type: String, default: '' },
  role: { 
    type: String, 
    enum: ['Parent', 'Mentee', 'patient', 'caretaker', 'Caregiver', 'Patient', null], 
    default: null 
  },
  inviteCode: { type: String, unique: true, sparse: true, index: true },
  linkedParentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  profileImage: { type: String, default: '' },
  preferences: {
    voiceLanguage: { type: String, default: 'English' },
    theme: { type: String, default: 'Light' }
  },
  pushSubscription: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
