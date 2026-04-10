import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const findUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find({}, 'email role');
    console.log('Registered Users:');
    users.forEach(u => console.log(`- ${u.email} (${u.role || 'user'})`));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

findUsers();
