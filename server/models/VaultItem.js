import mongoose from 'mongoose';

const vaultItemSchema = new mongoose.Schema({
  userId: {
    type: String, // Firebase UID
    required: true,
    index: true
  },
  // The fully encrypted JSON blob containing password details
  // Only the client with the master password can decrypt this
  encryptedBlob: {
    type: String,
    required: true
  },
  itemType: {
    type: String,
    enum: ['LOGIN', 'CREDIT_CARD', 'IDENTITY', 'WIFI', 'SECURE_NOTE', 'FILE'],
    default: 'LOGIN'
  },
  category: {
    type: String,
    default: 'Uncategorized'
  },
  isFavorite: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String
  }],
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  passwordHistory: [{
    encryptedBlob: String,
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const VaultItem = mongoose.model('VaultItem', vaultItemSchema);
export default VaultItem;
