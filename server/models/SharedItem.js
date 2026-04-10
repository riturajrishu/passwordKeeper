import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const sharedItemSchema = new mongoose.Schema({
    // Unique token for the share URL (e.g., /share/:token)
    token: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    // The vault item's data re-encrypted with a temporary shareKey
    // The shareKey itself is NEVER stored here — it travels in the URL hash only
    encryptedShareBlob: {
        type: String,
        required: true
    },
    // Optional bcrypt hash of a PIN (4-8 digits) set by the sharer
    pinHash: {
        type: String,
        default: null
    },
    // Whether this link has been consumed (one-time access)
    isUsed: {
        type: Boolean,
        default: false
    },
    // Firebase UID of the user who created this share link
    createdBy: {
        type: String,
        required: true,
        index: true
    },
    // Human-readable label for the shared item (e.g., "GitHub", "Netflix")
    // Not sensitive — just for display in "My Active Links"
    itemLabel: {
        type: String,
        default: 'Shared Item'
    },
    // When this share link expires — MongoDB TTL index will auto-delete it
    expiresAt: {
        type: Date,
        required: true
    },
    // Audit log — who accessed this link
    accessLog: {
        ip: { type: String, default: null },
        accessedAt: { type: Date, default: null },
        userAgent: { type: String, default: null }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// ── MongoDB TTL Index ──────────────────────────────────────────────────────
// Documents are automatically deleted by MongoDB after expiresAt passes.
// This eliminates need for manual cleanup cron jobs.
sharedItemSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ── Instance method: Compare PIN ───────────────────────────────────────────
sharedItemSchema.methods.comparePin = async function (candidatePin) {
    if (!this.pinHash) return true; // No PIN set → always pass
    return bcrypt.compare(String(candidatePin), this.pinHash);
};

// ── Static method: Hash PIN before saving ─────────────────────────────────
sharedItemSchema.statics.hashPin = async function (pin) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(String(pin), salt);
};

const SharedItem = mongoose.model('SharedItem', sharedItemSchema);
export default SharedItem;
