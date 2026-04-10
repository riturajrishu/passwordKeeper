import express from 'express';
import crypto from 'crypto';
import SharedItem from '../models/SharedItem.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// ─── Helper: Get client IP safely ─────────────────────────────────────────
const getClientIp = (req) => {
    return (
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.socket?.remoteAddress ||
        'unknown'
    );
};

// ─── Helper: Validate expiry hours ────────────────────────────────────────
const ALLOWED_EXPIRY_HOURS = [1, 6, 24, 168]; // 1h, 6h, 24h, 7 days
const MAX_LINKS_PER_USER = 20; // Prevent abuse

// ══════════════════════════════════════════════════════════════════════════
// @route   POST /api/share
// @desc    Create a new one-time share link
// @access  Private (Authenticated users only)
// ══════════════════════════════════════════════════════════════════════════
router.post('/', verifyToken, async (req, res) => {
    try {
        const { encryptedShareBlob, pin, expiresInHours, itemLabel } = req.body;

        // ── Input validation ──────────────────────────────────────────
        if (!encryptedShareBlob || typeof encryptedShareBlob !== 'string') {
            return res.status(400).json({ message: 'Encrypted payload is required' });
        }

        const expiry = Number(expiresInHours);
        if (!ALLOWED_EXPIRY_HOURS.includes(expiry)) {
            return res.status(400).json({ message: 'Invalid expiry. Choose 1, 6, 24, or 168 hours.' });
        }

        // ── Rate limit: max links per user ────────────────────────────
        const existingCount = await SharedItem.countDocuments({
            createdBy: req.user.uid,
            isUsed: false,
            expiresAt: { $gt: new Date() }
        });
        if (existingCount >= MAX_LINKS_PER_USER) {
            return res.status(429).json({ message: `Maximum ${MAX_LINKS_PER_USER} active share links allowed. Revoke older links first.` });
        }

        // ── Hash PIN if provided ──────────────────────────────────────
        let pinHash = null;
        if (pin !== undefined && pin !== null && pin !== '') {
            const pinStr = String(pin).trim();
            if (!/^\d{4,8}$/.test(pinStr)) {
                return res.status(400).json({ message: 'PIN must be 4-8 digits only' });
            }
            pinHash = await SharedItem.hashPin(pinStr);
        }

        // ── Generate a cryptographically secure token ─────────────────
        const token = crypto.randomBytes(32).toString('hex'); // 64-char hex string

        // ── Calculate expiry date ─────────────────────────────────────
        const expiresAt = new Date(Date.now() + expiry * 60 * 60 * 1000);

        // ── Create the shared item document ───────────────────────────
        const sharedItem = new SharedItem({
            token,
            encryptedShareBlob,
            pinHash,
            createdBy: req.user.uid,
            itemLabel: itemLabel || 'Shared Item',
            expiresAt
        });

        await sharedItem.save();

        return res.status(201).json({
            token,
            expiresAt,
            hasPinProtection: !!pinHash
        });

    } catch (error) {
        console.error('Error creating share link:', error);
        return res.status(500).json({ message: 'Server error while creating share link' });
    }
});

// ══════════════════════════════════════════════════════════════════════════
// @route   GET /api/share/my-links
// @desc    Get all active share links created by the authenticated user
// @access  Private
// ══════════════════════════════════════════════════════════════════════════
router.get('/my-links', verifyToken, async (req, res) => {
    try {
        const links = await SharedItem.find({
            createdBy: req.user.uid,
            expiresAt: { $gt: new Date() } // Only non-expired links
        })
            .select('token itemLabel expiresAt isUsed hasPinProtection createdAt accessLog pinHash')
            .sort({ createdAt: -1 })
            .lean();

        // Map to safe response (never return pinHash or encrypted blob)
        const safeLinks = links.map(link => ({
            token: link.token,
            itemLabel: link.itemLabel,
            expiresAt: link.expiresAt,
            isUsed: link.isUsed,
            hasPinProtection: !!link.pinHash,
            createdAt: link.createdAt,
            accessLog: link.accessLog
        }));

        return res.json(safeLinks);
    } catch (error) {
        console.error('Error fetching my share links:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════════════
// @route   GET /api/share/:token
// @desc    Validate token + return encrypted blob (PUBLIC — no auth required)
// @access  Public
// ══════════════════════════════════════════════════════════════════════════
router.get('/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { pin } = req.query; // Optional PIN from query string

        // ── Basic token format validation ─────────────────────────────
        if (!/^[a-f0-9]{64}$/.test(token)) {
            return res.status(400).json({ message: 'Invalid share link format' });
        }

        // ── Find the shared item ──────────────────────────────────────
        const sharedItem = await SharedItem.findOne({ token });

        if (!sharedItem) {
            return res.status(404).json({ message: 'Share link not found or has expired' });
        }

        // ── Check if already used ─────────────────────────────────────
        if (sharedItem.isUsed) {
            return res.status(410).json({ message: 'This link has already been used and is no longer valid' });
        }

        // ── Check expiry (belt-and-suspenders since TTL may have lag) ─
        if (sharedItem.expiresAt < new Date()) {
            return res.status(410).json({ message: 'This share link has expired' });
        }

        // ── PIN verification if required ──────────────────────────────
        if (sharedItem.pinHash) {
            if (pin === undefined || pin === null || pin === '') {
                // PIN required but not provided — tell client PIN is needed
                return res.status(200).json({
                    requiresPin: true,
                    itemLabel: sharedItem.itemLabel,
                    expiresAt: sharedItem.expiresAt
                });
            }

            const pinValid = await sharedItem.comparePin(pin);
            if (!pinValid) {
                return res.status(403).json({ message: 'Incorrect PIN. Please try again.' });
            }
        }

        // ── Mark as used BEFORE sending response (atomic-style) ───────
        sharedItem.isUsed = true;
        sharedItem.accessLog = {
            ip: getClientIp(req),
            accessedAt: new Date(),
            userAgent: req.headers['user-agent'] || 'unknown'
        };
        await sharedItem.save();

        // ── Send the encrypted blob (decryption happens on client) ────
        return res.json({
            encryptedShareBlob: sharedItem.encryptedShareBlob,
            itemLabel: sharedItem.itemLabel,
            expiresAt: sharedItem.expiresAt,
            requiresPin: false
        });

    } catch (error) {
        console.error('Error accessing share link:', error);
        return res.status(500).json({ message: 'Server error while accessing share link' });
    }
});

// ══════════════════════════════════════════════════════════════════════════
// @route   DELETE /api/share/:token
// @desc    Revoke (delete) a share link — only by the creator
// @access  Private
// ══════════════════════════════════════════════════════════════════════════
router.delete('/:token', verifyToken, async (req, res) => {
    try {
        const { token } = req.params;

        const deleted = await SharedItem.findOneAndDelete({
            token,
            createdBy: req.user.uid // Only the creator can revoke
        });

        if (!deleted) {
            return res.status(404).json({ message: 'Share link not found or you are not the owner' });
        }

        return res.json({ message: 'Share link revoked successfully' });
    } catch (error) {
        console.error('Error revoking share link:', error);
        return res.status(500).json({ message: 'Server error while revoking share link' });
    }
});

export default router;
