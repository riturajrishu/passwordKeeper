import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const makeAdmin = async () => {
  const email = process.argv[2];
  if (!email) {
    console.error('Please provide an email address as an argument.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/passwordkeeper');
    console.log('Connected to DB');

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.error('User not found!');
      process.exit(1);
    }

    user.role = 'superadmin';
    await user.save();

    console.log(`Successfully upgraded ${email} to superadmin!`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

makeAdmin();
