import express from 'express';
import User from '../models/User.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get all active sessions for the current user
router.get('/', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.uid);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const currentToken = req.cookies.session;

        const sessions = user.sessions.map(s => ({
            id: s._id,
            ip: s.ip,
            browser: s.browser,
            os: s.os,
            lastActive: s.lastActive,
            isCurrent: s.token === currentToken
        }));

        res.json(sessions);
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Revoke a specific session
router.delete('/:sessionId', verifyToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const user = await User.findById(req.user.uid);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.sessions = user.sessions.filter(s => s._id.toString() !== sessionId);
        await user.save();

        res.json({ message: 'Session revoked successfully' });
    } catch (error) {
        console.error('Error revoking session:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Revoke all other sessions
router.post('/revoke-all', verifyToken, async (req, res) => {
    try {
        const currentToken = req.cookies.session;
        const user = await User.findById(req.user.uid);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.sessions = user.sessions.filter(s => s.token === currentToken);
        await user.save();

        res.json({ message: 'All other sessions revoked successfully' });
    } catch (error) {
        console.error('Error revoking sessions:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
