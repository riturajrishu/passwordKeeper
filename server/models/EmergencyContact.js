import mongoose from 'mongoose';
import crypto from 'crypto';

const emergencyContactSchema = new mongoose.Schema({

    // ── Owner ──────────────────────────────────────────────────────────────
    ownerId: {
        type: String,
        required: true,
        index: true
    },
    ownerName: {
        type: String,
        default: ''
    },
    ownerEmail: {
        type: String,
        default: ''
    },

    // ── Contact Info ───────────────────────────────────────────────────────
    contactEmail: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    contactName: {
        type: String,
        required: true,
        trim: true
    },

    // ── Configuration ──────────────────────────────────────────────────────
    // How many days of inactivity before contact can request access
    delayDays: {
        type: Number,
        enum: [7, 14, 30, 60, 90],
        default: 30
    },

    // ── Status ─────────────────────────────────────────────────────────────
    status: {
        type: String,
        enum: ['pending_invite', 'invite_accepted', 'access_requested', 'access_granted', 'access_denied', 'revoked'],
        default: 'pending_invite'
    },

    // ── Zero-Knowledge: Contact's RSA Public Key ───────────────────────────
    // Contact's browser generates RSA-OAEP key pair
    // Public key is stored here; private key NEVER leaves contact's device
    contactPublicKey: {
        type: String,   // Base64-encoded SPKI public key
        default: null
    },

    // ── Encrypted Vault Data ───────────────────────────────────────────────
    // When access is granted, vault items are encrypted with contact's public key
    // Format: { encryptedKey: Base64, encryptedItems: Base64 }
    encryptedVaultBlob: {
        type: String,
        default: null
    },

    // RSA-OAEP + AES-GCM bundle containing the owner's master key
    // Encrypted with the contact's public key by the owner's browser
    encryptedMasterKeyBundle: {
        type: String,
        default: null
    },

    // ── Invite System ──────────────────────────────────────────────────────
    inviteToken: {
        type: String,
        unique: true,
        sparse: true  // sparse allows multiple null values
    },
    inviteExpiresAt: {
        type: Date,
        default: null
    },
    inviteAcceptedAt: {
        type: Date,
        default: null
    },

    // ── Access Request ─────────────────────────────────────────────────────
    accessRequestedAt: {
        type: Date,
        default: null
    },
    // Owner has 24 hours to deny after contact requests access
    accessApprovalDeadline: {
        type: Date,
        default: null
    },
    accessGrantedAt: {
        type: Date,
        default: null
    },
    accessDeniedAt: {
        type: Date,
        default: null
    },

    // ── Contact Access Token ───────────────────────────────────────────────
    // One-time token given to contact to retrieve their encrypted vault blob
    contactAccessToken: {
        type: String,
        default: null
    },

    // ── Audit ──────────────────────────────────────────────────────────────
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Auto-update updatedAt before every save
emergencyContactSchema.pre('save', function () {
    this.updatedAt = new Date();
});

// ── Static: Generate a cryptographically secure one-time token ────────────
emergencyContactSchema.statics.generateToken = function () {
    return crypto.randomBytes(32).toString('hex'); // 64-char hex
};

// ── Instance: Check if owner has been inactive long enough ────────────────
emergencyContactSchema.methods.isOwnerInactive = function (lastActiveAt) {
    if (!lastActiveAt) return false;
    const inactiveMs = Date.now() - new Date(lastActiveAt).getTime();
    const requiredMs = this.delayDays * 24 * 60 * 60 * 1000;
    return inactiveMs >= requiredMs;
};

// ── Instance: Check if approval window has passed (24h) ───────────────────
emergencyContactSchema.methods.isApprovalWindowPassed = function () {
    if (!this.accessApprovalDeadline) return false;
    return new Date() > this.accessApprovalDeadline;
};

const EmergencyContact = mongoose.model('EmergencyContact', emergencyContactSchema);
export default EmergencyContact;
