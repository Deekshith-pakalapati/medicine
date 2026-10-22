const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const { initCronJobs } = require('./src/services/cronService');

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Database connection
mongoose.set('bufferCommands', false);

const connectMongoDB = async () => {
  if (mongoose.connection.readyState === 1) return;
  try {
    require('dotenv').config({ override: true });
    if (!process.env.MONGODB_URI) return;
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
    console.log('✅ Connected to MongoDB Atlas! All data is now persistently stored in MongoDB.');
  } catch (err) {
    console.warn(`[Notice] MongoDB Atlas connection failed (${err.message}).`);
    console.log('💡 To store all data permanently in MongoDB Atlas, update your Database Access credentials in backend/.env');
  }
};

connectMongoDB();

// Periodically check and auto-connect as soon as valid credentials are saved in .env
setInterval(() => {
  if (mongoose.connection.readyState !== 1) {
    connectMongoDB();
  }
}, 15000);

// Basic route
app.get('/', (req, res) => {
  res.send('MediCare Reminder API is running');
});

// Import Routes
const userRoutes = require('./src/routes/userRoutes');
const medicineRoutes = require('./src/routes/medicineRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');

app.use('/api/users', userRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initCronJobs();
});
