import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    trim: true 
  },
  passwordHash: { 
    type: String, 
    required: true 
  },
  masterAuthHash: {
    type: String
  },
  name: {
    type: String,
    trim: true,
    default: ''
  },
  phoneNumber: {
    type: String,
    trim: true,
    default: ''
  },
  passwordHint: {
    type: String,
    trim: true,
    default: ''
  },
  recoveryHash: {
    type: String
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'superadmin'],
    default: 'user'
  },
  securityStats: {
    totalItems: { type: Number, default: 0 },
    weakPasswords: { type: Number, default: 0 },
    strongPasswords: { type: Number, default: 0 },
    lastSynced: { type: Date }
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  // Updated on every authenticated API call — powers the Dead Man's Switch
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  sessions: [{
    token: String,
    ip: String,
    browser: String,
    os: String,
    lastActive: { type: Date, default: Date.now }
  }],
  passkeys: [{
    credentialID: String,
    credentialPublicKey: Buffer,
    counter: Number,
    transports: [String]
  }]
});

userSchema.pre('save', async function () {
  if (this.isModified('passwordHash')) {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  }
  if (this.isModified('masterAuthHash') && this.masterAuthHash) {
    const salt = await bcrypt.genSalt(10);
    this.masterAuthHash = await bcrypt.hash(this.masterAuthHash, salt);
  }
  if (this.isModified('recoveryHash')) {
    const salt = await bcrypt.genSalt(10);
    this.recoveryHash = await bcrypt.hash(this.recoveryHash, salt);
  }
});

// Method to compare the provided candidate string/hash against the stored bcrypt hash (Login Password fallback)
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Method to verify unlocking of the vault locally
userSchema.methods.compareMaster = async function (candidateMasterAuthHash) {
  if (this.masterAuthHash) {
    return bcrypt.compare(candidateMasterAuthHash, this.masterAuthHash);
  }
  // V1 Fallback: In older accounts, the masterAuthHash was stored in passwordHash
  return bcrypt.compare(candidateMasterAuthHash, this.passwordHash);
};

export default mongoose.model('User', userSchema);
