const cron = require('node-cron');
const mongoose = require('mongoose');
const Medicine = require('../models/Medicine');
const User = require('../models/User');
const { sendMedicineReminderEmail, sendMissedMedicineEmail } = require('./emailService');
const dbStore = require('./dbStore');
const webPush = require('web-push');

// Configure web-push
webPush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:test@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Function to check and send missed medicine alerts
const checkMissedMedicines = async (customNow = null) => {
  const now = customNow || new Date();
  const dateString = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

  let activeMedicines = [];
  if (mongoose.connection.readyState === 1) {
    try {
      activeMedicines = await Medicine.find({ status: 'Active' });
    } catch (e) {
      activeMedicines = Array.from(dbStore.medicines.values()).filter(m => m.status === 'Active');
    }
  } else {
    activeMedicines = Array.from(dbStore.medicines.values()).filter(m => m.status === 'Active');
  }

  const missedDosesHandled = [];

  for (const medicine of activeMedicines) {
    if (!Array.isArray(medicine.reminderTimes)) continue;

    for (const reminderTime of medicine.reminderTimes) {
      const parts = reminderTime.split(':');
      if (parts.length !== 2) continue;
      const scheduledMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);

      // Missed condition: at least 2 minutes have passed since the scheduled time today (voice reminder has finished)
      const diffMinutes = currentTotalMinutes - scheduledMinutes;
      if (diffMinutes >= 2 && diffMinutes <= 720) { // between 2 mins and 12 hours late
        const takenLogs = Array.isArray(medicine.takenLogs) ? medicine.takenLogs : [];
        const missedLogs = Array.isArray(medicine.missedLogs) ? medicine.missedLogs : [];

        const isTaken = takenLogs.some(l => l.date === dateString && l.time === reminderTime);
        const alreadyAlerted = missedLogs.some(l => l.date === dateString && l.time === reminderTime);

        if (!isTaken && !alreadyAlerted) {
          console.log(`[Missed Alert] Medicine "${medicine.name}" (${reminderTime}) was missed on ${dateString}. Sending email...`);

          // Record in missedLogs to avoid duplicate email notifications
          if (mongoose.connection.readyState === 1 && medicine.save) {
            try {
              if (!medicine.missedLogs) medicine.missedLogs = [];
              medicine.missedLogs.push({ date: dateString, time: reminderTime });
              await medicine.save();
            } catch (err) {
              console.warn('Could not save missedLog to MongoDB:', err.message);
            }
          } else {
            dbStore.logMissed(medicine._id, dateString, reminderTime);
          }

          // Send missed medicine email to patient and caregivers
          await sendMissedMedicineEmail(medicine.parentId, medicine, dateString, reminderTime);

          // Send web push alert
          try {
            let patientUser = null;
            if (mongoose.connection.readyState === 1) {
              patientUser = await User.findById(medicine.parentId);
            }
            if (!patientUser) patientUser = dbStore.findUserById(medicine.parentId);

            if (patientUser?.pushSubscription) {
              const payload = JSON.stringify({
                title: '⚠️ Missed Medicine Alert',
                body: `You missed your dose of ${medicine.name} scheduled for ${reminderTime}.`,
                url: '/dashboard'
              });
              await webPush.sendNotification(patientUser.pushSubscription, payload).catch(() => {});
            }
          } catch (e) {}

          missedDosesHandled.push({
            medicineId: medicine._id,
            medicineName: medicine.name,
            scheduledTime: reminderTime,
            date: dateString
          });
        }
      }
    }
  }

  return missedDosesHandled;
};

const initCronJobs = () => {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;
      const dateString = now.toISOString().split('T')[0];

      let activeMedicines = [];
      if (mongoose.connection.readyState === 1) {
        try {
          activeMedicines = await Medicine.find({ status: 'Active' });
        } catch (e) {
          activeMedicines = Array.from(dbStore.medicines.values()).filter(m => m.status === 'Active');
        }
      } else {
        activeMedicines = Array.from(dbStore.medicines.values()).filter(m => m.status === 'Active');
      }

      // 1. Regular exact-time reminders
      for (const medicine of activeMedicines) {
        if (medicine.reminderTimes && medicine.reminderTimes.includes(currentTime)) {
          const takenLogs = Array.isArray(medicine.takenLogs) ? medicine.takenLogs : [];
          const alreadyTaken = takenLogs.some(log => log.date === dateString && log.time === currentTime);

          if (!alreadyTaken) {
            await sendMedicineReminderEmail(medicine.parentId, medicine, dateString, currentTime);

            // Send push notification
            let user = null;
            if (mongoose.connection.readyState === 1) {
              try { user = await User.findById(medicine.parentId); } catch (e) {}
            }
            if (!user) user = dbStore.findUserById(medicine.parentId);

            if (user?.pushSubscription) {
              const payload = JSON.stringify({
                title: 'Medicine Reminder',
                body: `It's time to take your ${medicine.name} (${medicine.dosage}).`,
                url: '/dashboard'
              });
              try {
                await webPush.sendNotification(user.pushSubscription, payload);
              } catch (pushErr) {
                console.error('Error sending push notification:', pushErr);
              }
            }
          }
        }
      }

      // 2. Check for missed medicines (doses >= 15 mins overdue without being taken)
      await checkMissedMedicines(now);

    } catch (error) {
      console.error('Error in cron job:', error);
    }
  });

  console.log('Cron jobs initialized: scheduled reminders & missed-dose checking active.');
};

module.exports = {
  initCronJobs,
  checkMissedMedicines
};
