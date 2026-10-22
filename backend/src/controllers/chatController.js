const mongoose = require('mongoose');
const Groq = require('groq-sdk');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const Medicine = require('../models/Medicine');
const dbStore = require('../services/dbStore');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const isDbReady = () => mongoose.connection.readyState === 1;

// Working Groq models with automatic fallback
const CANDIDATE_MODELS = [
  process.env.GROQ_MODEL,
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-120b',
  'llama-3.1-8b-instant'
].filter(Boolean);

const chat = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const clerkId = req.auth?.userId;
    let user = null;
    let medicines = [];

    // Attempt to load user from MongoDB or in-memory fallback
    if (isDbReady() && clerkId) {
      try {
        user = await User.findOne({ clerkId });
        if (user) {
          let parentId = user._id;
          if (user.role === 'Mentee' && user.linkedParentId) {
            parentId = user.linkedParentId;
          }
          medicines = await Medicine.find({ parentId, status: 'Active' });
        }
      } catch (err) {
        console.warn('MongoDB query failed in chat, using fallback:', err.message);
      }
    }

    if (!user && clerkId) {
      user = dbStore.findUserByClerkId(clerkId) || dbStore.upsertUser(clerkId, {});
      let parentId = user._id;
      if (user.role === 'Mentee' && user.linkedParentId) {
        parentId = user.linkedParentId;
      }
      medicines = dbStore.findMedicinesByParentId(parentId);
    }

    const userName = user?.name || 'there';
    const userRole = user?.role || 'User';
    const medsContext = medicines.map(m => `${m.name} (${m.dosage}) at ${Array.isArray(m.reminderTimes) ? m.reminderTimes.join(', ') : ''}`).join('; ');

    const systemPrompt = `You are MediCare Assistant, a warm, reassuring, and knowledgeable AI assistant designed to help elderly patients and their caregivers with medicine adherence, timing, and general health wellness.
The user you are speaking with is named ${userName} (${userRole}).
Active medicines listed for this account: ${medsContext || 'None currently listed'}.
Important guidelines:
- Be concise, friendly, clear, and easy to read.
- If asked about a missed dose, provide practical general guidance (check label, take soon unless close to next dose, never double up) and advise consulting their doctor or pharmacist for specific prescriptions.
- Support both English and Telugu if the user writes in Telugu.
- Never prescribe prescription drugs or give definitive medical diagnoses.`;

    // Retrieve recent history
    let formattedHistory = [];
    if (user?._id) {
      if (isDbReady()) {
        try {
          const recentHistory = await ChatMessage.find({ userId: user._id }).sort({ createdAt: -1 }).limit(8);
          formattedHistory = recentHistory.reverse().flatMap(msg => [
            { role: 'user', content: msg.message },
            { role: 'assistant', content: msg.aiResponse }
          ]);
        } catch (e) {
          // ignore
        }
      }
      if (formattedHistory.length === 0) {
        const localHistory = dbStore.getChatHistory(user._id, 8);
        formattedHistory = localHistory.flatMap(msg => [
          { role: 'user', content: msg.message },
          { role: 'assistant', content: msg.aiResponse }
        ]);
      }
    }

    // Call Groq with candidate models
    let aiResponse = null;
    let lastError = null;

    for (const model of CANDIDATE_MODELS) {
      try {
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            ...formattedHistory,
            { role: 'user', content: message }
          ],
          model,
          temperature: 0.6,
          max_tokens: 500
        });

        aiResponse = chatCompletion.choices[0]?.message?.content;
        if (aiResponse) break;
      } catch (err) {
        lastError = err;
        console.warn(`Groq model ${model} failed (${err.message}). Trying next candidate...`);
      }
    }

    if (!aiResponse) {
      console.error('All Groq candidate models failed. Last error:', lastError);
      aiResponse = "I'm having trouble connecting to my AI core right now, but please remember: always follow your doctor's instructions for any medication. If you missed a dose, check the label or consult your pharmacist before taking an extra pill.";
    }

    // Save chat message
    if (user?._id) {
      dbStore.saveChatMessage(user._id, message, aiResponse);
      if (isDbReady()) {
        try {
          const chatMsg = new ChatMessage({
            userId: user._id,
            message,
            aiResponse
          });
          await chatMsg.save();
        } catch (e) {
          // In-memory already saved
        }
      }
    }

    res.json({ reply: aiResponse });
  } catch (error) {
    console.error('Groq Error in chatController:', error);
    res.json({ reply: "I'm here to help! For medication safety, always follow the prescription schedule and never take double doses to make up for a missed pill." });
  }
};

const getChatHistory = async (req, res) => {
  try {
    const clerkId = req.auth?.userId;
    if (!clerkId) return res.json([]);

    let user = null;
    if (isDbReady()) {
      try {
        user = await User.findOne({ clerkId });
        if (user) {
          const history = await ChatMessage.find({ userId: user._id }).sort({ createdAt: 1 }).limit(50);
          return res.json(history);
        }
      } catch (e) {
        console.warn('MongoDB query failed in getChatHistory:', e.message);
      }
    }

    user = dbStore.findUserByClerkId(clerkId);
    if (!user) return res.json([]);

    const history = dbStore.getChatHistory(user._id, 50);
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const clearChatHistory = async (req, res) => {
  try {
    const clerkId = req.auth?.userId;
    if (!clerkId) return res.json({ message: 'Chat cleared' });

    if (isDbReady()) {
      try {
        const user = await User.findOne({ clerkId });
        if (user) {
          await ChatMessage.deleteMany({ userId: user._id });
        }
      } catch (e) {
        // ignore
      }
    }

    const user = dbStore.findUserByClerkId(clerkId);
    if (user) dbStore.clearChatHistory(user._id);

    res.json({ message: 'Chat cleared' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { chat, getChatHistory, clearChatHistory };
