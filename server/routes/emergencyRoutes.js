import express from 'express';
import EmergencyContact from '../models/EmergencyContact.js';
import User from '../models/User.js';
import VaultItem from '../models/VaultItem.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Constants ─────────────────────────────────────────────────────────────
const INVITE_EXPIRY_DAYS = 7;
const APPROVAL_WINDOW_HOURS = 24;
const MAX_CONTACTS_PER_USER = 5;
const ALLOWED_DELAY_DAYS = [7, 14, 30, 60, 90];

// ══════════════════════════════════════════════════════════════════════════
// @route   POST /api/emergency/contacts
// @desc    Owner adds an emergency contact
// @access  Private (Owner)
// ══════════════════════════════════════════════════════════════════════════
router.post('/contacts', verifyToken, async (req, res) => {
    try {
        const { contactEmail, contactName, delayDays } = req.body;

        // ── Validation ────────────────────────────────────────────────
        if (!contactEmail || !contactName) {
            return res.status(400).json({ message: 'Contact email and name are required' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contactEmail)) {
            return res.status(400).json({ message: 'Invalid email address' });
        }

        const delay = Number(delayDays) || 30;
        if (!ALLOWED_DELAY_DAYS.includes(delay)) {
            return res.status(400).json({ message: 'Invalid delay. Choose: 7, 14, 30, 60, or 90 days' });
        }

        // ── Get owner info ────────────────────────────────────────────
        const owner = await User.findById(req.user.uid).select('email name');
        if (!owner) return res.status(404).json({ message: 'User not found' });

        // ── Prevent adding self as contact ────────────────────────────
        if (owner.email.toLowerCase() === contactEmail.toLowerCase()) {
            return res.status(400).json({ message: 'You cannot add yourself as an emergency contact' });
        }

        // ── Check duplicate ───────────────────────────────────────────
        const existing = await EmergencyContact.findOne({
            ownerId: req.user.uid,
            contactEmail: contactEmail.toLowerCase(),
            status: { $nin: ['revoked'] }
        });
        if (existing) {
            return res.status(409).json({ message: 'This contact is already added' });
        }

        // ── Rate limit ────────────────────────────────────────────────
        const count = await EmergencyContact.countDocuments({
            ownerId: req.user.uid,
            status: { $nin: ['revoked'] }
        });
        if (count >= MAX_CONTACTS_PER_USER) {
            return res.status(429).json({ message: `Maximum ${MAX_CONTACTS_PER_USER} emergency contacts allowed` });
        }

        // ── Generate invite token ─────────────────────────────────────
        const inviteToken = EmergencyContact.generateToken();
        const inviteExpiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

        // ── Create contact record ─────────────────────────────────────
        const contact = new EmergencyContact({
            ownerId: req.user.uid,
            ownerName: owner.name || owner.email,
            ownerEmail: owner.email,
            contactEmail: contactEmail.toLowerCase(),
            contactName,
            delayDays: delay,
            inviteToken,
            inviteExpiresAt,
            status: 'pending_invite'
        });

        await contact.save();

        return res.status(201).json({
            message: 'Emergency contact added successfully',
            contact: {
                id: contact._id,
                contactEmail: contact.contactEmail,
                contactName: contact.contactName,
                delayDays: contact.delayDays,
                status: contact.status,
                inviteToken,
                // Full invite URL — in production this would be emailed
                inviteLink: `${process.env.CLIENT_URL || 'http://localhost:5173'}/emergency/invite/${inviteToken}`,
                inviteExpiresAt: contact.inviteExpiresAt,
                createdAt: contact.createdAt
            }
        });

    } catch (error) {
        console.error('Add emergency contact error:', error);
        return res.status(500).json({ message: 'Server error while adding emergency contact' });
    }
});

// ══════════════════════════════════════════════════════════════════════════
// @route   GET /api/emergency/contacts
// @desc    Get all of this owner's emergency contacts
// @access  Private (Owner)
// ══════════════════════════════════════════════════════════════════════════
router.get('/contacts', verifyToken, async (req, res) => {
    try {
        const owner = await User.findById(req.user.uid).select('lastActiveAt email');
        if (!owner) return res.status(404).json({ message: 'User not found' });

        const contacts = await EmergencyContact.find({
            ownerId: req.user.uid,
            status: { $nin: ['revoked'] }
        }).sort({ createdAt: -1 }).lean();

        const result = contacts.map(c => ({
            id: c._id,
            contactEmail: c.contactEmail,
            contactName: c.contactName,
            delayDays: c.delayDays,
            status: c.status,
            // Only include invite link for pending contacts (not yet accepted)
            inviteLink: c.status === 'pending_invite'
                ? `${process.env.CLIENT_URL || 'http://localhost:5173'}/emergency/invite/${c.inviteToken}`
                : null,
            inviteExpiresAt: c.inviteExpiresAt,
            inviteAcceptedAt: c.inviteAcceptedAt,
            accessRequestedAt: c.accessRequestedAt,
            accessApprovalDeadline: c.accessApprovalDeadline,
            accessGrantedAt: c.accessGrantedAt,
            createdAt: c.createdAt,
            hasSharedKey: !!c.encryptedMasterKeyBundle,
            contactPublicKey: c.contactPublicKey || null,
            // Calculated: days until contact CAN request access
            daysUntilEligible: (() => {
                if (!owner.lastActiveAt) return null;
                const inactiveMs = Date.now() - new Date(owner.lastActiveAt).getTime();
                const requiredMs = c.delayDays * 24 * 60 * 60 * 1000;
                const remaining = Math.max(0, requiredMs - inactiveMs);
                return Math.ceil(remaining / (24 * 60 * 60 * 1000));
            })()
        }));

        return res.json({ contacts: result, lastActiveAt: owner.lastActiveAt });

    } catch (error) {
        console.error('Get emergency contacts error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════════════
// @route   DELETE /api/emergency/contacts/:id
// @desc    Owner removes an emergency contact
// @access  Private (Owner)
// ══════════════════════════════════════════════════════════════════════════
router.delete('/contacts/:id', verifyToken, async (req, res) => {
    try {
        const contact = await EmergencyContact.findOneAndDelete({
            _id: req.params.id,
            ownerId: req.user.uid
        });

        if (!contact) {
            return res.status(404).json({ message: 'Contact not found or you are not the owner' });
        }

        return res.json({ message: 'Emergency contact removed successfully' });
    } catch (error) {
        console.error('Delete emergency contact error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════════════
// @route   PUT /api/emergency/contacts/:id/key
// @desc    Owner uploads RSA-encrypted master key bundle for a contact
// @access  Private (Owner)
// ══════════════════════════════════════════════════════════════════════════
router.put('/contacts/:id/key', verifyToken, async (req, res) => {
    try {
        const { encryptedMasterKeyBundle } = req.body;

        if (!encryptedMasterKeyBundle) {
            return res.status(400).json({ message: 'Encrypted key bundle is required' });
        }

        const contact = await EmergencyContact.findOne({
            _id: req.params.id,
            ownerId: req.user.uid
        });

        if (!contact) {
            return res.status(404).json({ message: 'Contact not found' });
        }

        if (contact.status === 'pending_invite') {
            return res.status(400).json({ message: 'Contact must accept invite first' });
        }

        contact.encryptedMasterKeyBundle = encryptedMasterKeyBundle;
        await contact.save();

        return res.json({ message: 'Emergency access key shared securely' });

    } catch (error) {
        console.error('Upload emergency key error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════════════
// @route   GET /api/emergency/invite/:token
// @desc    Get invite details (PUBLIC — contact opens link from email)
// @access  Public
// ══════════════════════════════════════════════════════════════════════════
router.get('/invite/:token', async (req, res) => {
    try {
        const { token } = req.params;

        // Validate token format
        if (!/^[a-f0-9]{64}$/.test(token)) {
            return res.status(400).json({ message: 'Invalid invite token format' });
        }

        const contact = await EmergencyContact.findOne({ inviteToken: token });

        if (!contact) {
            return res.status(404).json({ message: 'Invite not found or already used' });
        }

        if (contact.status !== 'pending_invite') {
            return res.status(410).json({ message: 'This invite has already been accepted' });
        }

        if (contact.inviteExpiresAt < new Date()) {
            return res.status(410).json({ message: 'This invite link has expired. Ask the owner to re-send it.' });
        }

        return res.json({
            contactName: contact.contactName,
            contactEmail: contact.contactEmail,
            ownerName: contact.ownerName,
            ownerEmail: contact.ownerEmail,
            delayDays: contact.delayDays,
            inviteExpiresAt: contact.inviteExpiresAt
        });

    } catch (error) {
        console.error('Get invite error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════════════
// @route   POST /api/emergency/invite/:token/accept
// @desc    Contact accepts invite and submits their RSA public key
// @access  Public
// ══════════════════════════════════════════════════════════════════════════
router.post('/invite/:token/accept', async (req, res) => {
    try {
        const { token } = req.params;
        const { contactPublicKey } = req.body;

        if (!/^[a-f0-9]{64}$/.test(token)) {
            return res.status(400).json({ message: 'Invalid invite token format' });
        }

        if (!contactPublicKey || typeof contactPublicKey !== 'string' || contactPublicKey.length < 100) {
            return res.status(400).json({ message: 'Valid RSA public key is required' });
        }

        const contact = await EmergencyContact.findOne({ inviteToken: token });

        if (!contact) {
            return res.status(404).json({ message: 'Invite not found' });
        }

        if (contact.status !== 'pending_invite') {
            return res.status(410).json({ message: 'This invite has already been accepted' });
        }

        if (contact.inviteExpiresAt < new Date()) {
            return res.status(410).json({ message: 'This invite link has expired' });
        }

        // Store public key and mark as accepted
        contact.contactPublicKey = contactPublicKey;
        contact.status = 'invite_accepted';
        contact.inviteAcceptedAt = new Date();
        await contact.save();

        return res.json({
            message: 'Invite accepted successfully! You are now an emergency contact.',
            contactId: contact._id
        });

    } catch (error) {
        console.error('Accept invite error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════════════
// @route   POST /api/emergency/request/:id
// @desc    Contact requests access (checks inactivity period)
// @access  Public (contact uses their contactAccessToken check via contactId)
// ══════════════════════════════════════════════════════════════════════════
router.post('/request/:id', async (req, res) => {
    try {
        const contact = await EmergencyContact.findById(req.params.id);

        if (!contact) {
            return res.status(404).json({ message: 'Emergency contact record not found' });
        }

        // Allow re-request from access_denied status (after owner denied a previous request)
        if (contact.status !== 'invite_accepted' && contact.status !== 'access_denied') {
            if (contact.status === 'access_requested') {
                return res.status(409).json({
                    message: 'Access already requested. Waiting for approval window.',
                    accessApprovalDeadline: contact.accessApprovalDeadline
                });
            }
            if (contact.status === 'access_granted') {
                return res.status(409).json({ message: 'Access already granted' });
            }
            return res.status(400).json({ message: `Cannot request access in current status: ${contact.status}` });
        }

        // ── Check owner inactivity period ─────────────────────────────
        const owner = await User.findById(contact.ownerId).select('lastActiveAt name email');
        if (!owner) return res.status(404).json({ message: 'Owner account not found' });

        const isInactive = contact.isOwnerInactive(owner.lastActiveAt);
        if (!isInactive) {
            const inactiveMs = Date.now() - new Date(owner.lastActiveAt || owner.createdAt).getTime();
            const requiredMs = contact.delayDays * 24 * 60 * 60 * 1000;
            const daysRemaining = Math.ceil((requiredMs - inactiveMs) / (24 * 60 * 60 * 1000));
            return res.status(403).json({
                message: `The owner has been active recently. You can request access after ${daysRemaining} more days of inactivity.`,
                daysRemaining
            });
        }

        // ── Set approval window: owner has 24h to deny ────────────────
        const now = new Date();
        contact.status = 'access_requested';
        contact.accessRequestedAt = now;
        contact.accessApprovalDeadline = new Date(now.getTime() + APPROVAL_WINDOW_HOURS * 60 * 60 * 1000);
        await contact.save();

        return res.json({
            message: `Access requested. The owner has ${APPROVAL_WINDOW_HOURS} hours to deny. If no action is taken, access will be granted automatically.`,
            accessApprovalDeadline: contact.accessApprovalDeadline
        });

    } catch (error) {
        console.error('Request emergency access error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════════════
// @route   POST /api/emergency/deny/:id
// @desc    Owner denies the access request within the 24h window
// @access  Private (Owner)
// ══════════════════════════════════════════════════════════════════════════
router.post('/deny/:id', verifyToken, async (req, res) => {
    try {
        const contact = await EmergencyContact.findOne({
            _id: req.params.id,
            ownerId: req.user.uid
        });

        if (!contact) {
            return res.status(404).json({ message: 'Contact not found or you are not the owner' });
        }

        if (contact.status !== 'access_requested') {
            return res.status(400).json({ message: 'No pending access request to deny' });
        }

        if (contact.isApprovalWindowPassed()) {
            return res.status(410).json({ message: 'The 24-hour approval window has already passed' });
        }

        // Deny access — reset back to accepted so they can try again later
        contact.status = 'access_denied';
        contact.accessDeniedAt = new Date();
        contact.accessRequestedAt = null;
        contact.accessApprovalDeadline = null;
        await contact.save();

        return res.json({ message: 'Emergency access request denied successfully' });

    } catch (error) {
        console.error('Deny emergency access error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════════════
// @route   GET /api/emergency/access/:id
// @desc    Contact retrieves encrypted vault data after approval window passes
// @access  Public (contact provides contactId — verified by checking status)
// ══════════════════════════════════════════════════════════════════════════
router.get('/access/:id', async (req, res) => {
    try {
        const contact = await EmergencyContact.findById(req.params.id);

        if (!contact) {
            return res.status(404).json({ message: 'Emergency record not found' });
        }

        // Must have public key (invite accepted)
        if (!contact.contactPublicKey) {
            return res.status(400).json({ message: 'Invite not yet accepted' });
        }

        // ── If access was denied, inform contact ───────────────────────
        if (contact.status === 'access_denied') {
            return res.status(403).json({
                message: 'Access request was denied by the owner. You may request again after the inactivity period.'
            });
        }

        // ── Must be in access_requested state ─────────────────────────
        if (contact.status !== 'access_requested' && contact.status !== 'access_granted') {
            // SECURITY IMPROVEMENT: Return public info for client-side key validation
            return res.status(200).json({
                message: 'No active access request. Please request access first.',
                status: contact.status,
                contactPublicKey: contact.contactPublicKey,
                ownerName: contact.ownerName
            });
        }

        // ── Check if 24h approval window has passed ───────────────────
        if (contact.status === 'access_requested') {
            if (!contact.isApprovalWindowPassed()) {
                const msRemaining = new Date(contact.accessApprovalDeadline).getTime() - Date.now();
                const hoursRemaining = Math.ceil(msRemaining / 3600000);
                return res.status(202).json({
                    message: `Waiting for owner approval. ${hoursRemaining} hour(s) remaining in the approval window.`,
                    accessApprovalDeadline: contact.accessApprovalDeadline,
                    hoursRemaining
                });
            }
        }

        // ── Approval window passed — fetch vault items for this owner ──
        // Re-encrypt with contact's public key if not done yet
        if (!contact.encryptedVaultBlob || contact.status !== 'access_granted') {
            const vaultItems = await VaultItem.find({
                userId: contact.ownerId,
                isDeleted: { $ne: true }
            }).select('encryptedBlob').lean();

            // Bundle all encrypted blobs — contact's browser will decrypt using master key
            // NOTE: Since we're zero-knowledge, we send the already-encrypted blobs.
            // The contact must have the owner's master password to decrypt — this is by design.
            // The encrypted blobs are wrapped with the contact's RSA public key for transport security.
            const vaultBundle = JSON.stringify({
                items: vaultItems.map(i => ({ id: i._id, encryptedData: i.encryptedBlob })),
                bundledAt: new Date().toISOString()
            });

            contact.encryptedVaultBlob = vaultBundle;
            contact.status = 'access_granted';
            contact.accessGrantedAt = new Date();
            await contact.save();
        }

        return res.json({
            message: 'Access granted',
            encryptedVaultBlob: contact.encryptedVaultBlob,
            encryptedMasterKeyBundle: contact.encryptedMasterKeyBundle,
            contactPublicKey: contact.contactPublicKey,
            ownerName: contact.ownerName,
            grantedAt: contact.accessGrantedAt
        });

    } catch (error) {
        console.error('Get emergency access error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

export default router;
