// In-memory resilient data store for when MongoDB is offline or authentication fails
const crypto = require('crypto');

const generateId = () => crypto.randomBytes(12).toString('hex');
const generateInviteCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

class DbStore {
  constructor() {
    this.users = new Map(); // key: clerkId or _id
    this.medicines = new Map(); // key: _id
    this.chatMessages = [];
    this.notifications = [];
  }

  isMongoConnected() {
    try {
      const mongoose = require('mongoose');
      return mongoose.connection.readyState === 1;
    } catch {
      return false;
    }
  }

  // User operations
  findUserByClerkId(clerkId) {
    for (const u of this.users.values()) {
      if (u.clerkId === clerkId) return { ...u };
    }
    return null;
  }

  findUserById(id) {
    return this.users.get(String(id)) || null;
  }

  findUserByInviteCode(inviteCode) {
    if (!inviteCode) return null;
    const code = inviteCode.toUpperCase().trim();
    for (const u of this.users.values()) {
      if (u.inviteCode && u.inviteCode.toUpperCase() === code && u.role === 'Parent') {
        return { ...u };
      }
    }
    return null;
  }

  upsertUser(clerkId, data = {}) {
    let existing = this.findUserByClerkId(clerkId);
    if (!existing) {
      const _id = generateId();
      existing = {
        _id,
        clerkId,
        name: data.name || 'User',
        email: data.email || 'user@example.com',
        role: data.role || null,
        profileImage: data.profileImage || '',
        inviteCode: data.role === 'Parent' ? generateInviteCode() : (data.inviteCode || null),
        linkedParentId: data.linkedParentId || null,
        pushSubscription: data.pushSubscription || null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } else {
      if (data.name) existing.name = data.name;
      if (data.email) existing.email = data.email;
      if (data.profileImage) existing.profileImage = data.profileImage;
      if (data.role) {
        existing.role = data.role;
        if (data.role === 'Parent' && !existing.inviteCode) {
          existing.inviteCode = generateInviteCode();
        }
      }
      if (data.linkedParentId !== undefined) existing.linkedParentId = data.linkedParentId;
      if (data.pushSubscription !== undefined) existing.pushSubscription = data.pushSubscription;
      if (data.inviteCode) existing.inviteCode = data.inviteCode;
      existing.updatedAt = new Date();
    }
    this.users.set(String(existing._id), existing);
    this.users.set(existing.clerkId, existing);
    return { ...existing };
  }

  // Medicine operations
  findMedicinesByParentId(parentId) {
    const pId = String(parentId);
    const list = [];
    for (const m of this.medicines.values()) {
      if (String(m.parentId) === pId && m.status !== 'Inactive') {
        list.push({ ...m });
      }
    }
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  findMedicineById(id) {
    return this.medicines.get(String(id)) || null;
  }

  createMedicine(data) {
    const _id = generateId();
    const med = {
      _id,
      name: data.name,
      dosage: data.dosage,
      frequency: data.frequency,
      notes: data.notes || '',
      startDate: data.startDate || new Date(),
      endDate: data.endDate || null,
      reminderTimes: Array.isArray(data.reminderTimes) ? data.reminderTimes : [],
      createdBy: String(data.createdBy),
      parentId: String(data.parentId),
      takenLogs: Array.isArray(data.takenLogs) ? data.takenLogs : [],
      missedLogs: Array.isArray(data.missedLogs) ? data.missedLogs : [],
      status: data.status || 'Active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.medicines.set(_id, med);
    return { ...med };
  }

  updateMedicine(id, data) {
    const med = this.medicines.get(String(id));
    if (!med) return null;
    Object.assign(med, data, { updatedAt: new Date() });
    this.medicines.set(String(id), med);
    return { ...med };
  }

  deleteMedicine(id) {
    return this.medicines.delete(String(id));
  }

  logTaken(id, date, time) {
    const med = this.medicines.get(String(id));
    if (!med) return null;
    if (!Array.isArray(med.takenLogs)) med.takenLogs = [];
    const exists = med.takenLogs.some(l => l.date === date && l.time === time);
    if (!exists) {
      med.takenLogs.push({ date, time });
      med.updatedAt = new Date();
    }
    return { ...med };
  }

  logMissed(id, date, time) {
    const med = this.medicines.get(String(id));
    if (!med) return null;
    if (!Array.isArray(med.missedLogs)) med.missedLogs = [];
    const exists = med.missedLogs.some(l => l.date === date && l.time === time);
    if (!exists) {
      med.missedLogs.push({ date, time });
      med.updatedAt = new Date();
    }
    return { ...med };
  }

  // Chat message operations
  saveChatMessage(userId, message, aiResponse) {
    const chatMsg = {
      _id: generateId(),
      userId: String(userId),
      message,
      aiResponse,
      createdAt: new Date()
    };
    this.chatMessages.push(chatMsg);
    return chatMsg;
  }

  getChatHistory(userId, limit = 50) {
    const uId = String(userId);
    return this.chatMessages
      .filter(m => String(m.userId) === uId)
      .slice(-limit);
  }

  clearChatHistory(userId) {
    const uId = String(userId);
    this.chatMessages = this.chatMessages.filter(m => String(m.userId) !== uId);
  }

  // Notification operations
  getNotifications(userId) {
    const uId = String(userId);
    return this.notifications
      .filter(n => String(n.userId) === uId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  createNotification(data) {
    const notif = {
      _id: generateId(),
      userId: String(data.userId),
      message: data.message,
      type: data.type || 'Info',
      category: data.category || 'general',
      priority: data.priority || 'medium',
      medicineName: data.medicineName,
      dosage: data.dosage,
      scheduledTime: data.scheduledTime,
      actionUrl: data.actionUrl || '/dashboard',
      readStatus: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.notifications.push(notif);
    return notif;
  }

  markNotificationAsRead(id) {
    const n = this.notifications.find(item => String(item._id) === String(id));
    if (n) {
      n.readStatus = !n.readStatus;
      n.updatedAt = new Date();
    }
    return n;
  }

  markAllNotificationsAsRead(userId) {
    const uId = String(userId);
    for (const n of this.notifications) {
      if (String(n.userId) === uId) n.readStatus = true;
    }
  }

  deleteNotification(id) {
    const initialLen = this.notifications.length;
    this.notifications = this.notifications.filter(n => String(n._id) !== String(id));
    return this.notifications.length < initialLen;
  }

  clearNotifications(userId) {
    const uId = String(userId);
    this.notifications = this.notifications.filter(n => String(n.userId) !== uId);
  }
}

const dbStore = new DbStore();
module.exports = dbStore;
