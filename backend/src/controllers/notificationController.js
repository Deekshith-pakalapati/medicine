const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');
const dbStore = require('../services/dbStore');

const isDbReady = () => mongoose.connection.readyState === 1;

// Get all notifications for user (and linked patient for caregivers)
const getNotifications = async (req, res) => {
  try {
    const clerkId = req.auth.userId;
    const { category, unreadOnly, limit = 100 } = req.query;

    if (isDbReady()) {
      try {
        const user = await User.findOne({ clerkId });
        if (user) {
          // If caregiver with linked patient, show both caregiver's and linked patient's notifications
          let userIds = [user._id];
          if (user.role === 'Mentee' && user.linkedParentId) {
            userIds.push(user.linkedParentId);
          }

          let query = { userId: { $in: userIds } };
          if (category && category !== 'all') {
            if (category === 'missed_dose') {
              query.$or = [{ category: 'missed_dose' }, { type: 'Warning' }, { message: { $regex: /missed/i } }];
            } else if (category === 'reminder') {
              query.$or = [{ category: 'reminder' }, { type: 'Alert' }, { message: { $regex: /reminder/i } }];
            } else if (category === 'dose_taken') {
              query.$or = [{ category: 'dose_taken' }, { type: 'Info' }, { message: { $regex: /taken/i } }];
            } else {
              query.category = category;
            }
          }

          if (unreadOnly === 'true') {
            query.readStatus = false;
          }

          const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(Number(limit));

          return res.json(notifications);
        }
      } catch (err) {
        console.warn('MongoDB query failed in getNotifications, using fallback:', err.message);
      }
    }

    const user = dbStore.findUserByClerkId(clerkId) || dbStore.upsertUser(clerkId, {});
    let notifs = dbStore.getNotifications(user._id);

    // If mentee has linked parent, also include parent's notifications
    if (user.role === 'Mentee' && user.linkedParentId) {
      const parentNotifs = dbStore.getNotifications(user.linkedParentId);
      notifs = [...notifs, ...parentNotifs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    if (category && category !== 'all') {
      if (category === 'missed_dose') {
        notifs = notifs.filter(n => n.category === 'missed_dose' || n.type === 'Warning' || /missed/i.test(n.message));
      } else if (category === 'reminder') {
        notifs = notifs.filter(n => n.category === 'reminder' || n.type === 'Alert' || /reminder/i.test(n.message));
      } else if (category === 'dose_taken') {
        notifs = notifs.filter(n => n.category === 'dose_taken' || /taken/i.test(n.message));
      }
    }

    if (unreadOnly === 'true') {
      notifs = notifs.filter(n => !n.readStatus);
    }

    res.json(notifs.slice(0, Number(limit)));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Toggle or mark notification as read
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    if (isDbReady()) {
      try {
        const existing = await Notification.findById(id);
        if (existing) {
          existing.readStatus = !existing.readStatus;
          await existing.save();
          return res.json(existing);
        }
      } catch (err) {
        console.warn('MongoDB query failed in markAsRead, using fallback:', err.message);
      }
    }

    const n = dbStore.markNotificationAsRead(id);
    res.json(n || { message: 'Updated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Mark all notifications as read for current user
const markAllAsRead = async (req, res) => {
  try {
    const clerkId = req.auth.userId;

    if (isDbReady()) {
      try {
        const user = await User.findOne({ clerkId });
        if (user) {
          let userIds = [user._id];
          if (user.role === 'Mentee' && user.linkedParentId) {
            userIds.push(user.linkedParentId);
          }
          await Notification.updateMany({ userId: { $in: userIds }, readStatus: false }, { readStatus: true });
          return res.json({ message: 'All notifications marked as read' });
        }
      } catch (err) {
        console.warn('MongoDB query failed in markAllAsRead, using fallback:', err.message);
      }
    }

    const user = dbStore.findUserByClerkId(clerkId);
    if (user) {
      dbStore.markAllNotificationsAsRead(user._id);
      if (user.role === 'Mentee' && user.linkedParentId) {
        dbStore.markAllNotificationsAsRead(user.linkedParentId);
      }
    }
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete single notification
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    if (isDbReady()) {
      try {
        await Notification.findByIdAndDelete(id);
        return res.json({ message: 'Notification deleted successfully' });
      } catch (err) {
        console.warn('MongoDB delete failed in deleteNotification:', err.message);
      }
    }

    dbStore.deleteNotification(id);
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Clear all notifications for user
const clearAllNotifications = async (req, res) => {
  try {
    const clerkId = req.auth.userId;
    const { onlyRead } = req.query;

    if (isDbReady()) {
      try {
        const user = await User.findOne({ clerkId });
        if (user) {
          const filter = { userId: user._id };
          if (onlyRead === 'true') filter.readStatus = true;
          await Notification.deleteMany(filter);
          return res.json({ message: 'Notifications cleared successfully' });
        }
      } catch (err) {
        console.warn('MongoDB query failed in clearAllNotifications:', err.message);
      }
    }

    const user = dbStore.findUserByClerkId(clerkId);
    if (user) dbStore.clearNotifications(user._id);
    res.json({ message: 'Notifications cleared successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a test / custom alert
const createAlert = async (req, res) => {
  try {
    const clerkId = req.auth.userId;
    const { message, type = 'Alert', category = 'general', priority = 'medium', medicineName, dosage, scheduledTime } = req.body;

    if (!message) return res.status(400).json({ message: 'Message is required' });

    let userId = null;
    if (isDbReady()) {
      const user = await User.findOne({ clerkId });
      if (user) userId = user._id;
    }
    if (!userId) {
      const u = dbStore.findUserByClerkId(clerkId) || dbStore.upsertUser(clerkId, {});
      userId = u._id;
    }

    if (isDbReady()) {
      try {
        const notif = await Notification.create({
          userId,
          message,
          type,
          category,
          priority,
          medicineName,
          dosage,
          scheduledTime,
          actionUrl: '/dashboard'
        });
        return res.status(201).json(notif);
      } catch (err) {
        console.warn('MongoDB create failed in createAlert:', err.message);
      }
    }

    const memoryNotif = dbStore.createNotification({
      userId,
      message,
      type,
      category,
      priority,
      medicineName,
      dosage,
      scheduledTime
    });
    res.status(201).json(memoryNotif);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const subscribeToPush = async (req, res) => {
  try {
    const clerkId = req.auth.userId;
    const subscription = req.body;
    
    if (isDbReady()) {
      try {
        const user = await User.findOneAndUpdate(
          { clerkId },
          { pushSubscription: subscription },
          { new: true }
        );
        if (user) return res.status(200).json({ message: 'Push subscription saved' });
      } catch (err) {
        console.warn('MongoDB query failed in subscribeToPush, using fallback:', err.message);
      }
    }

    dbStore.upsertUser(clerkId, { pushSubscription: subscription });
    res.status(200).json({ message: 'Push subscription saved' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  createAlert,
  subscribeToPush
};

