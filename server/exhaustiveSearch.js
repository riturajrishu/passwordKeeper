import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

async function run() {
  try {
    const uri = process.env.MONGO_URI;
    console.log('Connecting to:', uri);
    const client = await mongoose.connect(uri);
    
    // Check current DB name
    console.log('Current DB:', client.connection.name);
    
    // List all databases
    const admin = client.connection.db.admin();
    const dbs = await admin.listDatabases();
    console.log('All Databases in Cluster:', dbs.databases.map(d => d.name));
    
    // For each database (except system ones), check 'users' collection
    for (const dbInfo of dbs.databases) {
        if (['admin', 'local', 'config'].includes(dbInfo.name)) continue;
        
        const db = client.connection.useDb(dbInfo.name);
        const User = db.model('User', new mongoose.Schema({ email: String, role: String }, { collection: 'users' }));
        const users = await User.find({});
        if (users.length > 0) {
            console.log(`Found ${users.length} users in DB "${dbInfo.name}":`);
            users.forEach(u => console.log(` - ${u.email} (${u.role})`));
        }
    }
    
    process.exit(0);
  } catch (err) {
    console.error('FAILED:', err);
    process.exit(1);
  }
}
run();
