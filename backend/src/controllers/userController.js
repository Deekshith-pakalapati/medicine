const mongoose = require('mongoose');
const User = require('../models/User');
const dbStore = require('../services/dbStore');

const isDbReady = () => mongoose.connection.readyState === 1;

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const clerkId = req.auth.userId;
    if (isDbReady()) {
      try {
        let user = await User.findOne({ clerkId }).populate('linkedParentId', 'name email role inviteCode');
        if (!user) {
          user = new User({
            clerkId,
            name: req.auth.sessionClaims?.name || 'User',
            email: req.auth.sessionClaims?.email || 'user@example.com',
            role: 'Parent',
            inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase()
          });
          await user.save();
        } else if (!user.inviteCode) {
          user.inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
          await user.save();
        }
        return res.json(user);
      } catch (err) {
        console.warn('MongoDB query failed in getProfile, using memory fallback:', err.message);
      }
    }

    // In-memory fallback
    let user = dbStore.findUserByClerkId(clerkId);
    if (!user) {
      user = dbStore.upsertUser(clerkId, {
        name: req.auth.sessionClaims?.name || 'User',
        email: req.auth.sessionClaims?.email || 'user@example.com'
      });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create or update user after Clerk sign up / login
const syncUser = async (req, res) => {
  try {
    const { name, email, profileImage } = req.body;
    const clerkId = req.auth.userId;
    
    if (isDbReady()) {
      try {
        let user = await User.findOne({ clerkId });
        if (!user) {
          user = new User({
            clerkId,
            name: name || 'User',
            email: email || 'user@example.com',
            profileImage: profileImage || ''
          });
          await user.save();
        } else {
          user.name = name || user.name;
          user.email = email || user.email;
          user.profileImage = profileImage || user.profileImage;
          await user.save();
        }
        dbStore.upsertUser(clerkId, user.toObject ? user.toObject() : user);
        return res.json(user);
      } catch (err) {
        console.warn('MongoDB query failed in syncUser, using memory fallback:', err.message);
      }
    }

    const fallbackUser = dbStore.upsertUser(clerkId, { name, email, profileImage });
    res.json(fallbackUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Select Role (Parent/Mentee)
const selectRole = async (req, res) => {
  try {
    const { role } = req.body;
    const clerkId = req.auth.userId;
    
    if (isDbReady()) {
      try {
        let user = await User.findOne({ clerkId });
        if (!user) {
          user = new User({
            clerkId,
            role,
            name: req.auth.sessionClaims?.name || 'User',
            email: req.auth.sessionClaims?.email || 'user@example.com'
          });
        } else {
          user.role = role;
        }
        if (!user.inviteCode) {
          user.inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        }
        await user.save();
        dbStore.upsertUser(clerkId, user.toObject ? user.toObject() : user);
        return res.json(user);
      } catch (err) {
        console.warn('MongoDB query failed in selectRole, using memory fallback:', err.message);
      }
    }

    const fallbackUser = dbStore.upsertUser(clerkId, { role });
    res.json(fallbackUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Link Accounts via Invite Code (Bidirectional & Self-Link support)
const linkParent = async (req, res) => {
  try {
    const { inviteCode } = req.body;
    const clerkId = req.auth.userId;
    const cleanCode = inviteCode ? inviteCode.trim().toUpperCase() : '';

    if (!cleanCode) {
      return res.status(400).json({ message: 'Please provide an invite code' });
    }
    
    if (isDbReady()) {
      try {
        let currentUser = await User.findOne({ clerkId });
        if (!currentUser) {
          currentUser = new User({ 
            clerkId, 
            role: 'Parent', 
            name: req.auth.sessionClaims?.name || 'User', 
            email: req.auth.sessionClaims?.email || 'user@example.com',
            inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase()
          });
          await currentUser.save();
        }

        // 1. Self-link: User enters their own code
        if (currentUser.inviteCode && currentUser.inviteCode.toUpperCase() === cleanCode) {
          await User.findByIdAndUpdate(currentUser._id, { $set: { linkedParentId: currentUser._id } });
          currentUser.linkedParentId = currentUser._id;
          dbStore.upsertUser(clerkId, currentUser.toObject ? currentUser.toObject() : currentUser);
          return res.json({ 
            message: 'Successfully linked to your own account for full dual-access!', 
            parent: currentUser,
            partner: currentUser,
            isSelf: true
          });
        }

        // 2. Find target partner user by inviteCode
        const targetUser = await User.findOne({ inviteCode: cleanCode });
        if (!targetUser) {
          return res.status(404).json({ message: 'Invalid invite code. Please check the code with your partner.' });
        }

        // Self-link fallback check by ObjectId
        if (String(currentUser._id) === String(targetUser._id)) {
          await User.findByIdAndUpdate(currentUser._id, { $set: { linkedParentId: currentUser._id } });
          currentUser.linkedParentId = currentUser._id;
          return res.json({ 
            message: 'Successfully linked to your own account for full dual-access!', 
            parent: currentUser,
            partner: currentUser,
            isSelf: true
          });
        }

        // 3. Bidirectional linking logic
        const isCurrentCaregiver = currentUser.role === 'Mentee' || currentUser.role === 'caretaker' || currentUser.role === 'Caregiver';
        const isTargetCaregiver = targetUser.role === 'Mentee' || targetUser.role === 'caretaker' || targetUser.role === 'Caregiver';

        let currentLinkedId = targetUser._id;
        let targetLinkedId = currentUser._id;

        if (isCurrentCaregiver && !isTargetCaregiver) {
          // Current is Caregiver, Target is Patient
          currentLinkedId = targetUser._id;
          targetLinkedId = currentUser._id;
        } else if (!isCurrentCaregiver && isTargetCaregiver) {
          // Current is Patient, Target is Caregiver
          targetLinkedId = currentUser._id; // Caregiver links to Patient
          currentLinkedId = targetUser._id; // Patient links to Caregiver
        }

        await User.findByIdAndUpdate(currentUser._id, { $set: { linkedParentId: currentLinkedId } });
        await User.findByIdAndUpdate(targetUser._id, { $set: { linkedParentId: targetLinkedId } });

        currentUser.linkedParentId = currentLinkedId;
        targetUser.linkedParentId = targetLinkedId;

        dbStore.upsertUser(currentUser.clerkId, currentUser.toObject ? currentUser.toObject() : currentUser);
        dbStore.upsertUser(targetUser.clerkId, targetUser.toObject ? targetUser.toObject() : targetUser);

        return res.json({ 
          message: `Successfully linked with ${targetUser.name || 'partner'}! Both accounts are now connected.`, 
          parent: targetUser,
          partner: targetUser
        });
      } catch (err) {
        console.warn('MongoDB query failed in linkParent, using memory fallback:', err.message);
      }
    }

    // In-memory fallback
    let currentUser = dbStore.findUserByClerkId(clerkId) || dbStore.upsertUser(clerkId, {});
    
    // Check self-link in memory
    if (currentUser.inviteCode && currentUser.inviteCode.toUpperCase() === cleanCode) {
      currentUser.linkedParentId = currentUser._id;
      dbStore.upsertUser(clerkId, { linkedParentId: currentUser._id });
      return res.json({ 
        message: 'Successfully linked to your own account for full dual-access!', 
        parent: currentUser,
        partner: currentUser,
        isSelf: true
      });
    }

    const targetUser = dbStore.findUserByInviteCode(cleanCode);
    if (!targetUser) {
      return res.status(404).json({ message: 'Invalid invite code.' });
    }

    currentUser.linkedParentId = targetUser._id;
    targetUser.linkedParentId = currentUser._id;
    dbStore.upsertUser(clerkId, { linkedParentId: targetUser._id });
    dbStore.upsertUser(targetUser.clerkId, { linkedParentId: currentUser._id });

    res.json({ 
      message: `Successfully linked with ${targetUser.name || 'partner'}! Both accounts are now connected.`, 
      parent: targetUser,
      partner: targetUser
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Unlink current patient
const unlinkParent = async (req, res) => {
  try {
    const clerkId = req.auth.userId;

    if (isDbReady()) {
      try {
        const user = await User.findOneAndUpdate(
          { clerkId },
          { $set: { linkedParentId: null } },
          { new: true }
        );
        return res.json({ message: 'Unlinked successfully', user });
      } catch (err) {
        console.warn('MongoDB unlink failed:', err.message);
      }
    }

    dbStore.upsertUser(clerkId, { linkedParentId: null });
    res.json({ message: 'Unlinked successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Refresh / Regenerate Invite Code
const refreshInviteCode = async (req, res) => {
  try {
    const clerkId = req.auth.userId;
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    if (isDbReady()) {
      try {
        let user = await User.findOne({ clerkId });
        if (user) {
          user.inviteCode = newCode;
          await user.save();
          return res.json(user);
        }
      } catch (err) {
        console.warn('MongoDB query failed in refreshInviteCode, using memory fallback:', err.message);
      }
    }

    const updated = dbStore.upsertUser(clerkId, { inviteCode: newCode, role: 'Parent' });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProfile,
  syncUser,
  selectRole,
  linkParent,
  unlinkParent,
  refreshInviteCode
};
