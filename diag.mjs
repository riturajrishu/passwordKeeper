import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, 'server', '.env') });

async function run() {
  try {
    console.log('Uri:', process.env.MONGO_URI);
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to Database:', conn.connection.name);
    
    // List all collections in this database
    const collections = await conn.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    // Check 'users' collection specifically
    const User = conn.connection.model('User', new mongoose.Schema({ email: String, role: String }));
    const users = await User.find({});
    console.log('Total Users Found:', users.length);
    users.forEach(u => console.log(` - ${u.email} (${u.role})`));
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
