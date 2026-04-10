import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findOneAndUpdate(
        { email: 'rishu@gmail.com' }, 
        { role: 'superadmin' }, 
        { new: true }
    );
    
    if (user) {
        console.log(`Successfully upgraded ${user.email} to ${user.role}!`);
    } else {
        console.log('User not found!');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
