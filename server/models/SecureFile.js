import mongoose from 'mongoose';

const secureFileSchema = new mongoose.Schema({
  userId: {
    type: String, // Firebase UID
    required: true,
    index: true
  },
  // Paths to where the binary encrypted file is stored on disk
  storagePath: {
    type: String,
    required: true
  },
  originalSize: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const SecureFile = mongoose.model('SecureFile', secureFileSchema);
export default SecureFile;
