const mongoose = require('mongoose');
const Medicine = require('../models/Medicine');
const User = require('../models/User');
const Notification = require('../models/Notification');
const dbStore = require('../services/dbStore');
const { sendMedicineAddedEmail } = require('../services/emailService');

const isDbReady = () => mongoose.connection.readyState === 1;

// Get medicines (Parent gets own, Mentee gets parent's)
const getMedicines = async (req, res) => {
  try {
    const clerkId = req.auth.userId;

    if (isDbReady()) {
      try {
        let user = await User.findOne({ clerkId });
        if (user) {
          let targetId = user._id;
          if (req.query.type === 'linked' || user.role === 'Mentee') {
            if (!user.linkedParentId) return res.json([]);
            targetId = user.linkedParentId;
          }
          const medicines = await Medicine.find({ parentId: targetId, status: 'Active' })
            .populate('parentId', 'name')
            .sort({ createdAt: -1 });
          return res.json(medicines);
        }
      } catch (err) {
        console.warn('MongoDB query failed in getMedicines, using memory fallback:', err.message);
      }
    }

    // In-memory fallback
    let user = dbStore.findUserByClerkId(clerkId) || dbStore.upsertUser(clerkId, { role: 'Parent' });
    let targetId = user._id;
    if (req.query.type === 'linked' || user.role === 'Mentee') {
      if (!user.linkedParentId) return res.json([]);
      targetId = user.linkedParentId;
    }

    const meds = dbStore.findMedicinesByParentId(targetId);
    res.json(meds);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add medicine
const addMedicine = async (req, res) => {
  try {
    const clerkId = req.auth.userId;

    if (isDbReady()) {
      try {
        let user = await User.findOne({ clerkId });
        if (!user) {
          user = new User({ clerkId, role: 'Parent', name: 'User', email: 'user@example.com' });
          await user.save();
        }

        let parentId = user._id;
        if (user.role === 'Mentee' || user.role === 'caretaker' || user.role === 'Caregiver') {
          if (!user.linkedParentId) return res.status(400).json({ message: 'Not linked to a patient. Please enter patient invite code first.' });
          parentId = user.linkedParentId;
        }

        const newMedicine = new Medicine({
          ...req.body,
          createdBy: user._id,
          parentId
        });

        await newMedicine.save();
        sendMedicineAddedEmail(parentId, newMedicine).catch(console.error);
        return res.status(201).json(newMedicine);
      } catch (err) {
        console.warn('MongoDB query failed in addMedicine, using memory fallback:', err.message);
      }
    }

    // In-memory fallback
    let user = dbStore.findUserByClerkId(clerkId) || dbStore.upsertUser(clerkId, { role: 'Parent' });
    let parentId = user._id;
    if (user.role === 'Mentee' || user.role === 'caretaker' || user.role === 'Caregiver') {
      if (!user.linkedParentId) return res.status(400).json({ message: 'Not linked to a patient. Please enter patient invite code first.' });
      parentId = user.linkedParentId;
    }

    const newMed = dbStore.createMedicine({
      ...req.body,
      createdBy: user._id,
      parentId
    });
    res.status(201).json(newMed);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update medicine
const updateMedicine = async (req, res) => {
  try {
    if (isDbReady()) {
      try {
        const medicine = await Medicine.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (medicine) return res.json(medicine);
      } catch (err) {
        console.warn('MongoDB query failed in updateMedicine, using memory fallback:', err.message);
      }
    }

    const updated = dbStore.updateMedicine(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: 'Medicine not found' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete medicine
const deleteMedicine = async (req, res) => {
  try {
    if (isDbReady()) {
      try {
        await Medicine.findByIdAndDelete(req.params.id);
        return res.json({ message: 'Medicine deleted successfully' });
      } catch (err) {
        console.warn('MongoDB query failed in deleteMedicine, using memory fallback:', err.message);
      }
    }

    dbStore.deleteMedicine(req.params.id);
    res.json({ message: 'Medicine deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Mark medicine as taken (authenticated API)
const markTaken = async (req, res) => {
  try {
    const { date, time } = req.body;

    if (isDbReady()) {
      try {
        const medicine = await Medicine.findById(req.params.id);
        if (medicine) {
          const alreadyTaken = medicine.takenLogs.some(log => log.date === date && log.time === time);
          if (!alreadyTaken) {
            medicine.takenLogs.push({ date, time });
            await medicine.save();

            // Record dose taken alert accurately in MongoDB
            const takenNotif = {
              userId: medicine.parentId,
              message: `Dose confirmed taken: ${medicine.name} (${medicine.dosage || 'prescribed'}) scheduled for ${time}.`,
              type: 'Info',
              category: 'dose_taken',
              priority: 'low',
              medicineId: medicine._id,
              medicineName: medicine.name,
              dosage: medicine.dosage,
              scheduledTime: time,
              actionUrl: '/dashboard'
            };
            await Notification.create(takenNotif).catch(() => {});

            // Auto-mark any missed dose alerts for this dose as resolved/read
            await Notification.updateMany({
              userId: medicine.parentId,
              category: 'missed_dose',
              medicineName: medicine.name,
              scheduledTime: time
            }, { readStatus: true }).catch(() => {});
          }
          return res.json(medicine);
        }
      } catch (err) {
        console.warn('MongoDB query failed in markTaken, using memory fallback:', err.message);
      }
    }

    const updated = dbStore.logTaken(req.params.id, date, time);
    if (!updated) return res.status(404).json({ message: 'Medicine not found' });
    dbStore.createNotification({
      userId: updated.parentId,
      message: `Dose confirmed taken: ${updated.name} scheduled for ${time}.`,
      type: 'Info',
      category: 'dose_taken',
      priority: 'low',
      medicineName: updated.name,
      scheduledTime: time
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Mark medicine as taken from email (GET, no auth) - auto-close success page
const markTakenFromEmail = async (req, res) => {
  try {
    const { date, time } = req.query;
    let medicineName = 'Your medicine';

    if (isDbReady()) {
      try {
        const medicine = await Medicine.findById(req.params.id);
        if (medicine) {
          medicineName = medicine.name;
          const alreadyTaken = medicine.takenLogs.some(log => log.date === date && log.time === time);
          if (!alreadyTaken) {
            medicine.takenLogs.push({ date, time });
            await medicine.save();

            // Record dose taken alert accurately in MongoDB
            const takenNotif = {
              userId: medicine.parentId,
              message: `Dose confirmed taken via Email: ${medicine.name} (${medicine.dosage || 'prescribed'}) scheduled for ${time}.`,
              type: 'Info',
              category: 'dose_taken',
              priority: 'low',
              medicineId: medicine._id,
              medicineName: medicine.name,
              dosage: medicine.dosage,
              scheduledTime: time,
              actionUrl: '/dashboard'
            };
            await Notification.create(takenNotif).catch(() => {});

            // Auto-mark any missed dose alerts for this dose as resolved/read
            await Notification.updateMany({
              userId: medicine.parentId,
              category: 'missed_dose',
              medicineName: medicine.name,
              scheduledTime: time
            }, { readStatus: true }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('MongoDB markTakenFromEmail fallback:', err.message);
      }
    } else {
      const med = dbStore.logTaken(req.params.id, date, time);
      if (med) medicineName = med.name;
    }
    
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Medicine Taken - MediCare</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #bbf7d0 100%);
    }
    .card {
      background: white;
      border-radius: 24px;
      padding: 48px 40px;
      max-width: 440px;
      width: 90%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(16,185,129,0.15);
      animation: popIn 0.4s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes popIn {
      from { opacity:0; transform:scale(0.8); }
      to { opacity:1; transform:scale(1); }
    }
    .icon {
      width: 90px; height: 90px;
      background: linear-gradient(135deg, #10B981, #059669);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 24px;
      font-size: 44px;
      box-shadow: 0 8px 24px rgba(16,185,129,0.35);
      animation: bounce 0.6s ease 0.3s both;
    }
    @keyframes bounce {
      from { transform:scale(0); }
      60% { transform:scale(1.2); }
      to { transform:scale(1); }
    }
    h1 { color:#059669; font-size:28px; font-weight:800; margin-bottom:8px; }
    .te { color:#047857; font-size:20px; font-weight:700; margin-bottom:16px; }
    .medicine-name {
      background:#f0fdf4;
      border:2px solid #10B981;
      border-radius:12px;
      padding:14px 20px;
      margin:16px 0;
      font-size:20px;
      font-weight:800;
      color:#065f46;
    }
    p { color:#6b7280; font-size:14px; margin-top:8px; }
    .footer { color:#d1d5db; font-size:13px; margin-top:28px; }
    .countdown { color:#10B981; font-weight:bold; }
    .progress-bar {
      width:100%; height:4px;
      background:#e5e7eb;
      border-radius:99px;
      margin-top:24px;
      overflow:hidden;
    }
    .progress-fill {
      height:100%;
      background:linear-gradient(90deg,#10B981,#059669);
      border-radius:99px;
      animation:shrink 2s linear forwards;
    }
    @keyframes shrink {
      from { width:100%; }
      to { width:0%; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10003;</div>
    <h1>Medicine Taken!</h1>
    <div class="te">మందు వేసుకున్నారు! &#128138;</div>
    <div class="medicine-name">${medicineName}</div>
    <p>&#10003; Successfully recorded. Stay healthy!</p>
    <p>&#10003; విజయవంతంగా నమోదు చేయబడింది. ఆరోగ్యంగా ఉండండి!</p>
    <div class="progress-bar"><div class="progress-fill"></div></div>
    <p class="footer">This window closes in <span class="countdown" id="cd">2</span>s...</p>
  </div>
  <script>
    let t = 2;
    const cd = document.getElementById('cd');
    const iv = setInterval(function() {
      t--;
      cd.textContent = t;
      if (t <= 0) { clearInterval(iv); window.close(); }
    }, 1000);
  </script>
</body>
</html>`);
  } catch (error) {
    res.send('<h2 style="font-family:Arial;text-align:center;padding:40px;">Error marking medicine as taken.</h2>');
  }
};

// Check missed medicines manually or via API
const checkMissed = async (req, res) => {
  try {
    const { checkMissedMedicines } = require('../services/cronService');
    const missedHandled = await checkMissedMedicines();
    res.json({
      message: `Checked missed medicines. ${missedHandled.length} alert(s) dispatched.`,
      missedDoses: missedHandled
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Immediate missed dose alert when voice reminder finishes without user taking dose
const sendMissedAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, time } = req.body;
    const today = date || new Date().toISOString().split('T')[0];

    let medicine = null;
    if (isDbReady()) {
      try { medicine = await Medicine.findById(id); } catch (e) {}
    }
    if (!medicine) medicine = dbStore.findMedicineById(id);
    if (!medicine) return res.status(404).json({ message: 'Medicine not found' });

    const takenLogs = Array.isArray(medicine.takenLogs) ? medicine.takenLogs : [];
    const isTaken = takenLogs.some(l => l.date === today && l.time === time);
    if (isTaken) {
      return res.json({ message: 'Medicine was already taken.' });
    }

    const missedLogs = Array.isArray(medicine.missedLogs) ? medicine.missedLogs : [];
    const alreadyAlerted = missedLogs.some(l => l.date === today && l.time === time);
    if (alreadyAlerted) {
      return res.json({ message: 'Missed dose alert already sent.' });
    }

    // Save to missedLogs
    if (isDbReady() && medicine.save) {
      try {
        if (!medicine.missedLogs) medicine.missedLogs = [];
        medicine.missedLogs.push({ date: today, time });
        await medicine.save();
      } catch (e) {
        dbStore.logMissed(medicine._id, today, time);
      }
    } else {
      dbStore.logMissed(medicine._id, today, time);
    }

    // Send missed medicine email immediately to patient & caregiver
    const { sendMissedMedicineEmail } = require('../services/emailService');
    await sendMissedMedicineEmail(medicine.parentId, medicine, today, time);

    console.log(`[Missed Alert] Sent immediate missed email for ${medicine.name} at ${time}`);
    res.json({ message: 'Missed dose email sent successfully.' });
  } catch (error) {
    console.error('Error in sendMissedAlert:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getMedicines,
  addMedicine,
  updateMedicine,
  deleteMedicine,
  markTaken,
  markTakenFromEmail,
  checkMissed,
  sendMissedAlert
};
