require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || '';
const maskedUri = uri.replace(/:([^:@]+)@/, ':****@');

console.log('Testing MongoDB connection to:', maskedUri);

mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log('✅ SUCCESS: Connected to MongoDB Atlas!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ FAILED to connect to MongoDB Atlas.');
    console.error('Error details:', err.message);
    if (err.message.includes('authentication failed')) {
      console.log('\n💡 HOW TO FIX:');
      console.log('1. Go to cloud.mongodb.com -> Security -> Database Access');
      console.log('2. Check the Database User username and password.');
      console.log('3. Ensure "Read and write to any database" privileges are granted.');
      console.log('4. Update MONGODB_URI in backend/.env');
    }
    process.exit(1);
  });
