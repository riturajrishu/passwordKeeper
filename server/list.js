import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find({}, 'email role');
  console.log('USERS_IN_DB:');
  users.forEach(u => console.log(`- ${u.email} (${u.role})`));
  process.exit(0);
}
run();
