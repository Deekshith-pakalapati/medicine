const { BrevoClient } = require('@getbrevo/brevo');
const googleTTS = require('google-tts-api');
const Notification = require('../models/Notification');
const User = require('../models/User');

// Configure Brevo API client
const brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

const getAudioData = async (text, lang) => {
  try {
    const url = googleTTS.getAudioUrl(text, { lang, slow: false, host: 'https://translate.google.com' });
    const base64 = await googleTTS.getAudioBase64(text, { lang, slow: false });
    return { url, base64 };
  } catch (error) {
    console.error(`Error generating TTS for ${lang}:`, error);
    return { url: '', base64: null };
  }
};

const mongoose = require('mongoose');
const dbStore = require('./dbStore');

const sendMedicineAddedEmail = async (userId, medicineDetails) => {
  try {
    let user = null;
    if (mongoose.connection.readyState === 1) {
      try { user = await User.findById(userId); } catch (e) {}
    }
    if (!user) user = dbStore.findUserById(userId);
    if (!user || !user.email) return;

    const times = (medicineDetails.reminderTimes || []).join(', ') || 'Not set';
    const timesRows = (medicineDetails.reminderTimes || []).map((t, i) =>
      `<tr style="background-color:${i % 2 === 0 ? '#f3f4ff' : 'white'};"><td style="padding:10px; font-weight:bold; color:#4F46E5;">Reminder ${i + 1} / రిమైండర్ ${i + 1}</td><td style="padding:10px; font-weight:bold; font-size:18px;">${t}</td></tr>`
    ).join('');

    const enText = `A new medicine ${medicineDetails.name} has been added to your profile. Dosage is ${medicineDetails.dosage}. You need to take it at ${times}.`;
    const teText = `మీ ప్రొఫైల్‌కి కొత్త మందు ${medicineDetails.name} జోడించబడింది. మోతాదు ${medicineDetails.dosage}. మీరు దీన్ని ${times} సమయానికి తీసుకోవాలి.`;
    
    const enAudio = await getAudioData(enText, 'en');
    await new Promise(resolve => setTimeout(resolve, 2500)); // Increased delay to prevent rate limits
    const teAudio = await getAudioData(teText, 'te');

    const today = new Date().toISOString().split('T')[0];
    const firstTime = (medicineDetails.reminderTimes && medicineDetails.reminderTimes[0]) || '12:00';
    const markTakenUrl = `${BACKEND_URL}/api/medicines/${medicineDetails._id}/take-email?date=${today}&time=${firstTime}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">
          <div style="text-align:center; margin-bottom: 24px;">
            <h1 style="color: #4F46E5; margin:0;">&#128138; MediCare</h1>
          </div>
          
          <!-- Voice Record -->
          <div style="background: #f3f4ff; border-radius: 10px; padding: 20px; margin-bottom: 20px; text-align: center; border: 2px solid #4F46E5;">
            <h3 style="margin: 0 0 10px 0; color: #111;">&#127908; Voice Record / వాయిస్ రికార్డ్</h3>
            <p style="color: #555; margin: 0 0 4px 0; font-size: 14px;">MP3 voice files are attached at the bottom of this email.</p>
            <p style="color: #555; margin: 0; font-size: 14px;">ఈ ఇమెయిల్ చివరలో MP3 వాయిస్ ఫైల్స్ జత చేయబడ్డాయి.</p>
          </div>

          <h2 style="color: #111; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">New Medicine Added &#10003;<br><span style="font-size: 18px; color: #6D28D9;">కొత్త మందు జోడించబడింది</span></h2>
          <p style="color: #555;">Hello <strong>${user.name}</strong>, a new medicine has been added to your MediCare profile.</p>
          <p style="color: #555;">నమస్కారం <strong>${user.name}</strong>, మీ ప్రొఫైల్‌కి కొత్త మందు జోడించబడింది.</p>

          <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
            <tr style="background-color: #f3f4ff;"><td style="padding: 10px; font-weight: bold; color:#4F46E5;">Name / పేరు</td><td style="padding: 10px; font-weight:bold; font-size:17px;">${medicineDetails.name}</td></tr>
            <tr><td style="padding: 10px; font-weight: bold; color:#4F46E5;">Dosage / మోతాదు</td><td style="padding: 10px;">${medicineDetails.dosage}</td></tr>
            <tr style="background-color: #f3f4ff;"><td style="padding: 10px; font-weight: bold; color:#4F46E5;">Frequency / ఎన్నిసార్లు</td><td style="padding: 10px;">${medicineDetails.frequency}</td></tr>
            <tr><td style="padding: 10px; font-weight: bold; color:#4F46E5;">Start Date / ప్రారంభ తేదీ</td><td style="padding: 10px;">${new Date(medicineDetails.startDate).toDateString()}</td></tr>
          </table>

          <div style="background:#f3f4ff; border-radius:10px; padding:16px; margin:16px 0; border-left:4px solid #4F46E5;">
            <h3 style="color:#4F46E5; margin:0 0 12px 0; font-size:15px;">&#8987; Reminder Times / మందు వేసుకునే సమయాలు</h3>
            <table style="width:100%; border-collapse:collapse;">
              ${timesRows || '<tr><td style="padding:10px; color:#888;">No times set / సమయం పెట్టలేదు</td></tr>'}
            </table>
          </div>

          <div style="text-align:center; margin-top: 28px; margin-bottom: 20px;">
            <a href="${markTakenUrl}" style="display:inline-block; background-color:#4F46E5; color:white; padding:16px 36px; border-radius:10px; font-size:16px; font-weight:bold; text-decoration:none; box-shadow:0 4px 12px rgba(79,70,229,0.3);">
              &#10003;&nbsp; Mark as Taken / వేసుకున్నాను
            </a>
          </div>

          <p style="color: #aaa; font-size: 12px; text-align: center; margin-top: 24px;">MediCare Reminder - Stay healthy! / ఆరోగ్యంగా ఉండండి!</p>
        </div>
      </body>
      </html>
    `;

    const attachments = [];
    if (enAudio.base64) attachments.push({ content: enAudio.base64, name: 'Confirmation_English.mp3' });
    if (teAudio.base64) attachments.push({ content: teAudio.base64, name: 'Confirmation_Telugu.mp3' });

    const emailData = {
      subject: 'కొత్త మందు జోడించబడింది (New Medicine Added) - MediCare',
      htmlContent: emailHtml,
      sender: { name: 'MediCare Reminder', email: 'deekshitpakalapati@gmail.com' },
      to: [{ email: user.email, name: user.name }]
    };
    if (attachments.length > 0) emailData.attachment = attachments;

    await brevo.transactionalEmails.sendTransacEmail(emailData);

    const addNotifData = {
      userId: user._id,
      message: `Prescription added: ${medicineDetails.name} (${medicineDetails.dosage || 'Standard dose'}). Schedule: ${(medicineDetails.reminderTimes || []).join(', ')}.`,
      type: 'Info',
      category: 'medicine_added',
      priority: 'low',
      medicineId: medicineDetails._id,
      medicineName: medicineDetails.name,
      dosage: medicineDetails.dosage,
      actionUrl: '/dashboard'
    };

    if (mongoose.connection.readyState === 1) {
      try {
        await Notification.create(addNotifData);
      } catch (dbErr) {
        console.warn('Could not save medicine added alert to MongoDB:', dbErr.message);
        dbStore.createNotification(addNotifData);
      }
    } else {
      dbStore.createNotification(addNotifData);
    }

    console.log(`Medicine added email sent to ${user.email}`);
  } catch (error) {
    console.error('Error sending medicine added email:', error.message || error);
  }
};

const sendMedicineReminderEmail = async (userId, medicineDetails, dateString, currentTime) => {
  try {
    let user = null;
    if (mongoose.connection.readyState === 1) {
      try { user = await User.findById(userId); } catch (e) {}
    }
    if (!user) user = dbStore.findUserById(userId);
    if (!user || !user.email) return;

    const enText = `Hello ${user.name}. It is time to take your medicine. Please take ${medicineDetails.name} now. Dosage is ${medicineDetails.dosage}.`;
    const teText = `నమస్కారం ${user.name}. మీ మందు వేసుకునే సమయం వచ్చింది. దయచేసి ఇప్పుడు మీ ${medicineDetails.name} తీసుకోండి. మోతాదు ${medicineDetails.dosage}.`;
    
    const enAudio = await getAudioData(enText, 'en');
    await new Promise(resolve => setTimeout(resolve, 2500)); // Increased delay to prevent rate limits
    const teAudio = await getAudioData(teText, 'te');

    const markTakenUrl = `${BACKEND_URL}/api/medicines/${medicineDetails._id}/take-email?date=${dateString}&time=${currentTime}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">
          <div style="text-align:center; margin-bottom: 24px;">
            <h1 style="color: #10B981; margin:0;">&#128138; MediCare</h1>
          </div>
          
          <!-- Voice Record -->
          <div style="background: #f0fdf4; border-radius: 10px; padding: 20px; margin-bottom: 20px; text-align: center; border: 2px solid #10B981;">
            <h3 style="margin: 0 0 10px 0; color: #111;">&#127908; Voice Record / వాయిస్ రికార్డ్</h3>
            <p style="color: #555; margin: 0 0 4px 0; font-size: 14px;">MP3 voice files are attached at the bottom of this email.</p>
            <p style="color: #555; margin: 0; font-size: 14px;">ఈ ఇమెయిల్ చివరలో MP3 వాయిస్ ఫైల్స్ జత చేయబడ్డాయి.</p>
          </div>

          <h2 style="color: #111; border-bottom: 2px solid #10B981; padding-bottom: 10px;">Time for Your Medication! <br><span style="font-size: 18px; color: #059669;">మీ మందు వేసుకునే సమయం!</span></h2>
          <p style="color: #555;">Hello <strong>${user.name}</strong>, it is time to take your medication right now.</p>
          <p style="color: #555;">నమస్కారం <strong>${user.name}</strong>, మీ మందు వేసుకునే సమయం వచ్చింది. దయచేసి తీసుకోండి.</p>

          <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
            <tr style="background-color: #f0fdf4;"><td style="padding: 10px; font-weight: bold; color:#10B981;">Medicine / మందు పేరు</td><td style="padding: 10px; font-size: 18px; font-weight: bold;">${medicineDetails.name}</td></tr>
            <tr><td style="padding: 10px; font-weight: bold; color:#10B981;">Dosage / మోతాదు</td><td style="padding: 10px;">${medicineDetails.dosage}</td></tr>
            <tr style="background-color: #f0fdf4;"><td style="padding: 10px; font-weight: bold; color:#10B981;">Notes / సూచనలు</td><td style="padding: 10px;">${medicineDetails.notes || 'None / ఏమీ లేవు'}</td></tr>
          </table>

          <div style="text-align:center; margin-top: 28px; margin-bottom: 20px;">
            <a href="${markTakenUrl}" style="display:inline-block; background-color:#10B981; color:white; padding:16px 36px; border-radius:10px; font-size:16px; font-weight:bold; text-decoration:none; box-shadow:0 4px 12px rgba(16,185,129,0.3);">
              &#10003;&nbsp; Mark as Taken / వేసుకున్నాను
            </a>
          </div>

          <p style="color: #aaa; font-size: 12px; text-align: center; margin-top: 24px;">MediCare Reminder - Stay healthy! / ఆరోగ్యంగా ఉండండి!</p>
        </div>
      </body>
      </html>
    `;

    const attachments = [];
    if (enAudio.base64) attachments.push({ content: enAudio.base64, name: 'Reminder_English.mp3' });
    if (teAudio.base64) attachments.push({ content: teAudio.base64, name: 'Reminder_Telugu.mp3' });

    const emailData = {
      subject: 'మీ మందు వేసుకునే సమయం! (Medicine Reminder) - MediCare',
      htmlContent: emailHtml,
      sender: { name: 'MediCare Reminder', email: 'deekshitpakalapati@gmail.com' },
      to: [{ email: user.email, name: user.name }]
    };
    if (attachments.length > 0) emailData.attachment = attachments;

    await brevo.transactionalEmails.sendTransacEmail(emailData);

    const reminderNotifData = {
      userId: user._id,
      message: `Reminder: It is time to take ${medicineDetails.name} (${medicineDetails.dosage || 'prescribed dose'}) scheduled for ${currentTime}.`,
      type: 'Alert',
      category: 'reminder',
      priority: 'high',
      medicineId: medicineDetails._id,
      medicineName: medicineDetails.name,
      dosage: medicineDetails.dosage,
      scheduledTime: currentTime,
      actionUrl: '/dashboard'
    };

    if (mongoose.connection.readyState === 1) {
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const existing = await Notification.findOne({
          userId: user._id,
          medicineName: medicineDetails.name,
          scheduledTime: currentTime,
          category: 'reminder',
          createdAt: { $gte: startOfDay }
        });
        if (!existing) {
          await Notification.create(reminderNotifData);
        }
      } catch (dbErr) {
        console.warn('Could not save reminder alert to MongoDB:', dbErr.message);
        dbStore.createNotification(reminderNotifData);
      }
    } else {
      dbStore.createNotification(reminderNotifData);
    }

    console.log(`Medicine reminder email sent to ${user.email}`);
  } catch (error) {
    console.error('Error sending medicine reminder email:', error.message || error);
  }
};

const sendMissedMedicineEmail = async (userId, medicineDetails, dateString, missedTime) => {
  try {
    let patient = null;
    if (mongoose.connection.readyState === 1) {
      try { patient = await User.findById(userId); } catch (e) {}
    }
    if (!patient) patient = dbStore.findUserById(userId);
    if (!patient) return;

    // Find linked caregivers to alert as well
    let caregivers = [];
    if (mongoose.connection.readyState === 1) {
      try {
        caregivers = await User.find({
          linkedParentId: patient._id,
          _id: { $ne: patient._id }
        });
      } catch (e) {}
    }
    if (caregivers.length === 0) {
      for (const u of dbStore.users.values()) {
        if (String(u.linkedParentId) === String(patient._id) && String(u._id) !== String(patient._id)) {
          caregivers.push(u);
        }
      }
    }

    const enText = `Urgent missed medication alert for ${patient.name}. The dose of ${medicineDetails.name} scheduled for ${missedTime} was not marked as taken.`;
    const teText = `ముఖ్యమైన హెచ్చరిక: ${patient.name} గారు ${missedTime} సమయానికి తీసుకోవలసిన ${medicineDetails.name} మందు వేసుకోలేదు.`;

    const enAudio = await getAudioData(enText, 'en');
    await new Promise(resolve => setTimeout(resolve, 2000));
    const teAudio = await getAudioData(teText, 'te');

    const markTakenUrl = `${BACKEND_URL}/api/medicines/${medicineDetails._id}/take-email?date=${dateString}&time=${missedTime}`;

    // Recipients list: patient + any linked caregivers
    const recipients = [];
    if (patient.email) {
      recipients.push({ email: patient.email, name: patient.name, isPatient: true });
    }
    caregivers.forEach(cg => {
      if (cg.email && cg.email !== patient.email) {
        recipients.push({ email: cg.email, name: cg.name, isPatient: false });
      }
    });

    for (const recipient of recipients) {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fff1f2;">
          <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px rgba(225,29,72,0.15); border: 2px solid #f43f5e;">
            <div style="text-align:center; margin-bottom: 20px;">
              <div style="display:inline-block; background-color:#ffe4e6; color:#e11d48; padding:8px 18px; border-radius:99px; font-weight:800; font-size:13px; text-transform:uppercase; letter-spacing:1px;">
                &#9888; Missed Dose Alert / మందు మిస్ అయ్యింది
              </div>
            </div>

            <h1 style="color: #e11d48; text-align:center; margin: 0 0 8px 0; font-size: 26px;">
              ${medicineDetails.name} Was Not Taken
            </h1>
            <p style="color: #9f1239; text-align:center; margin: 0 0 20px 0; font-size: 16px; font-weight: bold;">
              నిర్దేశిత సమయానికి మందు వేసుకోలేదు
            </p>

            <div style="background: #fff1f2; border-radius: 12px; padding: 18px; margin-bottom: 24px; border-left: 4px solid #e11d48;">
              <p style="margin: 0 0 8px 0; color: #333; font-size: 15px;">
                Hello <strong>${recipient.name}</strong>,
                ${recipient.isPatient ? `you missed your scheduled medication dose:` : `your linked patient <strong>${patient.name}</strong> missed their scheduled dose:`}
              </p>
              <p style="margin: 0; color: #666; font-size: 13px;">
                Scheduled Time: <strong style="color:#e11d48;">${missedTime}</strong> on <strong>${dateString}</strong>
              </p>
            </div>

            <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
              <tr style="background-color: #fff1f2;"><td style="padding: 12px; font-weight: bold; color:#e11d48;">Patient / పేషెంట్</td><td style="padding: 12px; font-weight: bold;">${patient.name}</td></tr>
              <tr><td style="padding: 12px; font-weight: bold; color:#e11d48;">Medicine / మందు పేరు</td><td style="padding: 12px; font-size: 18px; font-weight: bold; color:#111;">${medicineDetails.name}</td></tr>
              <tr style="background-color: #fff1f2;"><td style="padding: 12px; font-weight: bold; color:#e11d48;">Dosage / మోతాదు</td><td style="padding: 12px; font-weight: bold;">${medicineDetails.dosage}</td></tr>
              <tr><td style="padding: 12px; font-weight: bold; color:#e11d48;">Instructions / సూచనలు</td><td style="padding: 12px;">${medicineDetails.notes || 'Take as prescribed'}</td></tr>
            </table>

            <!-- Audio reminder -->
            <div style="background: #fdf2f8; border-radius: 10px; padding: 16px; margin: 20px 0; text-align: center; border: 1px solid #fbcfe8;">
              <h4 style="margin: 0 0 6px 0; color: #9d174d;">&#127908; Voice Alert Attached / ఆడియో హెచ్చరిక</h4>
              <p style="margin: 0; font-size: 13px; color: #701a75;">MP3 audio files in English and Telugu are attached below.</p>
            </div>

            <div style="text-align:center; margin-top: 28px; margin-bottom: 24px;">
              <a href="${markTakenUrl}" style="display:inline-block; background-color:#e11d48; color:white; padding:16px 36px; border-radius:12px; font-size:16px; font-weight:bold; text-decoration:none; box-shadow:0 6px 18px rgba(225,29,72,0.35);">
                &#10003;&nbsp; Take Now & Mark as Taken / ఇప్పుడు వేసుకున్నాను
              </a>
            </div>

            <div style="background-color: #fafafa; border-radius: 8px; padding: 14px; margin-top: 24px; font-size: 12px; color: #666; text-align: center;">
              <strong>Safety Reminder:</strong> If it is almost time for the next scheduled dose, skip the missed one. Never take a double dose to make up for a missed pill.
            </div>
          </div>
        </body>
        </html>
      `;

      const attachments = [];
      if (enAudio.base64) attachments.push({ content: enAudio.base64, name: 'Missed_Alert_English.mp3' });
      if (teAudio.base64) attachments.push({ content: teAudio.base64, name: 'Missed_Alert_Telugu.mp3' });

      const emailData = {
        subject: `⚠️ MISSED DOSE ALERT: ${medicineDetails.name} was missed at ${missedTime} - MediCare`,
        htmlContent: emailHtml,
        sender: { name: 'MediCare Alert', email: 'deekshitpakalapati@gmail.com' },
        to: [{ email: recipient.email, name: recipient.name }]
      };
      if (attachments.length > 0) emailData.attachment = attachments;

      try {
        await brevo.transactionalEmails.sendTransacEmail(emailData);
        console.log(`Missed dose alert email sent to ${recipient.email} (${recipient.name})`);
      } catch (err) {
        console.error(`Error sending missed email to ${recipient.email}:`, err.message || err);
      }
    }

    // Save Notifications for patient and caregivers
    const notificationMessage = `MISSED DOSE: ${medicineDetails.name} (${medicineDetails.dosage || 'prescribed dose'}) scheduled for ${missedTime} was not taken.`;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const patientNotifData = {
      userId: patient._id,
      message: notificationMessage,
      type: 'Warning',
      category: 'missed_dose',
      priority: 'high',
      medicineId: medicineDetails._id,
      medicineName: medicineDetails.name,
      dosage: medicineDetails.dosage,
      scheduledTime: missedTime,
      actionUrl: '/dashboard'
    };

    if (mongoose.connection.readyState === 1) {
      try {
        const existingPatientNotif = await Notification.findOne({
          userId: patient._id,
          category: 'missed_dose',
          medicineName: medicineDetails.name,
          scheduledTime: missedTime,
          createdAt: { $gte: startOfDay }
        });

        if (!existingPatientNotif) {
          await Notification.create(patientNotifData);
        }

        // Deduplicate caregivers to prevent multiple entries
        const uniqueCaregivers = [];
        const seenCgIds = new Set();
        for (const cg of caregivers) {
          const idStr = String(cg._id);
          if (!seenCgIds.has(idStr)) {
            seenCgIds.add(idStr);
            uniqueCaregivers.push(cg);
          }
        }

        for (const cg of uniqueCaregivers) {
          const existingCgNotif = await Notification.findOne({
            userId: cg._id,
            category: 'caregiver_alert',
            medicineName: medicineDetails.name,
            scheduledTime: missedTime,
            createdAt: { $gte: startOfDay }
          });

          if (!existingCgNotif) {
            await Notification.create({
              userId: cg._id,
              message: `Caregiver Alert: ${patient.name || 'Patient'} missed ${medicineDetails.name} (${medicineDetails.dosage || 'dose'}) scheduled for ${missedTime}.`,
              type: 'Warning',
              category: 'caregiver_alert',
              priority: 'high',
              medicineId: medicineDetails._id,
              medicineName: medicineDetails.name,
              dosage: medicineDetails.dosage,
              scheduledTime: missedTime,
              actionUrl: '/mentee-dashboard'
            });
          }
        }
      } catch (e) {
        console.warn('MongoDB alert storage error in sendMissedMedicineEmail:', e.message);
        dbStore.createNotification(patientNotifData);
      }
    } else {
      dbStore.createNotification(patientNotifData);
      for (const cg of caregivers) {
        dbStore.createNotification({
          userId: cg._id,
          message: `Caregiver Alert: ${patient.name || 'Patient'} missed ${medicineDetails.name} scheduled for ${missedTime}.`,
          type: 'Warning',
          category: 'caregiver_alert',
          priority: 'high',
          medicineName: medicineDetails.name,
          dosage: medicineDetails.dosage,
          scheduledTime: missedTime
        });
      }
    }
  } catch (error) {
    console.error('Error in sendMissedMedicineEmail:', error.message || error);
  }
};

module.exports = {
  sendMedicineAddedEmail,
  sendMedicineReminderEmail,
  sendMissedMedicineEmail
};
